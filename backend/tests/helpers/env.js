// Runs before each test file is loaded. Values here are test fixtures only.
const crypto = require('crypto');

const base = process.env.TEST_MONGO_BASE_URI || 'mongodb://127.0.0.1:27017/';
const dbName = `mkcg_test_${crypto.randomBytes(6).toString('hex')}`;

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '5099',
  MONGODB_URI: `${base.replace(/\/?(\?.*)?$/, '')}/${dbName}`,
  JWT_SECRET: 'test-only-secret-test-only-secret-test-only-secret',
  JWT_EXPIRES_IN_DAYS: '7',
  FRONTEND_URL: 'http://localhost:3000',
  COOKIE_NAME: 'mkcg_session',
  COOKIE_SAMESITE: 'lax',
  TRUST_PROXY: 'loopback',
  CLOUDINARY_CLOUD_NAME: 'test-cloud',
  CLOUDINARY_API_KEY: 'test-key',
  CLOUDINARY_API_SECRET: 'test-cloudinary-secret-value',
  CLOUDINARY_FOLDER: 'mkcg-test',
  MAX_IMAGE_MB: '1',
  MAX_VIDEO_MB: '2',
  BCRYPT_ROUNDS: '4',
  // Generous by default so functional tests are not throttled; the rate-limit
  // tests override these before loading the app.
  RATE_LIMIT_GLOBAL_MAX: process.env.TEST_RATE_LIMIT_GLOBAL_MAX || '100000',
  RATE_LIMIT_LOGIN_MAX: process.env.TEST_RATE_LIMIT_LOGIN_MAX || '100000',
  RATE_LIMIT_REGISTER_MAX: process.env.TEST_RATE_LIMIT_REGISTER_MAX || '100000',
  RATE_LIMIT_WRITE_MAX: '100000',
  RATE_LIMIT_UPLOAD_MAX: '100000',
  RATE_LIMIT_CHAT_MAX: process.env.TEST_RATE_LIMIT_CHAT_MAX || '100000',
  JOBS_ENABLED: 'false',
  // Set explicitly (not deleted) so values from a developer's backend/.env,
  // which dotenv would otherwise load, can never change test behaviour.
  COOKIE_DOMAIN: '',
  COOKIE_SECURE: 'false',
  DEFAULT_COUNTRY_CODE: '91',
  TIME_ZONE: 'Asia/Kolkata',
});
