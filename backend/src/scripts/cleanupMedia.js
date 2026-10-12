/* eslint-disable no-console */
// Usage: npm run media:cleanup
// Deletes uploads that were never attached to any content (older than 24 hours)
// from both Cloudinary and MongoDB. The server also does this periodically.
const { getEnv } = require('../config/env');
const { connectDatabase, disconnectDatabase } = require('../config/db');
const { cleanupOrphans } = require('../services/media.service');

async function main() {
  const env = getEnv();
  if (!env.cloudinary.configured) throw new Error('Cloudinary is not configured.');
  await connectDatabase(env.mongoUri);
  const removed = await cleanupOrphans();
  console.log(`Removed ${removed} orphaned upload(s).`);
}

main()
  .then(() => disconnectDatabase())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(`Cleanup failed: ${err.message}`);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
