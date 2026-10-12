/* eslint-disable no-console */
// Usage: npm run admin:create
// Creates the initial administrator from the ADMIN_* variables in backend/.env.
// Safe to run repeatedly: it never changes an existing administrator.
const { getEnv } = require('../config/env');
const { connectDatabase, disconnectDatabase } = require('../config/db');
const { createInitialAdmin, BootstrapError } = require('../services/adminBootstrap.service');
const User = require('../models/User');

async function main() {
  const env = getEnv();
  await connectDatabase(env.mongoUri);
  await User.init(); // make sure the unique indexes exist first

  const result = await createInitialAdmin(process.env);
  if (result.created) {
    console.log('Administrator account created. Sign in at /login with ADMIN_EMAIL and the password you configured.');
    console.log('You can now remove ADMIN_PASSWORD from backend/.env.');
  } else {
    console.log('An administrator account already exists. Nothing was changed.');
    console.log('To change the password, sign in and use Settings, or run: npm run admin:set-password -- --confirm');
  }
}

main()
  .then(() => disconnectDatabase())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err instanceof BootstrapError ? err.message : `Could not create the administrator: ${err.message}`);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
