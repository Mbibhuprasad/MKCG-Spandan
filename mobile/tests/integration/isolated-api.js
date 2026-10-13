/* eslint-disable no-console */
// Launcher for an ISOLATED copy of the MKCGSPANDAN API, used only to test the
// mobile app (npm run test:api-server). It never touches the real database or Cloudinary:
//   • every variable backend/.env defines is pinned here first (dotenv does
//     not override variables that already exist);
//   • MongoDB is an in-memory server that disappears when this process stops;
//   • the Cloudinary SDK is replaced by a stand-in that keeps uploaded files in
//     memory and serves them back over HTTP, so the app can show what it uploaded.
// Usage: node isolated-api.js [api port] [media port] [media host]
//   media host = how the phone reaches this computer (10.0.2.2 from the Android emulator)
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Writable } = require('stream');

const backend = path.resolve(__dirname, '../../../backend');
const API_PORT = process.argv[2] || '5100';
const MEDIA_PORT = Number(process.argv[3] || 5101);
const MEDIA_HOST = process.argv[4] || '10.0.2.2'; // how the Android emulator reaches this computer

Object.assign(process.env, {
  NODE_ENV: 'development',
  PORT: API_PORT,
  MONGODB_URI: 'mongodb://placeholder/replaced-below',
  JWT_SECRET: crypto.randomBytes(48).toString('hex'),
  JWT_EXPIRES_IN_DAYS: '7',
  FRONTEND_URL: 'http://localhost:3100',
  COOKIE_NAME: 'mkcg_session',
  COOKIE_SAMESITE: 'lax',
  COOKIE_SECURE: 'false',
  COOKIE_DOMAIN: '',
  TRUST_PROXY: 'false',
  ADMIN_NAME: 'Test Admin',
  ADMIN_EMAIL: 'admin@test.invalid',
  ADMIN_PHONE: '+910000000001',
  ADMIN_PASSWORD: 'IsolatedAdmin2026',
  ADMIN_REGISTER_KEY: '',
  CLOUDINARY_CLOUD_NAME: 'isolated-test',
  CLOUDINARY_API_KEY: 'isolated-key',
  CLOUDINARY_API_SECRET: 'isolated-secret',
  CLOUDINARY_FOLDER: 'isolated',
  MAX_IMAGE_MB: '8',
  MAX_VIDEO_MB: '60',
  DEFAULT_COUNTRY_CODE: '91',
  BCRYPT_ROUNDS: '4',
  JOBS_ENABLED: 'false',
  RATE_LIMIT_GLOBAL_MAX: '100000',
  RATE_LIMIT_LOGIN_MAX: '1000',
  RATE_LIMIT_REGISTER_MAX: '1000',
  RATE_LIMIT_WRITE_MAX: '5000',
  RATE_LIMIT_UPLOAD_MAX: '1000',
  RATE_LIMIT_CHAT_MAX: process.env.TEST_CHAT_MAX || '60',
});

/* ── Stand-in for the Cloudinary SDK ── */
const assets = new Map(); // publicId → { buffer, resourceType }
let counter = 0;
const mediaUrl = (publicId) => `http://${MEDIA_HOST}:${MEDIA_PORT}/m/${encodeURIComponent(publicId)}`;
const cloudinaryMock = {
  v2: {
    config() {},
    uploader: {
      upload_stream(options, callback) {
        const chunks = [];
        return new Writable({
          write(chunk, _enc, done) {
            chunks.push(chunk);
            done();
          },
          final(done) {
            done();
            counter += 1;
            const buffer = Buffer.concat(chunks);
            const publicId = `${options.folder}/asset_${counter}`;
            assets.set(publicId, { buffer, resourceType: options.resource_type });
            console.log(`[media] stored ${publicId} (${buffer.length} bytes, ${options.resource_type}, ${options.type})`);
            callback(null, {
              public_id: publicId,
              resource_type: options.resource_type,
              type: options.type,
              format: options.resource_type === 'video' ? 'mp4' : buffer[0] === 0x89 ? 'png' : buffer[0] === 0xff ? 'jpg' : 'webp',
              bytes: buffer.length,
              width: 1200,
              height: 900,
              duration: options.resource_type === 'video' ? 3 : undefined,
            });
          },
        });
      },
      async destroy(publicId) {
        assets.delete(publicId);
        console.log(`[media] destroyed ${publicId}`);
        return { result: 'ok' };
      },
    },
    url: (publicId) => mediaUrl(publicId),
    utils: { private_download_url: (publicId) => mediaUrl(publicId) },
  },
};
const cloudinaryPath = require.resolve('cloudinary', { paths: [backend] });
require.cache[cloudinaryPath] = { id: cloudinaryPath, filename: cloudinaryPath, loaded: true, exports: cloudinaryMock, children: [], paths: [] };

http
  .createServer((req, res) => {
    const match = /^\/m\/([^?]+)/.exec(req.url || '');
    const asset = match ? assets.get(decodeURIComponent(match[1])) : null;
    if (!asset) {
      res.writeHead(404).end();
      return;
    }
    const b = asset.buffer;
    const type = asset.resourceType === 'video' ? 'video/mp4' : b[0] === 0x89 ? 'image/png' : b[0] === 0xff ? 'image/jpeg' : 'image/webp';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': b.length, 'Cache-Control': 'max-age=3600' });
    res.end(b);
  })
  .listen(MEDIA_PORT, () => console.log(`[media] stand-in media host on :${MEDIA_PORT} (URLs use ${MEDIA_HOST})`));

(async () => {
  const { MongoMemoryServer } = require(require.resolve('mongodb-memory-server', { paths: [backend] }));
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('mkcg_isolated');
  console.log('[api] in-memory MongoDB started');
  const { start } = require(path.join(backend, 'src/server.js'));
  await start();
  const { createInitialAdmin } = require(path.join(backend, 'src/services/adminBootstrap.service.js'));
  await createInitialAdmin(process.env).catch((err) => console.warn('[api] admin bootstrap:', err.message));
  console.log(`[api] READY on :${API_PORT}`);
  const stop = async () => {
    await mongod.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch((err) => {
  console.error('[api] failed to start:', err);
  process.exit(1);
});
