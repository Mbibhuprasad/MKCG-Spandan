const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../utils/logger');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');

function build(userId, { type, title, message = '', link = '', dedupeKey }) {
  const doc = { user: userId, type, title: String(title).slice(0, 160), message: String(message).slice(0, 500), link };
  if (dedupeKey) doc.dedupeKey = dedupeKey;
  return doc;
}

// Notifications are best-effort: a failure here must never break the action
// that triggered it, so errors are logged and swallowed.
async function notify(userId, payload) {
  try {
    if (!userId) return;
    const doc = build(userId, payload);
    if (doc.dedupeKey) {
      await Notification.updateOne(
        { user: userId, dedupeKey: doc.dedupeKey },
        { $setOnInsert: doc },
        { upsert: true }
      );
    } else {
      await Notification.create(doc);
    }
  } catch (err) {
    if (err && err.code === 11000) return; // already delivered
    logger.error('Failed to create notification:', err.message);
  }
}

// Fan-out to many users. A dedupeKey is required so repeats are harmless.
async function notifyMany(userIds, payload) {
  try {
    if (!userIds.length || !payload.dedupeKey) return;
    const ops = userIds.map((userId) => ({
      updateOne: {
        filter: { user: userId, dedupeKey: payload.dedupeKey },
        update: { $setOnInsert: build(userId, payload) },
        upsert: true,
      },
    }));
    for (let i = 0; i < ops.length; i += 500) {
      await Notification.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    }
  } catch (err) {
    if (err && err.code === 11000) return;
    logger.error('Failed to fan out notifications:', err.message);
  }
}

async function notifyAllDoctors(payload, exceptUserId) {
  const filter = { role: ROLES.DOCTOR, status: ACCOUNT_STATUS.ACTIVE };
  if (exceptUserId) filter._id = { $ne: exceptUserId };
  const users = await User.find(filter).select('_id').lean();
  await notifyMany(users.map((u) => u._id), payload);
}

module.exports = { notify, notifyMany, notifyAllDoctors };
