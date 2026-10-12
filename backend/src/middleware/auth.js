const mongoose = require('mongoose');
const User = require('../models/User');
const Session = require('../models/Session');
const ApiError = require('../utils/ApiError');
const { getEnv } = require('../config/env');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');
const { verifyToken, csrfTokenMatches } = require('../services/session.service');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function readCredential(req) {
  const header = req.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) {
    const token = header.slice(7).trim();
    if (token) return { token, via: 'bearer' };
  }
  const cookieToken = req.cookies ? req.cookies[getEnv().cookie.name] : null;
  if (cookieToken) return { token: cookieToken, via: 'cookie' };
  return null;
}

// Resolves a session token to its user and session. The role and account
// status always come from the database — never from the token or the request.
// Shared by HTTP requests and the realtime (Socket.IO) gateway.
async function authenticateToken(token) {
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
  }
  if (!mongoose.isValidObjectId(payload.sub) || !mongoose.isValidObjectId(payload.sid)) {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
  }

  const session = await Session.findOne({ _id: payload.sid, user: payload.sub, expiresAt: { $gt: new Date() } });
  if (!session) throw ApiError.unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');

  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw ApiError.forbidden(
      'Your account has been suspended. Please contact the community administrator.',
      'ACCOUNT_SUSPENDED'
    );
  }

  return { user, session };
}

async function resolveAuth(req, { enforceCsrf = true } = {}) {
  const credential = readCredential(req);
  if (!credential) throw ApiError.unauthorized();

  const { user, session } = await authenticateToken(credential.token);

  // Cookie sessions are ambient credentials, so state-changing requests must
  // also present the session-bound CSRF token. Bearer tokens are not ambient.
  if (enforceCsrf && credential.via === 'cookie' && !SAFE_METHODS.has(req.method)) {
    if (!csrfTokenMatches(session._id, req.get('x-csrf-token'))) {
      throw ApiError.forbidden('Security check failed. Please refresh the page and try again.', 'CSRF_INVALID');
    }
  }

  return { user, session, via: credential.via };
}

async function requireAuth(req, _res, next) {
  const { user, session, via } = await resolveAuth(req);
  req.user = user;
  req.session = session;
  req.authVia = via;
  next();
}

// For public endpoints that show extra data to signed-in members.
async function optionalAuth(req, _res, next) {
  try {
    const { user, session, via } = await resolveAuth(req);
    req.user = user;
    req.session = session;
    req.authVia = via;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'CSRF_INVALID') throw err;
    if (!(err instanceof ApiError)) throw err;
    req.user = null;
  }
  next();
}

// Session probe for GET /auth/session: never fails. The outcome (signed in,
// signed out, or suspended) is reported in the response body instead, so a
// signed-out visitor does not produce a failed request on every page load.
async function probeSession(req, _res, next) {
  try {
    const { user, session } = await resolveAuth(req, { enforceCsrf: false });
    req.user = user;
    req.session = session;
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    req.user = null;
    req.session = null;
    req.authFailure = err;
  }
  next();
}

// Logout only. It must always succeed in clearing the cookie, so it does not
// demand the CSRF token (the Origin check still blocks cross-site requests,
// and the worst a forged logout could do is sign someone out).
async function sessionForLogout(req, _res, next) {
  try {
    const { user, session } = await resolveAuth(req, { enforceCsrf: false });
    req.user = user;
    req.session = session;
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    req.user = null;
    req.session = null;
  }
  next();
}

function requireRole(...roles) {
  return function roleGuard(req, _res, next) {
    if (!req.user) throw ApiError.unauthorized();
    if (!roles.includes(req.user.role)) throw ApiError.forbidden();
    next();
  };
}

const requireAdmin = requireRole(ROLES.ADMIN);

const isAdmin = (user) => Boolean(user && user.role === ROLES.ADMIN);

module.exports = { authenticateToken, requireAuth, optionalAuth, probeSession, sessionForLogout, requireRole, requireAdmin, isAdmin };
