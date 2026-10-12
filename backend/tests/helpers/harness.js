const mongoose = require('mongoose');
const request = require('supertest');

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Reunion2026pass';
const ADMIN_PASSWORD = 'AdminBootstrap2026';

let counter = 0;

// Connects to the per-file test database and builds every index up front, so
// uniqueness constraints are really enforced during the tests.
function setupTestApp() {
  const ctx = { app: null };

  beforeAll(async () => {
    const { getEnv } = require('../../src/config/env');
    const { createApp } = require('../../src/app');
    // The MongoDB driver loads its `os` adapter with a dynamic import(), which
    // Jest's CommonJS sandbox cannot execute. Supplying the adapter explicitly
    // (a supported driver option) avoids that; production code is unaffected.
    await mongoose.connect(getEnv().mongoUri, { runtimeAdapters: { os: require('os') } });
    for (const file of ['User', 'Session', 'Media', 'Post', 'Blog', 'Comment', 'Like', 'Memory', 'Event', 'Rsvp', 'Poll', 'Vote', 'Notification', 'AuditLog', 'Report']) {
      await require(`../../src/models/${file}`).init();
    }
    ctx.app = createApp();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  return ctx;
}

// A browser-like client: keeps cookies, sends the Origin header and attaches
// the CSRF token to state-changing requests.
function createClient(app) {
  const agent = request.agent(app);
  const client = {
    agent,
    csrf: '',
    user: null,
    get: (url) => agent.get(url),
    post: (url, body) => agent.post(url).set('Origin', ORIGIN).set('X-CSRF-Token', client.csrf).send(body),
    put: (url, body) => agent.put(url).set('Origin', ORIGIN).set('X-CSRF-Token', client.csrf).send(body),
    patch: (url, body) => agent.patch(url).set('Origin', ORIGIN).set('X-CSRF-Token', client.csrf).send(body),
    delete: (url, body) => agent.delete(url).set('Origin', ORIGIN).set('X-CSRF-Token', client.csrf).send(body),
    upload: (purpose, buffer, filename = 'photo.png', contentType = 'image/png') =>
      agent
        .post('/api/v1/media')
        .set('Origin', ORIGIN)
        .set('X-CSRF-Token', client.csrf)
        .field('purpose', purpose)
        .attach('file', buffer, { filename, contentType }),
  };
  return client;
}

function doctorPayload(overrides = {}) {
  counter += 1;
  const n = `${Date.now() % 100000}${counter}`.padStart(8, '0').slice(-8);
  return {
    name: `Dr Test ${counter}`,
    email: `doctor${counter}.${n}@example.com`,
    phone: `98${n}`,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    acceptPolicies: true,
    ...overrides,
  };
}

async function registerDoctor(app, overrides = {}) {
  const client = createClient(app);
  const payload = doctorPayload(overrides);
  const res = await client.post('/api/v1/auth/register', payload);
  if (res.status !== 201) throw new Error(`Registration failed in test setup: ${res.status} ${JSON.stringify(res.body)}`);
  client.csrf = res.body.data.csrfToken;
  client.user = res.body.data.user;
  client.credentials = { email: payload.email, phone: payload.phone, password: payload.password };
  return client;
}

async function loginAs(app, identifier, password) {
  const client = createClient(app);
  const res = await client.post('/api/v1/auth/login', { identifier, password });
  if (res.status !== 200) throw new Error(`Login failed in test setup: ${res.status} ${JSON.stringify(res.body)}`);
  client.csrf = res.body.data.csrfToken;
  client.user = res.body.data.user;
  return client;
}

const ADMIN_ENV = {
  ADMIN_NAME: 'Test Admin',
  ADMIN_EMAIL: 'admin.test@example.com',
  ADMIN_PHONE: '+919000000001',
  ADMIN_PASSWORD,
};

async function createAdmin(app) {
  const { createInitialAdmin } = require('../../src/services/adminBootstrap.service');
  await createInitialAdmin(ADMIN_ENV);
  return loginAs(app, ADMIN_ENV.ADMIN_EMAIL, ADMIN_PASSWORD);
}

/* ── File fixtures: real signatures, tiny payloads ── */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]), Buffer.alloc(64)]);
const MP4 = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(64)]);
// A Windows executable header — what an attacker might rename to "photo.png".
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(128)]);

const inFuture = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const LONG_BODY =
  'Reconnecting with batchmates after many years reminded me how much of our training we shared. ' +
  'This article reflects on the habits from those years that still shape my practice today, ' +
  'and on why staying in touch with the people who knew us as students matters so much.';

module.exports = {
  ORIGIN,
  PASSWORD,
  ADMIN_PASSWORD,
  ADMIN_ENV,
  setupTestApp,
  createClient,
  doctorPayload,
  registerDoctor,
  loginAs,
  createAdmin,
  PNG,
  JPEG,
  MP4,
  EXE,
  inFuture,
  LONG_BODY,
};
