const mongoose = require('mongoose');
const Memory = require('../models/Memory');
const Event = require('../models/Event');
const User = require('../models/User');
const Media = require('../models/Media');
const ApiError = require('../utils/ApiError');
const { ok, created, pageMeta } = require('../utils/respond');
const { paging } = require('../utils/pagination');
const { MODERATION, ROLES } = require('../config/constants');
const content = require('../services/content.service');
const cloud = require('../services/cloudinary.service');
const { claimMedia, unclaim, syncMedia, destroyMedia } = require('../services/media.service');
const { likedSet } = require('../services/interaction.service');
const { serializeMemory, AUTHOR_FIELDS } = require('../services/serializers');

const POPULATE = [
  { path: 'owner', select: AUTHOR_FIELDS },
  { path: 'media' },
  { path: 'event', select: 'title moderationStatus' },
];

async function present(memories, viewer) {
  const liked = await likedSet(viewer, 'memory', memories.map((m) => m._id));
  return memories.map((m) => serializeMemory(m, { viewer, likedIds: liked }));
}

// A memory can only be linked to an event the member is allowed to see.
async function assertLinkableEvent(eventId, viewer) {
  if (!eventId) return;
  const event = await Event.findById(eventId);
  if (!event || !content.canView('event', event, viewer)) {
    throw ApiError.badRequest('That event could not be found.', { eventId: 'Choose a valid event.' });
  }
}

// Memories listed in the community section (the default for every memory).
const COMMUNITY = { showInCommunity: { $ne: false } };

// May the viewer see the items a doctor keeps for their portfolio only? Yes for
// the doctor and for admins; for other members only while the doctor is listed
// in the directory and has not hidden the gallery section of the portfolio.
async function canSeePortfolioGallery(ownerId, viewer) {
  if (String(viewer._id) === String(ownerId) || viewer.role === ROLES.ADMIN) return true;
  const owner = await User.findById(ownerId).select('visibility status');
  if (!owner || owner.status !== 'ACTIVE') return false;
  const v = owner.visibility || {};
  return v.directory !== false && !(v.sections && v.sections.gallery === false);
}

// Members-only. Without `owner`: the community Memories section. With `owner`:
// that doctor's portfolio gallery — the same records, never copies.
async function list(req, res) {
  const { eventId, owner, page, limit } = req.valid.query;
  const filter = { moderationStatus: MODERATION.APPROVED };
  if (owner) {
    filter.owner = owner;
    if (!(await canSeePortfolioGallery(owner, req.user))) Object.assign(filter, COMMUNITY);
  } else {
    Object.assign(filter, COMMUNITY);
  }
  if (eventId) filter.event = eventId;
  const { skip } = paging({ page, limit });
  const [memories, total] = await Promise.all([
    Memory.find(filter).sort({ publishedAt: -1, _id: -1 }).skip(skip).limit(limit).populate(POPULATE),
    Memory.countDocuments(filter),
  ]);
  return ok(res, await present(memories, req.user), pageMeta({ page, limit, total }));
}

// Events that have at least one approved memory, for the gallery filter.
async function eventFilters(_req, res) {
  const ids = await Memory.distinct('event', { moderationStatus: MODERATION.APPROVED, ...COMMUNITY, event: { $ne: null } });
  const events = await Event.find({ _id: { $in: ids }, moderationStatus: MODERATION.APPROVED })
    .select('title startsAt')
    .sort({ startsAt: -1 })
    .limit(100);
  return ok(res, events.map((e) => ({ id: String(e._id), title: e.title, startsAt: e.startsAt })));
}

async function mine(req, res) {
  const { page, limit } = req.valid.query;
  const filter = { owner: req.user._id };
  const { skip } = paging({ page, limit });
  const [memories, total] = await Promise.all([
    Memory.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(POPULATE),
    Memory.countDocuments(filter),
  ]);
  return ok(res, await present(memories, req.user), pageMeta({ page, limit, total }));
}

// A portfolio-only memory is not served to members who may not see that gallery.
async function loadViewable(id, viewer) {
  const memory = await content.loadVisible('memory', id, viewer);
  if (memory.showInCommunity === false && !(await canSeePortfolioGallery(memory.owner, viewer))) {
    throw ApiError.notFound('That memory could not be found.');
  }
  return memory;
}

async function getOne(req, res) {
  const memory = await loadViewable(req.valid.params.id, req.user);
  await memory.populate(POPULATE);
  const [item] = await present([memory], req.user);
  return ok(res, item);
}

async function create(req, res) {
  const { title, caption, eventId, memoryDate, mediaIds, showInCommunity } = req.valid.body;
  await assertLinkableEvent(eventId, req.user);

  const id = new mongoose.Types.ObjectId();
  const media = await claimMedia({ ids: mediaIds, ownerId: req.user._id, purpose: 'memory', kind: 'Memory', itemId: id });

  let memory;
  try {
    memory = await Memory.create({
      _id: id,
      owner: req.user._id,
      title,
      caption,
      event: eventId,
      memoryDate,
      media,
      showInCommunity,
      ...content.publishedState(),
    });
  } catch (err) {
    await unclaim(media);
    throw err;
  }

  await memory.populate(POPULATE);
  return created(res, serializeMemory(memory, { viewer: req.user }));
}

async function update(req, res) {
  const memory = await content.loadManageable('memory', req.valid.params.id, req.user);
  const { title, caption, eventId, memoryDate, mediaIds, showInCommunity } = req.valid.body;

  if (eventId !== undefined) {
    await assertLinkableEvent(eventId, req.user);
    memory.event = eventId;
  }

  let removed = [];
  let claimed = [];
  if (mediaIds !== undefined) {
    const result = await syncMedia({
      currentIds: memory.media,
      nextIds: mediaIds,
      ownerId: req.user._id,
      purpose: 'memory',
      kind: 'Memory',
      itemId: memory._id,
    });
    memory.media = result.ids;
    ({ removed, claimed } = result);
  }
  if (title !== undefined) memory.title = title;
  if (caption !== undefined) memory.caption = caption;
  if (memoryDate !== undefined) memory.memoryDate = memoryDate;
  if (showInCommunity !== undefined) memory.showInCommunity = showInCommunity;
  content.publishAfterEdit(memory);

  try {
    await memory.save();
  } catch (err) {
    await unclaim(claimed);
    throw err;
  }
  await destroyMedia(removed);

  await memory.populate(POPULATE);
  return ok(res, serializeMemory(memory, { viewer: req.user }));
}

async function remove(req, res) {
  const memory = await content.loadManageable('memory', req.valid.params.id, req.user);
  await content.deleteContent('memory', memory);
  return ok(res, { deleted: true });
}

// Issues a short-lived signed link to the original file. The caller must be a
// signed-in member who is allowed to see this memory; the link expires quickly
// and is never stored.
async function download(req, res) {
  const { id, mediaId } = req.valid.params;
  const memory = await loadViewable(id, req.user);
  if (!memory.media.some((m) => String(m) === mediaId)) throw ApiError.notFound('That file could not be found.');
  const media = await Media.findById(mediaId);
  if (!media) throw ApiError.notFound('That file could not be found.');
  const ttlSeconds = 300;
  return ok(res, { url: cloud.downloadUrl(media, ttlSeconds), expiresInSeconds: ttlSeconds });
}

module.exports = { list, eventFilters, mine, getOne, create, update, remove, download };
