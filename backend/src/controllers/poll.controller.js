const Poll = require('../models/Poll');
const Vote = require('../models/Vote');
const ApiError = require('../utils/ApiError');
const { ok, created, pageMeta } = require('../utils/respond');
const { paging } = require('../utils/pagination');
const { MODERATION } = require('../config/constants');
const content = require('../services/content.service');
const { announce } = require('../services/moderation.service');
const { serializePoll, pollState, AUTHOR_FIELDS } = require('../services/serializers');

const YEAR_MS = 366 * 24 * 60 * 60 * 1000;

// Results are always computed from the ballots themselves, so they cannot
// drift from the votes that were actually cast.
async function tallies(pollIds) {
  const map = new Map(pollIds.map((id) => [String(id), { counts: {}, voters: 0 }]));
  if (!pollIds.length) return map;
  const [options, voters] = await Promise.all([
    Vote.aggregate([
      { $match: { poll: { $in: pollIds } } },
      { $unwind: '$options' },
      { $group: { _id: { poll: '$poll', option: '$options' }, count: { $sum: 1 } } },
    ]),
    Vote.aggregate([{ $match: { poll: { $in: pollIds } } }, { $group: { _id: '$poll', voters: { $sum: 1 } } }]),
  ]);
  for (const row of options) {
    const t = map.get(String(row._id.poll));
    if (t) t.counts[String(row._id.option)] = row.count;
  }
  for (const row of voters) {
    const t = map.get(String(row._id));
    if (t) t.voters = row.voters;
  }
  return map;
}

async function present(polls, viewer) {
  const ids = polls.map((p) => p._id);
  const [tally, mine] = await Promise.all([tallies(ids), Vote.find({ user: viewer._id, poll: { $in: ids } }).lean()]);
  const myMap = new Map(mine.map((v) => [String(v.poll), v]));
  return polls.map((p) =>
    serializePoll(p, { viewer, myVote: myMap.get(String(p._id)), tally: tally.get(String(p._id)) })
  );
}

function assertWindow(startsAt, endsAt) {
  const details = {};
  const now = Date.now();
  if (endsAt.getTime() <= now) details.endsAt = 'Choose a closing time in the future.';
  else if (endsAt.getTime() <= startsAt.getTime()) details.endsAt = 'The poll must close after it opens.';
  else if (endsAt.getTime() - now > YEAR_MS) details.endsAt = 'A poll can stay open for at most one year.';
  if (Object.keys(details).length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', details);
  }
}

async function list(req, res) {
  const { state, page, limit } = req.valid.query;
  const now = new Date();
  const filter = { moderationStatus: MODERATION.APPROVED };
  if (state === 'open') filter.endsAt = { $gt: now };
  if (state === 'closed') filter.endsAt = { $lte: now };

  const { skip } = paging({ page, limit });
  const [polls, total] = await Promise.all([
    Poll.find(filter).sort({ endsAt: -1, _id: -1 }).skip(skip).limit(limit).populate('creator', AUTHOR_FIELDS),
    Poll.countDocuments(filter),
  ]);
  return ok(res, await present(polls, req.user), pageMeta({ page, limit, total }));
}

async function mine(req, res) {
  const { page, limit } = req.valid.query;
  const filter = { creator: req.user._id };
  const { skip } = paging({ page, limit });
  const [polls, total] = await Promise.all([
    Poll.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('creator', AUTHOR_FIELDS),
    Poll.countDocuments(filter),
  ]);
  return ok(res, await present(polls, req.user), pageMeta({ page, limit, total }));
}

async function getOne(req, res) {
  const poll = await content.loadVisible('poll', req.valid.params.id, req.user);
  await poll.populate('creator', AUTHOR_FIELDS);
  const [item] = await present([poll], req.user);
  return ok(res, item);
}

async function create(req, res) {
  const data = req.valid.body;
  const startsAt = data.startsAt || new Date();
  assertWindow(startsAt, data.endsAt);

  const poll = await Poll.create({
    creator: req.user._id,
    question: data.question,
    description: data.description,
    options: data.options.map((text) => ({ text })),
    allowMultiple: data.allowMultiple,
    resultsVisibility: data.resultsVisibility,
    startsAt,
    endsAt: data.endsAt,
    ...content.publishedState(),
  });
  await announce('poll', poll);
  await poll.populate('creator', AUTHOR_FIELDS);
  const [item] = await present([poll], req.user);
  return created(res, item);
}

// A poll can only be edited before anyone has voted, so the options people
// voted on can never change underneath them.
async function update(req, res) {
  const poll = await content.loadManageable('poll', req.valid.params.id, req.user);
  if (await Vote.exists({ poll: poll._id })) {
    throw ApiError.conflict('This poll already has votes and can no longer be edited.', undefined, 'POLL_LOCKED');
  }

  const data = req.valid.body;
  for (const key of ['question', 'description', 'allowMultiple', 'resultsVisibility']) {
    if (data[key] !== undefined) poll[key] = data[key];
  }
  if (data.options !== undefined) poll.options = data.options.map((text) => ({ text }));
  if (data.startsAt !== undefined) poll.startsAt = data.startsAt || new Date();
  if (data.endsAt !== undefined) poll.endsAt = data.endsAt;
  assertWindow(poll.startsAt, poll.endsAt);
  content.publishAfterEdit(poll);
  await poll.save();

  await poll.populate('creator', AUTHOR_FIELDS);
  const [item] = await present([poll], req.user);
  return ok(res, item);
}

async function remove(req, res) {
  const poll = await content.loadManageable('poll', req.valid.params.id, req.user);
  await content.deleteContent('poll', poll);
  return ok(res, { deleted: true });
}

async function vote(req, res) {
  const { optionIds } = req.valid.body;
  const poll = await content.loadVisible('poll', req.valid.params.id, req.user);

  if (poll.moderationStatus !== MODERATION.APPROVED) {
    throw ApiError.conflict('This poll is not available for voting.', undefined, 'NOT_PUBLISHED');
  }
  const state = pollState(poll);
  if (state === 'UPCOMING') throw ApiError.conflict('Voting has not opened yet.', undefined, 'POLL_NOT_OPEN');
  if (state === 'CLOSED') throw ApiError.conflict('This poll is closed.', undefined, 'POLL_CLOSED');

  const valid = new Set(poll.options.map((o) => String(o._id)));
  if (!optionIds.every((id) => valid.has(id))) {
    throw ApiError.badRequest('That option does not belong to this poll.', { optionIds: 'Choose one of the listed options.' });
  }
  if (!poll.allowMultiple && optionIds.length !== 1) {
    throw ApiError.badRequest('This poll allows one choice only.', { optionIds: 'Choose a single option.' });
  }

  try {
    // The unique (poll, user) index is what guarantees one ballot per doctor.
    await Vote.create({ poll: poll._id, user: req.user._id, options: optionIds });
  } catch (err) {
    if (err && err.code === 11000) throw ApiError.conflict('You have already voted in this poll.', undefined, 'ALREADY_VOTED');
    throw err;
  }
  await Poll.updateOne({ _id: poll._id }, { $inc: { voteCount: 1 } });

  await poll.populate('creator', AUTHOR_FIELDS);
  const [item] = await present([poll], req.user);
  return created(res, item);
}

module.exports = { list, mine, getOne, create, update, remove, vote };
