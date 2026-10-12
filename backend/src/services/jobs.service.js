const Event = require('../models/Event');
const Rsvp = require('../models/Rsvp');
const logger = require('../utils/logger');
const { MODERATION } = require('../config/constants');
const { notifyMany } = require('./notification.service');
const { cleanupOrphans } = require('./media.service');

const HOUR = 60 * 60 * 1000;

// Reminds members who RSVP'd (and the organiser) about events starting within
// the next 48 hours. The dedupe key means a reminder is delivered at most once.
async function sendEventReminders(now = new Date()) {
  const soon = new Date(now.getTime() + 48 * HOUR);
  const events = await Event.find({
    moderationStatus: MODERATION.APPROVED,
    startsAt: { $gt: now, $lte: soon },
    reminderSentAt: null,
  }).limit(100);

  for (const event of events) {
    const rsvps = await Rsvp.find({ event: event._id, status: { $in: ['GOING', 'MAYBE'] } }).select('user').lean();
    const recipients = [...new Set([String(event.organizer), ...rsvps.map((r) => String(r.user))])];
    await notifyMany(recipients, {
      type: 'EVENT_REMINDER',
      title: 'Event coming up soon',
      message: `${event.title} — ${event.city}`,
      link: `/events/${event._id}`,
      dedupeKey: `event-reminder:${event._id}:${event.startsAt.getTime()}`,
    });
    await Event.updateOne({ _id: event._id }, { $set: { reminderSentAt: now } });
  }
  return events.length;
}

function safely(name, fn) {
  return async () => {
    try {
      await fn();
    } catch (err) {
      logger.error(`Background job "${name}" failed:`, err.message);
    }
  };
}

// In-process timers are enough for a single API instance. With several
// instances the jobs remain safe to run concurrently because they are idempotent.
function startJobs() {
  const timers = [
    setInterval(safely('event-reminders', () => sendEventReminders()), 30 * 60 * 1000),
    setInterval(safely('orphan-media-cleanup', () => cleanupOrphans()), 6 * HOUR),
  ];
  timers.forEach((t) => t.unref());
  setTimeout(safely('event-reminders', () => sendEventReminders()), 15 * 1000).unref();
  return () => timers.forEach(clearInterval);
}

module.exports = { sendEventReminders, startJobs };
