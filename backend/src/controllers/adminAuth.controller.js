const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/respond');
const { getEnv } = require('../config/env');
const { ROLES, ACCOUNT_STATUS, POLICY_VERSION } = require('../config/constants');
const { normalizeEmail, normalizePhone } = require('../utils/text');
const { serializeSelf } = require('../services/serializers');
const sessions = require('../services/session.service');
const { audit } = require('../services/audit.service');

const INVALID_CREDENTIALS = 'The email/phone number or password is incorrect.';

// Compared against when no account matches, so response time does not reveal
// whether an email or phone number belongs to an administrator.
let dummyHashPromise;
function dummyHash() {
  if (!dummyHashPromise) dummyHashPromise = bcrypt.hash('not-a-real-password', getEnv().bcryptRounds);
  return dummyHashPromise;
}

// Constant-time comparison of the submitted key with ADMIN_REGISTER_KEY.
function registrationKeyMatches(provided) {
  const expected = getEnv().adminRegisterKey;
  if (!expected) return false;
  const digest = (value) => crypto.createHash('sha256').update(value).digest();
  return crypto.timingSafeEqual(digest(expected), digest(provided));
}

function duplicateDetails(existing, { email, phone }) {
  const details = {};
  if (existing.some((u) => u.email === email)) details.email = 'An account with this email already exists.';
  if (existing.some((u) => u.phone === phone)) details.phone = 'An account with this phone number already exists.';
  return details;
}

// Creates an administrator. Only possible with the server's ADMIN_REGISTER_KEY;
// existing accounts are never promoted.
async function register(req, res) {
  const { name, email, phone, password, registrationKey } = req.valid.body;

  if (!getEnv().adminRegisterKey) {
    throw ApiError.forbidden('Admin registration is switched off on this server.', 'ADMIN_REGISTRATION_DISABLED');
  }
  if (!registrationKeyMatches(registrationKey)) {
    throw new ApiError(403, 'INVALID_REGISTRATION_KEY', 'The admin registration key is incorrect.', {
      registrationKey: 'This key is incorrect.',
    });
  }

  const existing = await User.find({ $or: [{ email }, { phone }] }).select('email phone').lean();
  if (existing.length) {
    throw ApiError.conflict('An account with these details already exists.', duplicateDetails(existing, { email, phone }), 'ACCOUNT_EXISTS');
  }

  const passwordHash = await bcrypt.hash(password, getEnv().bcryptRounds);

  let admin;
  try {
    admin = await User.create({
      // Role and status are fixed by the server; nothing here comes from the client.
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      name,
      email,
      phone,
      passwordHash,
      policyAcceptance: { version: POLICY_VERSION, acceptedAt: new Date() },
      visibility: { directory: false, publicListing: false, showEmail: false, showPhone: false },
      lastLoginAt: new Date(),
    });
  } catch (err) {
    if (err && err.code === 11000) {
      // Lost a race with a simultaneous registration: the unique indexes decide.
      const again = await User.find({ $or: [{ email }, { phone }] }).select('email phone').lean();
      throw ApiError.conflict('An account with these details already exists.', duplicateDetails(again, { email, phone }), 'ACCOUNT_EXISTS');
    }
    throw err;
  }

  await audit(admin, { action: 'ADMIN_REGISTERED', targetType: 'admin', targetId: admin._id, summary: 'Administrator registered with the registration key' });

  const session = await sessions.startSession(req, res, admin);
  return created(res, { user: serializeSelf(admin), ...session });
}

// Same credential check as the member login, but only administrators get a session.
async function login(req, res) {
  const { identifier, password } = req.valid.body;

  let query = null;
  if (identifier.includes('@')) {
    query = { email: normalizeEmail(identifier) };
  } else {
    const phone = normalizePhone(identifier);
    if (phone) query = { phone };
  }

  const user = query ? await User.findOne(query).select('+passwordHash') : null;
  const matches = await bcrypt.compare(password, user ? user.passwordHash : await dummyHash());
  if (!user || !matches) throw ApiError.unauthorized(INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');

  // Only said after the password was verified, so it reveals nothing to a stranger.
  if (user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('This account is not an administrator account. Please use the member login.', 'NOT_AN_ADMIN');
  }

  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw ApiError.forbidden(
      'Your account has been suspended. Please contact the community administrator.',
      'ACCOUNT_SUSPENDED'
    );
  }

  user.lastLoginAt = new Date();
  await user.save();

  const session = await sessions.startSession(req, res, user);
  return ok(res, { user: serializeSelf(user), ...session });
}

module.exports = { register, login };
