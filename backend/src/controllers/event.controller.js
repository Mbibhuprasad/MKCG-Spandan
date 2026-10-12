const mongoose = require('mongoose');
const Event = require('../models/Event');
const Rsvp = require('../models/Rsvp');
const Memory = require('../models/Memory');
const ApiError = require('../utils/ApiError');
const { ok, created, pageMeta } = require('../utils/respond');
const { paging } = require('../utils/pagination');
const { MODERATION } = require('../config/constants');
const content = require('../services/content.service');
const { announce } = require('../services/moderation.service');
const { claimMedia, unclaim, destroyMedia } = require('../services/media.service');
const { serializeEvent, serializeEventPublic, authorSummary, AUTHOR_FIELDS } = require('../services/serializers');

const POPULATE = [{ path: 'organizer', select: AUTHOR_FIELDS }, { path: 'cover' }];

const emptyCounts = () => ({ going: 0, maybe: 0, notGoing: 0, guests: 0 });

// RSVP totals for a page of events in a single aggregation.
async function rsvpCounts(eventIds) {
  const map = new Map(eventIds.map((id) => [String(id), emptyCounts()]));
  if (!eventIds.length) return map;
  const rows = await Rsvp.aggregate([
    { $match: { event: { $in: eventIds } } },
    { $group: { _id: { event: '$event', status: '$status' }, count: { $sum: 1 }, guests: { $sum: '$guests' } } },
  ]);
  for (const row of rows) {
    const counts = map.get(String(row._id.event));
    if (!counts) continue;
    if (row._id.status === 'GOING') {
      counts.going = row.count;
      counts.guests = row.guests;
    } else if (row._id.status === 'MAYBE') counts.maybe = row.count;
    else counts.notGoing = row.count;
  }
  return map;
}

async function present(events, viewer) {
  const ids = events.map((e) => e._id);
  const [counts, mine] = await Promise.all([
    rsvpCounts(ids),
    viewer ? Rsvp.find({ user: viewer._id, event: { $in: ids } }).lean() : [],
  ]);
  const myMap = new Map(mine.map((r) => [String(r.event), r]));
  return events.map((e) =>
    serializeEvent(e, { viewer, counts: counts.get(String(e._id)), myRsvp: myMap.get(String(e._id)) })
  );
}

function assertDates({ startsAt, endsAt, rsvpDeadline }, { requireFuture }) {
  const details = {};
  if (requireFuture && startsAt.getTime() < Date.now() - 60 * 1000) details.startsAt = 'Choose a start time in the future.';
  if (endsAt && endsAt.getTime() < startsAt.getTime()) details.endsAt = 'The end cannot be before the start.';
  if (rsvpDeadline && rsvpDeadline.getTime() > startsAt.getTime()) {
    details.rsvpDeadline = 'The RSVP deadline must be before the event starts.';
  }
  if (Object.keys(details).length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', details);
  }
}

// Public homepage: a few non-sensitive fields of approved upcoming events whose
// organiser opted in to a public mention. No venue, description or attendees.
async function publicUpcoming(_req, res) {
  const events = await Event.find({
    moderationStatus: MODERATION.APPROVED,
    showOnPublicSite: true,
    endsAt: { $gte: new Date() },
  })
    .sort({ startsAt: 1 })
    .limit(6);
  return ok(res, events.map(serializeEventPublic));
}

