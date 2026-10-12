const User = require('../models/User');
const { MODERATION, ACCOUNT_STATUS } = require('../config/constants');
const content = require('./content.service');

// Order matters: comments are handled last, once their targets are published.
const TYPES = ['post', 'blog', 'memory', 'event', 'poll', 'comment'];

// Publishes content that is still PENDING only because it was waiting for the
// admin approval that no longer exists.
//
// Deliberately left alone:
//   • REJECTED items — an administrator explicitly refused them;
//   • items whose owner is suspended or no longer exists;
//   • comments on something that is itself not published.
//
// The original submission time becomes the publication time, so old items do
// not jump to the top of the feeds, and no notifications are sent. The run is
// idempotent: a second run finds nothing left to do.
// With `apply: false` (the default) nothing is written — the counts say what would happen.
async function publishPendingContent({ apply = false } = {}) {
  const active = new Set(
    (await User.find({ status: ACCOUNT_STATUS.ACTIVE }).select('_id').lean()).map((u) => String(u._id))
  );
  const report = {};

  for (const type of TYPES) {
    const { Model, ownerField } = content.entry(type);
    const pending = await Model.find({ moderationStatus: MODERATION.PENDING });
    const counts = { pending: pending.length, published: 0, skippedOwner: 0, skippedTarget: 0 };

    for (const doc of pending) {
      if (!active.has(String(doc[ownerField]))) {
        counts.skippedOwner += 1;
        continue;
      }
      let target = null;
      if (type === 'comment') {
        target = content.entry(doc.targetType).Model;
        if (!(await target.exists({ _id: doc.target, moderationStatus: MODERATION.APPROVED }))) {
          counts.skippedTarget += 1;
          continue;
        }
      }
      counts.published += 1;
      if (!apply) continue;

      // Compare-and-set, so a run that overlaps another never publishes (or counts) twice.
      const changed = await Model.updateOne(
        { _id: doc._id, moderationStatus: MODERATION.PENDING },
        { $set: { moderationStatus: MODERATION.APPROVED, publishedAt: doc.submittedAt || doc.createdAt || new Date() } }
      );
      if (target && changed.modifiedCount === 1) await target.updateOne({ _id: doc.target }, { $inc: { commentCount: 1 } });
    }
    report[type] = counts;
  }
  return report;
}

module.exports = { publishPendingContent };
