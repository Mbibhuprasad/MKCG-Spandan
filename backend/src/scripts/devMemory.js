/* eslint-disable no-console */
// Usage: npm run dev:memory
// Development convenience only: runs the API against a local MongoDB binary
// managed by mongodb-memory-server, so you can try the app without installing
// MongoDB or creating an Atlas cluster. Data is kept in backend/.data/mongo.
// Never use this in production — set MONGODB_URI to a real deployment instead.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load backend/.env if it exists, then fill in what this mode can supply itself.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
  console.warn('JWT_SECRET is not set: using a temporary secret (everyone is signed out when this process restarts).');
}
if (!process.env.FRONTEND_URL) process.env.FRONTEND_URL = 'http://localhost:3000';

async function main() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const dbPath = path.resolve(__dirname, '../../.data/mongo');
  fs.mkdirSync(dbPath, { recursive: true });

  const mongod = await MongoMemoryServer.create({
    instance: { dbPath, storageEngine: 'wiredTiger', dbName: 'mkcgspandan' },
  });
  process.env.MONGODB_URI = mongod.getUri('mkcgspandan');
  console.log('Local development MongoDB started (data: backend/.data/mongo)');

  const stop = async () => {
    await mongod.stop({ doCleanup: false }).catch(() => {});
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  // Create the initial admin automatically when ADMIN_* variables are present.
  const { getEnv } = require('../config/env');
  getEnv();
  const { start } = require('../server');
  await start();

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const { createInitialAdmin } = require('../services/adminBootstrap.service');
    try {
      const result = await createInitialAdmin(process.env);
      if (result.created) console.log('Initial administrator created from ADMIN_* variables.');
    } catch (err) {
      console.warn(err.message);
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
