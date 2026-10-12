// Likes, comments and reports share one implementation for every content type.
const Comment = require('../models/Comment');
const Like = require('../models/Like');
const Report = require('../models/Report');
const ApiError = require('../utils/ApiError');
const { ok, created, pageMeta } = require('../utils/respond');
const { paging } = require('../utils/pagination');
const { MODERATION } = require('../config/constants');
const content = require('../services/content.service');
const { serializeComment, AUTHOR_FIELDS } = require('../services/serializers');

// Interactions are only possible on content that is published.
async function loadApprovedTarget(type, id, viewer) {
  const target = await content.loadVisible(type, id, viewer);
  if (target.moderationStatus !== MODERATION.APPROVED) {
    throw ApiError.conflict('This is only possible once the content has been approved.', undefined, 'NOT_PUBLISHED');
  }
  return target;
}

/* ── Likes ── */

async function like(req, res) {
  const { targetType, targetId } = req.valid.params;
  const { Model } = content.entry(targetType);
  await loadApprovedTarget(targetType, targetId, req.user);

  try {
    await Like.create({ user: req.user._id, targetType, target: targetId });
    await Model.updateOne({ _id: targetId }, { $inc: { likeCount: 1 } });
  } catch (err) {
    // The unique index rejected a duplicate: the like already exists, so the
    // counter is left alone and the request is treated as a success.
    if (!err || err.code !== 11000) throw err;
  }
  const fresh = await Model.findById(targetId).select('likeCount').lean();
  return ok(res, { liked: true, likeCount: fresh ? fresh.likeCount : 0 });
}

async function unlike(req, res) {
  const { targetType, targetId } = req.valid.params;
  const { Model } = content.entry(targetType);
  await content.loadVisible(targetType, targetId, req.user);

  const result = await Like.deleteOne({ user: req.user._id, targetType, target: targetId });
  if (result.deletedCount === 1) {
    await Model.updateOne({ _id: targetId, likeCount: { $gt: 0 } }, { $inc: { likeCount: -1 } });
  }
  const fresh = await Model.findById(targetId).select('likeCount').lean();
  return ok(res, { liked: false, likeCount: fresh ? fresh.likeCount : 0 });
}

/* ── Comments ── */

// Approved comments for everyone, plus the viewer's own pending/rejected ones.
async function listComments(req, res) {
  const { targetType, targetId, page, limit } = req.valid.query;
  await content.loadVisible(targetType, targetId, req.user);

  const filter = {
    targetType,
    target: targetId,
    $or: [{ moderationStatus: MODERATION.APPROVED }, { author: req.user._id }],
  };
  const { skip } = paging({ page, limit });
  const [comments, total] = await Promise.all([
    Comment.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate('author', AUTHOR_FIELDS),
    Comment.countDocuments(filter),
  ]);
  return ok(res, comments.map((c) => serializeComment(c, { viewer: req.user })), pageMeta({ page, limit, total }));
}

async function myComments(req, res) {
  const { page, limit } = req.valid.query;
  const filter = { author: req.user._id };
  const { skip } = paging({ page, limit });
  const [comments, total] = await Promise.all([
    Comment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('author', AUTHOR_FIELDS),
    Comment.countDocuments(filter),
  ]);
  return ok(res, comments.map((c) => serializeComment(c, { viewer: req.user })), pageMeta({ page, limit, total }));
}

async function createComment(req, res) {
  const { targetType, targetId, body } = req.valid.body;
  const { Model, commentable } = content.entry(targetType);
  if (!commentable) throw ApiError.badRequest('Comments are not available here.');
  await loadApprovedTarget(targetType, targetId, req.user);

  const moderation = content.initialModeration(req.user);
  const comment = await Comment.create({ author: req.user._id, targetType, target: targetId, body, ...moderation });
  if (moderation.moderationStatus === MODERATION.APPROVED) {
    await Model.updateOne({ _id: targetId }, { $inc: { commentCount: 1 } });
  }

  await comment.populate('author', AUTHOR_FIELDS);
  return created(res, serializeComment(comment, { viewer: req.user }));
}

async function updateComment(req, res) {
  const comment = await content.loadManageable('comment', req.valid.params.id, req.user);
  const wasApproved = comment.moderationStatus === MODERATION.APPROVED;

  comment.body = req.valid.body.body;
  content.resetModerationAfterEdit(comment, req.user);
  await comment.save();

  // An edited comment leaves the public thread until it is reviewed again.
  if (wasApproved && comment.moderationStatus !== MODERATION.APPROVED) {
    await content
      .entry(comment.targetType)
      .Model.updateOne({ _id: comment.target, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
  }

  await comment.populate('author', AUTHOR_FIELDS);
  return ok(res, serializeComment(comment, { viewer: req.user }));
}

async function removeComment(req, res) {
  const comment = await content.loadManageable('comment', req.valid.params.id, req.user);
  await content.deleteContent('comment', comment);
  return ok(res, { deleted: true });
}

/* ── Reports ── */

async function createReport(req, res) {
  const { targetType, targetId, reason, details } = req.valid.body;
  const target = await loadApprovedTarget(targetType, targetId, req.user);
  if (content.isOwner(targetType, target, req.user)) {
    throw ApiError.badRequest('You cannot report your own content. You can edit or delete it instead.');
  }
  try {
    await Report.create({ reporter: req.user._id, targetType, target: targetId, reason, details });
  } catch (err) {
    if (err && err.code === 11000) return ok(res, { reported: true, alreadyReported: true });
    throw err;
  }
  return created(res, { reported: true, alreadyReported: false });
}

module.exports = {
  like,
  unlike,
  listComments,
  myComments,
  createComment,
  updateComment,
  removeComment,
  createReport,
};
