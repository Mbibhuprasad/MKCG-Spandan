// One registry for every moderated content type, so likes, comments, reports,
// moderation and deletion follow the same rules everywhere.
const Post = require('../models/Post');
const Blog = require('../models/Blog');
const Comment = require('../models/Comment');
const Like = require('../models/Like');
const Memory = require('../models/Memory');
const Event = require('../models/Event');
const Rsvp = require('../models/Rsvp');
const Poll = require('../models/Poll');
const Vote = require('../models/Vote');
const Report = require('../models/Report');
const ApiError = require('../utils/ApiError');
const { MODERATION, ROLES } = require('../config/constants');
const { destroyMedia } = require('./media.service');
const { idOf } = require('./serializers');

const TYPES = Object.freeze({
  post: { Model: Post, ownerField: 'author', label: 'post', likeable: true, commentable: true },
  blog: { Model: Blog, ownerField: 'author', label: 'blog', likeable: true, commentable: true },
  memory: { Model: Memory, ownerField: 'owner', label: 'memory', likeable: true, commentable: true },
  event: { Model: Event, ownerField: 'organizer', label: 'event', likeable: false, commentable: true },
  poll: { Model: Poll, ownerField: 'creator', label: 'poll', likeable: false, commentable: false },
  comment: { Model: Comment, ownerField: 'author', label: 'comment', likeable: false, commentable: false },
});

function entry(type) {
  const found = TYPES[type];
  if (!found) throw ApiError.badRequest('Unknown content type.');
  return found;
}

const ownerId = (type, doc) => idOf(doc[entry(type).ownerField]);
const isOwner = (type, doc, user) => Boolean(user && ownerId(type, doc) === String(user._id));
const isAdmin = (user) => Boolean(user && user.role === ROLES.ADMIN);

// Pending and rejected content exists only for its owner and for admins.
// Everyone else gets the same 404 as for a missing item.
function canView(type, doc, viewer) {
  return doc.moderationStatus === MODERATION.APPROVED || isOwner(type, doc, viewer) || isAdmin(viewer);
}

async function loadVisible(type, id, viewer) {
  const doc = await entry(type).Model.findById(id);
  if (!doc || !canView(type, doc, viewer)) throw ApiError.notFound(`That ${entry(type).label} could not be found.`);
  return doc;
}

// Loads an item the caller is allowed to change: the owner, or an admin when
// `adminAllowed` is set (admins may delete anything, but only owners edit).
async function loadManageable(type, id, user, { adminAllowed = false } = {}) {
  const doc = await entry(type).Model.findById(id);
  if (!doc) throw ApiError.notFound(`That ${entry(type).label} could not be found.`);
  if (isOwner(type, doc, user)) return doc;
  if (adminAllowed && isAdmin(user)) return doc;
  // Hide unpublished items entirely; otherwise say plainly that it is not theirs.
  if (doc.moderationStatus !== MODERATION.APPROVED) throw ApiError.notFound(`That ${entry(type).label} could not be found.`);
  throw ApiError.forbidden(`You can only manage your own ${entry(type).label}s.`);
}

// New submissions by doctors always start PENDING. Admin-authored content is
// published immediately. The status is decided here, never by the client.
function initialModeration(user) {
  if (isAdmin(user)) {
    const now = new Date();
    return { moderationStatus: MODERATION.APPROVED, reviewedAt: now, reviewedBy: user._id, publishedAt: now };
  }
  return { moderationStatus: MODERATION.PENDING };
}

// After an owner edits their content it must be reviewed again.
function resetModerationAfterEdit(doc, user) {
  if (isAdmin(user)) return;
  doc.moderationStatus = MODERATION.PENDING;
  doc.submittedAt = new Date();
  doc.reviewedAt = null;
  doc.reviewedBy = null;
  doc.rejectionReason = '';
}

async function linkFor(type, doc) {
  switch (type) {
    case 'post':
      return `/community/posts/${doc._id}`;
    case 'blog':
      return `/blogs/${doc.slug}`;
    case 'memory':
      return `/memories?memory=${doc._id}`;
    case 'event':
      return `/events/${doc._id}`;
    case 'poll':
      return '/community?tab=polls';
    case 'comment': {
      const target = await entry(doc.targetType).Model.findById(doc.target).select('slug');
      return target ? linkFor(doc.targetType, target) : '/community';
    }
    default:
      return '/dashboard';
  }
}

function titleOf(type, doc) {
  const raw = doc.title || doc.question || doc.body || '';
  const text = String(raw).replace(/\s+/g, ' ').trim();
  return text.length > 70 ? `${text.slice(0, 69)}…` : text;
}

async function removeCommentsFor(targetType, targetId) {
  const comments = await Comment.find({ targetType, target: targetId }).select('_id').lean();
  if (!comments.length) return;
  const ids = comments.map((c) => c._id);
  await Report.deleteMany({ targetType: 'comment', target: { $in: ids } });
  await Comment.deleteMany({ _id: { $in: ids } });
}

// Deletes an item together with everything that hangs off it, in an order that
// is safe to repeat if a step fails part-way (no transactions are required).
async function deleteContent(type, doc) {
  const id = doc._id;
  switch (type) {
    case 'post':
      await removeCommentsFor('post', id);
      await Like.deleteMany({ targetType: 'post', target: id });
      await destroyMedia(doc.media);
      break;
    case 'blog':
      await removeCommentsFor('blog', id);
      await Like.deleteMany({ targetType: 'blog', target: id });
      await destroyMedia([doc.cover]);
      break;
    case 'memory':
      await removeCommentsFor('memory', id);
      await Like.deleteMany({ targetType: 'memory', target: id });
      await destroyMedia(doc.media);
      break;
    case 'event':
      await removeCommentsFor('event', id);
      await Rsvp.deleteMany({ event: id });
      await Memory.updateMany({ event: id }, { $set: { event: null } });
      await destroyMedia([doc.cover]);
      break;
    case 'poll':
      await Vote.deleteMany({ poll: id });
      break;
    case 'comment':
      if (doc.moderationStatus === MODERATION.APPROVED) {
        await entry(doc.targetType).Model.updateOne(
          { _id: doc.target, commentCount: { $gt: 0 } },
          { $inc: { commentCount: -1 } }
        );
      }
      break;
    default:
      throw ApiError.badRequest('Unknown content type.');
  }
  await Report.deleteMany({ targetType: type, target: id });
  await doc.deleteOne();
}

module.exports = {
  TYPES,
  entry,
  ownerId,
  isOwner,
  isAdmin,
  canView,
  loadVisible,
  loadManageable,
  initialModeration,
  resetModerationAfterEdit,
  linkFor,
  titleOf,
  deleteContent,
};
