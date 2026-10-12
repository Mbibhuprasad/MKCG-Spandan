const ApiError = require('../utils/ApiError');
const content = require('./content.service');
const { notify, notifyAllDoctors } = require('./notification.service');
const { audit } = require('./audit.service');

// Tells the people concerned that something new has been published. Called
// right after the content is saved; notifications are best-effort and deduplicated.
async function announce(type, doc) {
  const ownerId = content.ownerId(type, doc);
  const link = await content.linkFor(type, doc);

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
        message: content.titleOf(type, doc),
        link,
        dedupeKey: `comment:${doc._id}`,
      });
    }
  }
}

// Admin removal of any item.
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

module.exports = { announce, removeAsAdmin };
