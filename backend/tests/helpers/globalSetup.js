const { MongoMemoryServer } = require('mongodb-memory-server');

// One real (in-memory) MongoDB server for the whole test run. Each test file
// then uses its own database on it — see tests/helpers/env.js.
module.exports = async function globalSetup() {
  const mongod = await MongoMemoryServer.create();
  globalThis.__MONGOD__ = mongod;
  process.env.TEST_MONGO_BASE_URI = mongod.getUri();
};
