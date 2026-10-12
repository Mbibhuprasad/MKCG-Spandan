const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/respond');
const { getEnv } = require('../config/env');
const { ROLES, ACCOUNT_STATUS, POLICY_VERSION } = require('../config/constants');
const { normalizeEmail, normalizePhone } = require('../utils/text');
const { serializeSelf } = require('../services/serializers');
const sessions = require('../services/session.service');
const { notify } = require('../services/notification.service');

const INVALID_CREDENTIALS = 'The email/phone number or password is incorrect.';

// Compared against when no account matches, so response time does not reveal
// whether an email or phone number is registered.
let dummyHashPromise;
function dummyHash() {
  if (!dummyHashPromise) dummyHashPromise = bcrypt.hash('not-a-real-password', getEnv().bcryptRounds);
  return dummyHashPromise;
}

function duplicateDetails(existing, { email, phone }) {
  const details = {};
  if (existing.some((u) => u.email === email)) details.email = 'An account with this email already exists.';
  if (existing.some((u) => u.phone === phone)) details.phone = 'An account with this phone number already exists.';
  return details;
}

async function register(req, res) {
  const { name, email, phone, password, specialization, city } = req.valid.body;

  const existing = await User.find({ $or: [{ email }, { phone }] }).select('email phone').lean();
  if (existing.length) {
    throw ApiError.conflict('An account with these details already exists.', duplicateDetails(existing, { email, phone }), 'ACCOUNT_EXISTS');
  }

  const passwordHash = await bcrypt.hash(password, getEnv().bcryptRounds);

  let user;
  try {
    user = await User.create({
      // Role and status are fixed by the server; nothing here comes from the client.
      role: ROLES.DOCTOR,
      status: ACCOUNT_STATUS.ACTIVE,
      name,
      email,
      phone,
      passwordHash,
      policyAcceptance: { version: POLICY_VERSION, acceptedAt: new Date() },
      profile: { specialization: specialization || '', city: city || '' },
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

  // The doctor is signed in immediately — there is no approval step.
  const session = await sessions.startSession(req, res, user);
  await notify(user._id, {
    type: 'WELCOME',
    title: 'Welcome to MKCGSPANDAN',
    message: 'Complete your doctor profile so batchmates can find and recognise you.',
    link: '/dashboard/profile',
    dedupeKey: 'welcome',
  });

  return created(res, { user: serializeSelf(user), ...session });
}

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

async function me(req, res) {
  return ok(res, { user: serializeSelf(req.user), csrfToken: sessions.csrfTokenFor(req.session._id) });
}

// Session restoration for the web app. Always answers 200:
//   { authenticated: true, user, csrfToken }  or  { authenticated: false, reason, message }
async function session(req, res) {
  if (req.user && req.session) {
    return ok(res, {
      authenticated: true,
      user: serializeSelf(req.user),
      csrfToken: sessions.csrfTokenFor(req.session._id),
    });
  }
  const suspended = req.authFailure && req.authFailure.code === 'ACCOUNT_SUSPENDED';
  if (req.authFailure && req.authFailure.code !== 'UNAUTHENTICATED') sessions.clearSessionCookie(res);
  return ok(res, {
    authenticated: false,
    reason: suspended ? 'ACCOUNT_SUSPENDED' : 'SIGNED_OUT',
    message: suspended ? req.authFailure.message : '',
  });
}

// Always clears the cookie, even if the session has already expired.
async function logout(req, res) {
  if (req.session) await sessions.endSession(req.session._id);
  sessions.clearSessionCookie(res);
  return ok(res, { loggedOut: true });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.valid.body;
  const user = await User.findById(req.user._id).select('+passwordHash');
  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw ApiError.badRequest('Your current password is incorrect.', { currentPassword: 'Incorrect password.' });
  }
  user.passwordHash = await bcrypt.hash(newPassword, getEnv().bcryptRounds);
  user.passwordChangedAt = new Date();
  await user.save();
  // Every other device is signed out.
  await sessions.endAllSessions(user._id, req.session._id);
  return ok(res, { changed: true });
}

module.exports = { register, login, me, session, logout, changePassword };
