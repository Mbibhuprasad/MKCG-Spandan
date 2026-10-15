const logger = require('../utils/logger');

const MINUTE = 60 * 1000;

// Render's free tier stops an instance after 15 minutes without inbound HTTP
// traffic. Requesting our own public /ping URL every few minutes counts as
// inbound traffic (it goes out and back through Render's proxy — a request to
// localhost would not), so the instance stays awake while it is running.
// It cannot wake an instance that is already asleep; an external monitor
// (UptimeRobot, cron-job.org) pointed at the same URL covers that case.
function startKeepAlive({ url, intervalMinutes }) {
  if (!url) return () => {};

  const ping = async () => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30 * 1000) });
      if (!res.ok) logger.warn(`Keep-alive ping to ${url} returned ${res.status}`);
    } catch (err) {
      logger.warn(`Keep-alive ping to ${url} failed: ${err.message}`);
    }
  };

  const timer = setInterval(ping, intervalMinutes * MINUTE);
  timer.unref();
  logger.info(`Keep-alive: pinging ${url} every ${intervalMinutes} min`);
  return () => clearInterval(timer);
}

module.exports = { startKeepAlive };
