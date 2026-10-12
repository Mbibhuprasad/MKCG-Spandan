const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const bool = (fallback) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : ['1', 'true', 'yes'].includes(v.toLowerCase())));

const int = (fallback, min, max) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : Number(v)))
    .refine((n) => Number.isInteger(n) && n >= min && n <= max, `must be an integer between ${min} and ${max}`);

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: int(5000, 1, 65535),
  MONGODB_URI: z.string().min(1, 'is required').regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// or mongodb+srv:// URI'),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters long'),
  JWT_EXPIRES_IN_DAYS: int(7, 1, 90),
  FRONTEND_URL: z.string().min(1, 'is required'),
  COOKIE_NAME: z.string().default('mkcg_session'),
  COOKIE_DOMAIN: optionalString,
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: z.string().optional(),
  TRUST_PROXY: z.string().default('loopback'),
  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  CLOUDINARY_FOLDER: z.string().default('mkcgspandan'),
  MAX_IMAGE_MB: int(8, 1, 50),
  MAX_VIDEO_MB: int(60, 1, 500),
  DEFAULT_COUNTRY_CODE: z.string().regex(/^\d{1,3}$/).default('91'),
  BCRYPT_ROUNDS: int(12, 4, 15),
  RATE_LIMIT_GLOBAL_MAX: int(1500, 1, 1000000),
  RATE_LIMIT_LOGIN_MAX: int(10, 1, 1000000),
  RATE_LIMIT_REGISTER_MAX: int(10, 1, 1000000),
  RATE_LIMIT_WRITE_MAX: int(90, 1, 1000000),
  RATE_LIMIT_UPLOAD_MAX: int(40, 1, 1000000),
  JOBS_ENABLED: bool(true),
  // Secret that must accompany POST /admin-register. Unset = admin registration disabled.
  ADMIN_REGISTER_KEY: optionalString.refine((v) => v === undefined || v.length >= 16, 'must be at least 16 characters long'),
});

function loadEnv(source = process.env) {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    // Report variable names and reasons only — never echo values.
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}\nSee backend/.env.example.`);
  }
  const e = parsed.data;

  const frontendOrigins = e.FRONTEND_URL.split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  for (const origin of frontendOrigins) {
    try {
      const u = new URL(origin);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol');
    } catch {
      throw new Error('Invalid environment configuration:\n  - FRONTEND_URL: each origin must be a valid http(s) URL');
    }
  }

  const isProd = e.NODE_ENV === 'production';
  const cloudinaryConfigured = Boolean(e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET);
  if (isProd && !cloudinaryConfigured) {
    throw new Error(
      'Invalid environment configuration:\n  - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required in production'
    );
  }

  const cookieSecure =
    e.COOKIE_SECURE === undefined || e.COOKIE_SECURE === ''
      ? isProd
      : ['1', 'true', 'yes'].includes(e.COOKIE_SECURE.toLowerCase());
  if (e.COOKIE_SAMESITE === 'none' && !cookieSecure) {
    throw new Error('Invalid environment configuration:\n  - COOKIE_SAMESITE=none requires COOKIE_SECURE=true');
  }

  let trustProxy = e.TRUST_PROXY;
  if (/^\d+$/.test(trustProxy)) trustProxy = Number(trustProxy);
  else if (trustProxy === 'false') trustProxy = false;

  return Object.freeze({
    nodeEnv: e.NODE_ENV,
    isProd,
    isTest: e.NODE_ENV === 'test',
    port: e.PORT,
    mongoUri: e.MONGODB_URI,
    jwtSecret: e.JWT_SECRET,
    sessionDays: e.JWT_EXPIRES_IN_DAYS,
    frontendOrigins,
    cookie: Object.freeze({
      name: e.COOKIE_NAME,
      domain: e.COOKIE_DOMAIN,
      sameSite: e.COOKIE_SAMESITE,
      secure: cookieSecure,
    }),
    trustProxy,
    cloudinary: Object.freeze({
      configured: cloudinaryConfigured,
      cloudName: e.CLOUDINARY_CLOUD_NAME,
      apiKey: e.CLOUDINARY_API_KEY,
      apiSecret: e.CLOUDINARY_API_SECRET,
      folder: e.CLOUDINARY_FOLDER.replace(/^\/+|\/+$/g, ''),
    }),
    maxImageBytes: e.MAX_IMAGE_MB * 1024 * 1024,
    maxVideoBytes: e.MAX_VIDEO_MB * 1024 * 1024,
    defaultCountryCode: e.DEFAULT_COUNTRY_CODE,
    bcryptRounds: e.BCRYPT_ROUNDS,
    rateLimit: Object.freeze({
      globalMax: e.RATE_LIMIT_GLOBAL_MAX,
      loginMax: e.RATE_LIMIT_LOGIN_MAX,
      registerMax: e.RATE_LIMIT_REGISTER_MAX,
      writeMax: e.RATE_LIMIT_WRITE_MAX,
      uploadMax: e.RATE_LIMIT_UPLOAD_MAX,
    }),
    jobsEnabled: e.JOBS_ENABLED,
    adminRegisterKey: e.ADMIN_REGISTER_KEY,
  });
}

let cached;
function getEnv() {
  if (!cached) cached = loadEnv();
  return cached;
}

module.exports = { loadEnv, getEnv };
