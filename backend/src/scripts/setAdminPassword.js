/* eslint-disable no-console */
// Usage: npm run admin:set-password -- --confirm
// Rotates the password of the administrator identified by ADMIN_EMAIL to the
// value of ADMIN_PASSWORD, and signs that administrator out everywhere.
const { getEnv } = require('../config/env');
const { connectDatabase, disconnectDatabase } = require('../config/db');
const { rotateAdminPassword, BootstrapError } = require('../services/adminBootstrap.service');

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('This replaces the administrator password. Re-run with --confirm to proceed:');
    console.error('  npm run admin:set-password -- --confirm');
    process.exit(1);
  }
  const env = getEnv();
  await connectDatabase(env.mongoUri);
  await rotateAdminPassword(process.env);
  console.log('Administrator password updated. All existing admin sessions were signed out.');
  console.log('Remove ADMIN_PASSWORD from backend/.env now that it has been applied.');
}

main()
  .then(() => disconnectDatabase())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err instanceof BootstrapError ? err.message : `Could not update the password: ${err.message}`);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