async function list(req, res) {
  const { scope, type, page, limit } = req.valid.query;
  const now = new Date();
  const filter = { moderationStatus: MODERATION.APPROVED };
  filter.endsAt = scope === 'upcoming' ? { $gte: now } : { $lt: now };
  if (type) filter.eventType = type;

  const { skip } = paging({ page, limit });
  const [events, total] = await Promise.all([
    Event.find(filter)
      .sort(scope === 'upcoming' ? { startsAt: 1, _id: 1 } : { startsAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate(POPULATE),
    Event.countDocuments(filter),
  ]);
  return ok(res, await present(events, req.user), pageMeta({ page, limit, total }));
}

async function mine(req, res) {
  const { page, limit } = req.valid.query;
  const filter = { organizer: req.user._id };
  const { skip } = paging({ page, limit });
  const [events, total] = await Promise.all([
    Event.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(POPULATE),
    Event.countDocuments(filter),
  ]);
  return ok(res, await present(events, req.user), pageMeta({ page, limit, total }));
}

async function getOne(req, res) {
  const event = await content.loadVisible('event', req.valid.params.id, req.user);
  await event.populate(POPULATE);
  const [item] = await present([event], req.user);
  item.memoryCount = await Memory.countDocuments({
    event: event._id,
    moderationStatus: MODERATION.APPROVED,
    showInCommunity: { $ne: false },
  });
  return ok(res, item);
}

async function create(req, res) {
  const data = req.valid.body;
  const endsAt = data.endsAt || data.startsAt;
  assertDates({ ...data, endsAt }, { requireFuture: true });

  const id = new mongoose.Types.ObjectId();
  const claimed = data.coverId
    ? await claimMedia({ ids: [data.coverId], ownerId: req.user._id, purpose: 'event', kind: 'Event', itemId: id })
    : [];

  let event;
  try {
    event = await Event.create({
      _id: id,
      organizer: req.user._id,
      title: data.title,
      description: data.description,
      eventType: data.eventType,
      venue: data.venue,
      city: data.city,
      startsAt: data.startsAt,
      endsAt,
      budgetNote: data.budgetNote,
      cover: claimed[0] || null,
      rsvpEnabled: data.rsvpEnabled,
      rsvpDeadline: data.rsvpDeadline,
      capacity: data.capacity,
      showOnPublicSite: data.showOnPublicSite,
      ...content.publishedState(),
    });
  } catch (err) {
    await unclaim(claimed);
    throw err;
  }
  await announce('event', event);

  await event.populate(POPULATE);
  const [item] = await present([event], req.user);
  return created(res, item);
}

async function update(req, res) {
  const event = await content.loadManageable('event', req.valid.params.id, req.user);
  const data = req.valid.body;

  const simple = ['title', 'description', 'eventType', 'venue', 'city', 'budgetNote', 'rsvpEnabled', 'rsvpDeadline', 'capacity', 'showOnPublicSite'];
  for (const key of simple) if (data[key] !== undefined) event[key] = data[key];
  const datesChanged = data.startsAt !== undefined || data.endsAt !== undefined;
  if (data.startsAt !== undefined) event.startsAt = data.startsAt;
  if (data.endsAt !== undefined) event.endsAt = data.endsAt || event.startsAt;
  if (event.endsAt.getTime() < event.startsAt.getTime() && data.endsAt === undefined) event.endsAt = event.startsAt;
  assertDates(event, { requireFuture: datesChanged });

  let claimed = [];
  let removed = [];
  if (data.coverId !== undefined && String(data.coverId || '') !== String(event.cover || '')) {
    if (data.coverId) {
      claimed = await claimMedia({ ids: [data.coverId], ownerId: req.user._id, purpose: 'event', kind: 'Event', itemId: event._id });
    }
    if (event.cover) removed = [event.cover];
    event.cover = data.coverId || null;
  }
  if (datesChanged) event.reminderSentAt = null;
  content.publishAfterEdit(event);

  try {
    await event.save();
  } catch (err) {
    await unclaim(claimed);
    throw err;
  }
  await destroyMedia(removed);

  await event.populate(POPULATE);
  const [item] = await present([event], req.user);
  return ok(res, item);
}

async function remove(req, res) {
  const event = await content.loadManageable('event', req.valid.params.id, req.user);
  await content.deleteContent('event', event);
  return ok(res, { deleted: true });
}

/* ── RSVPs ── */

async function loadOpenEvent(id, viewer) {
  const event = await content.loadVisible('event', id, viewer);
  if (event.moderationStatus !== MODERATION.APPROVED) {
    throw ApiError.conflict('This event is not available for RSVPs.', undefined, 'NOT_PUBLISHED');
  }
  return event;
}

async function setRsvp(req, res) {
  const { status, guests } = req.valid.body;
  const event = await loadOpenEvent(req.valid.params.id, req.user);
  const now = Date.now();

  if (!event.rsvpEnabled) throw ApiError.conflict('RSVPs are not enabled for this event.', undefined, 'RSVP_CLOSED');
  if (event.endsAt.getTime() < now) throw ApiError.conflict('This event has already taken place.', undefined, 'RSVP_CLOSED');
  if (event.rsvpDeadline && event.rsvpDeadline.getTime() < now) {
    throw ApiError.conflict('The RSVP deadline for this event has passed.', undefined, 'RSVP_CLOSED');
  }

  const effectiveGuests = status === 'GOING' ? guests : 0;
  if (status === 'GOING' && event.capacity) {
    const others = await Rsvp.aggregate([
      { $match: { event: event._id, status: 'GOING', user: { $ne: req.user._id } } },
      { $group: { _id: null, people: { $sum: { $add: [1, '$guests'] } } } },
    ]);
    const taken = others.length ? others[0].people : 0;
    if (taken + 1 + effectiveGuests > event.capacity) {
      throw ApiError.conflict('This event does not have enough places left.', undefined, 'EVENT_FULL');
    }
  }

  // Upsert against the unique (event, user) index: a doctor always has at most
  // one RSVP, even if the same request is sent twice at once.
  const write = () =>
    Rsvp.findOneAndUpdate(
      { event: event._id, user: req.user._id },
      { $set: { status, guests: effectiveGuests } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  try {
    await write();
  } catch (err) {
    if (!err || err.code !== 11000) throw err;
    await write();
  }

  await event.populate(POPULATE);
  const [item] = await present([event], req.user);
  return ok(res, item);
}

async function clearRsvp(req, res) {
  const event = await loadOpenEvent(req.valid.params.id, req.user);
  await Rsvp.deleteOne({ event: event._id, user: req.user._id });
  await event.populate(POPULATE);
  const [item] = await present([event], req.user);
  return ok(res, item);
}

// Names of members attending — no contact details.
async function attendees(req, res) {
  const event = await loadOpenEvent(req.valid.params.id, req.user);
  const { page, limit } = req.valid.query;
  const filter = { event: event._id, status: { $in: ['GOING', 'MAYBE'] } };
  const { skip } = paging({ page, limit });
  const [rows, total] = await Promise.all([
    Rsvp.find(filter).sort({ status: 1, createdAt: 1 }).skip(skip).limit(limit).populate('user', AUTHOR_FIELDS),
    Rsvp.countDocuments(filter),
  ]);
  return ok(
    res,
    rows.map((r) => ({ status: r.status, guests: r.guests, doctor: authorSummary(r.user) })),
    pageMeta({ page, limit, total })
  );
}

module.exports = { publicUpcoming, list, mine, getOne, create, update, remove, setRsvp, clearRsvp, attendees };
