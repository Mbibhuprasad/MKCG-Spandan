const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User');
const { ROLES, ACCOUNT_STATUS, POLICY_VERSION } = require('../config/constants');
const { getEnv } = require('../config/env');
const { email, phone } = require('../validators/auth.validators');
const { line } = require('../validators/common');
const { endAllSessions } = require('./session.service');
const { audit } = require('./audit.service');

const PLACEHOLDERS = ['replace-with-a-strong-admin-password', 'changeme', 'password', 'admin'];

const adminPassword = z
  .string()
  .min(12, 'must be at least 12 characters long')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'must be at most 72 characters long')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'must contain letters and numbers')
  .refine((v) => !PLACEHOLDERS.includes(v.toLowerCase()), 'must not be a placeholder value');

class BootstrapError extends Error {}

function read(schema, source) {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Names and reasons only — values (including the password) are never printed.
    const problems = result.error.issues.map((i) => `  - ${i.path.join('.') || 'value'}: ${i.message}`).join('\n');
    throw new BootstrapError(`Admin configuration is incomplete or invalid:\n${problems}`);
  }
  return result.data;
}

// Creates the initial administrator from ADMIN_* environment variables.
// Idempotent: if an administrator already exists nothing is changed — in
// particular an existing admin's password is never reset by this command.
async function createInitialAdmin(source = process.env) {
  const existingAdmin = await User.findOne({ role: ROLES.ADMIN }).select('email');
  if (existingAdmin) return { created: false, reason: 'ADMIN_EXISTS' };

  const config = read(
    z.object({
      ADMIN_NAME: line(2, 80, 'ADMIN_NAME'),
      ADMIN_EMAIL: email,
      ADMIN_PHONE: phone,
      ADMIN_PASSWORD: adminPassword,
    }),
    {
      ADMIN_NAME: source.ADMIN_NAME ?? '',
      ADMIN_EMAIL: source.ADMIN_EMAIL ?? '',
      ADMIN_PHONE: source.ADMIN_PHONE ?? '',
      ADMIN_PASSWORD: source.ADMIN_PASSWORD ?? '',
    }
  );

  const clash = await User.findOne({ $or: [{ email: config.ADMIN_EMAIL }, { phone: config.ADMIN_PHONE }] }).select('_id');
  if (clash) {
    throw new BootstrapError(
      'ADMIN_EMAIL or ADMIN_PHONE is already used by an existing (non-admin) account. Choose different values; accounts are never promoted automatically.'
    );
  }

  const passwordHash = await bcrypt.hash(config.ADMIN_PASSWORD, getEnv().bcryptRounds);
  const admin = await User.create({
    role: ROLES.ADMIN,
    status: ACCOUNT_STATUS.ACTIVE,
    name: config.ADMIN_NAME,
    email: config.ADMIN_EMAIL,
    phone: config.ADMIN_PHONE,
    passwordHash,
    policyAcceptance: { version: POLICY_VERSION, acceptedAt: new Date() },
    visibility: { directory: false, publicListing: false, showEmail: false, showPhone: false },
  });
  await audit(null, { action: 'ADMIN_BOOTSTRAPPED', targetType: 'admin', targetId: admin._id, summary: 'Initial administrator created' });
  return { created: true, id: String(admin._id) };
}

// Explicit, deliberate password rotation for the administrator in ADMIN_EMAIL.
async function rotateAdminPassword(source = process.env) {
  const config = read(z.object({ ADMIN_EMAIL: email, ADMIN_PASSWORD: adminPassword }), {
    ADMIN_EMAIL: source.ADMIN_EMAIL ?? '',
    ADMIN_PASSWORD: source.ADMIN_PASSWORD ?? '',
  });
  const admin = await User.findOne({ email: config.ADMIN_EMAIL, role: ROLES.ADMIN });
  if (!admin) throw new BootstrapError('No administrator account matches ADMIN_EMAIL.');

  admin.passwordHash = await bcrypt.hash(config.ADMIN_PASSWORD, getEnv().bcryptRounds);
  admin.passwordChangedAt = new Date();
  await admin.save();
  await endAllSessions(admin._id); // every existing admin session is signed out
  await audit(admin, { action: 'ADMIN_PASSWORD_ROTATED', targetType: 'admin', targetId: admin._id, summary: 'Administrator password rotated via CLI' });
  return { rotated: true };
}

module.exports = { createInitialAdmin, rotateAdminPassword, BootstrapError };
