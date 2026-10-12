const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const { ok, pageMeta } = require('../utils/respond');
const { paging } = require('../utils/pagination');
const { serializeNotification } = require('../services/serializers');

// Every query is scoped to the signed-in user, so one member can never read or
// change another member's notifications.
async function list(req, res) {
  const { unread, page, limit } = req.valid.query;
  const filter = { user: req.user._id };
  if (unread === 'true') filter.readAt = null;
  const { skip } = paging({ page, limit });
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, readAt: null }),
  ]);
  return ok(res, items.map(serializeNotification), { ...pageMeta({ page, limit, total }), unreadCount });
}

async function unreadCount(req, res) {
  const count = await Notification.countDocuments({ user: req.user._id, readAt: null });
  return ok(res, { unreadCount: count });
}

async function markRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.valid.params.id, user: req.user._id },
    { $set: { readAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!notification) throw ApiError.notFound('That notification could not be found.');
  return ok(res, serializeNotification(notification));
}

async function markAllRead(req, res) {
  const result = await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  return ok(res, { updated: result.modifiedCount });
}

module.exports = { list, unreadCount, markRead, markAllRead };
