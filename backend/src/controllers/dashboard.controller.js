const Event = require('../models/Event');
const Rsvp = require('../models/Rsvp');
const Notification = require('../models/Notification');
const { ok } = require('../utils/respond');
const { MODERATION } = require('../config/constants');
const content = require('../services/content.service');
const { profileCompletion } = require('../services/serializers');

const OWNED = ['post', 'blog', 'comment', 'memory', 'event', 'poll'];

// Real figures for the doctor's dashboard: their own submissions by moderation
// status, unread notifications and upcoming events.
async function summary(req, res) {
  const userId = req.user._id;
  const now = new Date();

  const submissions = {};
  await Promise.all(
    OWNED.map(async (type) => {
      const { Model, ownerField } = content.entry(type);
      const rows = await Model.aggregate([
        { $match: { [ownerField]: userId } },
        { $group: { _id: '$moderationStatus', count: { $sum: 1 } } },
      ]);
      const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
      for (const row of rows) counts[row._id] = row.count;
      submissions[type] = { ...counts, total: counts.PENDING + counts.APPROVED + counts.REJECTED };
    })
  );

  const upcomingFilter = { moderationStatus: MODERATION.APPROVED, endsAt: { $gte: now } };
  const [unreadNotifications, upcomingEvents, upcomingIds] = await Promise.all([
    Notification.countDocuments({ user: userId, readAt: null }),
    Event.countDocuments(upcomingFilter),
    Event.find(upcomingFilter).select('_id').lean(),
  ]);
  const myUpcomingRsvps = await Rsvp.countDocuments({
    user: userId,
    status: 'GOING',
    event: { $in: upcomingIds.map((e) => e._id) },
  });

  const totals = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const type of OWNED) for (const key of Object.keys(totals)) totals[key] += submissions[type][key];

  return ok(res, {
    profileCompletion: profileCompletion(req.user),
    submissions,
    totals,
    unreadNotifications,
    upcomingEvents,
    myUpcomingRsvps,
  });
}

module.exports = { summary };
