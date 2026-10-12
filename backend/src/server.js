const logger = require('./utils/logger');

async function start() {
  // Validate configuration before anything else; a bad .env stops the boot.
  const { getEnv } = require('./config/env');
  const env = getEnv();

  const { connectDatabase, disconnectDatabase } = require('./config/db');
  const { createApp } = require('./app');
  const { startJobs } = require('./services/jobs.service');
  const { attachRealtime, closeRealtime } = require('./realtime/gateway');

  await connectDatabase(env.mongoUri);
  const app = createApp();

  if (!env.cloudinary.configured) {
    logger.warn('Cloudinary is not configured — media uploads will return 503 until CLOUDINARY_* variables are set.');
  }

  const server = app.listen(env.port, () => {
    logger.info(`MKCGSPANDAN API listening on port ${env.port} (${env.nodeEnv})`);
  });
  // Real-time chat shares the HTTP server and port (path /socket.io).
  const io = attachRealtime(server);
  const stopJobs = env.jobsEnabled ? startJobs() : () => {};

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received — shutting down`);
    stopJobs();
    await closeRealtime(io).catch(() => {});
    server.close(async () => {
      await disconnectDatabase().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason && reason.stack ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err && err.stack ? err.stack : err);
  process.exit(1);
});

if (require.main === module) {
  start().catch((err) => {
    logger.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { start };
