const ApiError = require('../utils/ApiError');
const { MODERATION } = require('../config/constants');
const content = require('./content.service');
const { notify, notifyAllDoctors } = require('./notification.service');
const { audit } = require('./audit.service');

// Approves or rejects a submission. Only ever called from admin-guarded routes.
// The status change is a compare-and-set, so two simultaneous reviews cannot
// double-count comments or send duplicate notifications.
async function review({ type, id, action, reason = '', admin }) {
  const { Model, label } = content.entry(type);
  const nextStatus = action === 'approve' ? MODERATION.APPROVED : MODERATION.REJECTED;

  const before = await Model.findById(id);
  if (!before) throw ApiError.notFound(`That ${label} could not be found.`);
  if (before.moderationStatus === nextStatus) return before; // already in that state

  const now = new Date();
  const update = {
    moderationStatus: nextStatus,
    reviewedAt: now,
    reviewedBy: admin._id,
    rejectionReason: nextStatus === MODERATION.REJECTED ? reason : '',
  };
  if (nextStatus === MODERATION.APPROVED && !before.publishedAt) update.publishedAt = now;

  const doc = await Model.findOneAndUpdate(
    { _id: id, moderationStatus: before.moderationStatus },
    { $set: update },
    { returnDocument: 'after' }
  );
  if (!doc) throw ApiError.conflict('This item was just updated by someone else. Please refresh.');

  // Keep the denormalised approved-comment counter in step.
  if (type === 'comment') {
    const wasApproved = before.moderationStatus === MODERATION.APPROVED;
    const isApproved = nextStatus === MODERATION.APPROVED;
    if (wasApproved !== isApproved) {
      const target = content.entry(doc.targetType).Model;
      if (isApproved) await target.updateOne({ _id: doc.target }, { $inc: { commentCount: 1 } });
      else await target.updateOne({ _id: doc.target, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
    }
  }

  const ownerId = content.ownerId(type, doc);
  const link = await content.linkFor(type, doc);
  const title = content.titleOf(type, doc);

  if (ownerId && ownerId !== String(admin._id)) {
    if (nextStatus === MODERATION.APPROVED) {
      await notify(ownerId, {
        type: 'CONTENT_APPROVED',
        title: `Your ${label} was approved`,
        message: title ? `“${title}” is now visible to the community.` : 'It is now visible to the community.',
        link,
      });
    } else {
      await notify(ownerId, {
        type: 'CONTENT_REJECTED',
        title: `Your ${label} was not approved`,
        message: reason ? `Reason: ${reason}` : 'You can edit it and submit it again from your dashboard.',
        link: '/dashboard/submissions',
      });
    }
  }

  if (nextStatus === MODERATION.APPROVED) {
    if (type === 'event') {
      await notifyAllDoctors(
        {
          type: 'EVENT_PUBLISHED',
          title: doc.eventType === 'VISIT_PLAN' ? 'New visit plan shared' : 'New community event',
          message: `${doc.title} — ${doc.city}`,
          link,
          dedupeKey: `event-published:${doc._id}`,
        },
        ownerId
      );
    } else if (type === 'poll') {
      await notifyAllDoctors(
        {
          type: 'POLL_PUBLISHED',
          title: 'A new poll is open',
          message: doc.question,
          link,
          dedupeKey: `poll-published:${doc._id}`,
        },
        ownerId
      );
    } else if (type === 'comment') {
      const target = await content.entry(doc.targetType).Model.findById(doc.target);
      const targetOwner = target ? content.ownerId(doc.targetType, target) : null;
      if (targetOwner && targetOwner !== ownerId) {
        await notify(targetOwner, {
          type: 'NEW_COMMENT',
          title: `New comment on your ${content.entry(doc.targetType).label}`,
          message: title,
          link,
          dedupeKey: `comment:${doc._id}`,
        });
      }
    }
  }

  await audit(admin, {
    action: nextStatus === MODERATION.APPROVED ? 'CONTENT_APPROVED' : 'CONTENT_REJECTED',
    targetType: type,
    targetId: doc._id,
    summary: `${nextStatus === MODERATION.APPROVED ? 'Approved' : 'Rejected'} ${label}: ${title}`,
    metadata: { ownerId, reason: nextStatus === MODERATION.REJECTED ? reason : undefined },
  });

  return doc;
}

// Admin removal of any item, including previously approved content.
async function removeAsAdmin({ type, id, admin, reason = '' }) {
  const { Model, label } = content.entry(type);
  const doc = await Model.findById(id);
  if (!doc) throw ApiError.notFound(`That ${label} could not be found.`);

  const ownerId = content.ownerId(type, doc);
  const title = content.titleOf(type, doc);
  await content.deleteContent(type, doc);

  if (ownerId && ownerId !== String(admin._id)) {
    await notify(ownerId, {
      type: 'CONTENT_REMOVED',
      title: `Your ${label} was removed by an administrator`,
      message: reason ? `Reason: ${reason}` : title,
      link: '/community-guidelines',
    });
  }
  await audit(admin, {
    action: 'CONTENT_DELETED',
    targetType: type,
    targetId: id,
    summary: `Deleted ${label}: ${title}`,
    metadata: { ownerId, reason: reason || undefined },
  });
}

module.exports = { review, removeAsAdmin };
