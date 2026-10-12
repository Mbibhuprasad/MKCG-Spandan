const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Session = require('../models/Session');
const { getEnv } = require('../config/env');
const realtime = require('../realtime/hub');

const DAY_MS = 24 * 60 * 60 * 1000;

function signToken(userId, sessionId) {
  const env = getEnv();
  return jwt.sign({ sub: String(userId), sid: String(sessionId) }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${env.sessionDays}d`,
  });
}

function verifyToken(token) {
  return jwt.verify(token, getEnv().jwtSecret, { algorithms: ['HS256'] });
}

// The CSRF token is an HMAC of the session id, so it is bound to one session
// and needs no extra server-side storage.
function csrfTokenFor(sessionId) {
  return crypto.createHmac('sha256', getEnv().jwtSecret).update(`csrf:${sessionId}`).digest('hex');
}

function csrfTokenMatches(sessionId, provided) {
  if (typeof provided !== 'string' || !provided) return false;
  const expected = Buffer.from(csrfTokenFor(sessionId));
  const actual = Buffer.from(provided);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function cookieOptions() {
  const { cookie, sessionDays } = getEnv();
  return {
    httpOnly: true,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    domain: cookie.domain,
    path: '/',
    maxAge: sessionDays * DAY_MS,
  };
}

function isMobileClient(req) {
  return String(req.get('x-client-type') || '').toLowerCase() === 'mobile';
}

// Creates a server-side session and delivers the credential:
//  - web: httpOnly cookie (token never exposed to JavaScript)
//  - mobile (X-Client-Type: mobile): bearer token in the response body
async function startSession(req, res, user) {
  const env = getEnv();
  const mobile = isMobileClient(req);
  const session = await Session.create({
    user: user._id,
    client: mobile ? 'mobile' : 'web',
    userAgent: String(req.get('user-agent') || '').slice(0, 200),
    expiresAt: new Date(Date.now() + env.sessionDays * DAY_MS),
  });
  const token = signToken(user._id, session._id);
  const result = { csrfToken: csrfTokenFor(session._id), expiresAt: session.expiresAt };
  if (mobile) {
    result.token = token;
  } else {
    res.cookie(env.cookie.name, token, cookieOptions());
  }
  return result;
}

function clearSessionCookie(res) {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(getEnv().cookie.name, options);
}

async function endSession(sessionId) {
  await Session.deleteOne({ _id: sessionId });
  realtime.dropSession(sessionId); // open chat connections end with the session
}

async function endAllSessions(userId, exceptSessionId) {
  const filter = { user: userId };
  if (exceptSessionId) filter._id = { $ne: exceptSessionId };
  await Session.deleteMany(filter);
  realtime.dropUser(userId, exceptSessionId);
}

module.exports = {
  verifyToken,
  csrfTokenFor,
  csrfTokenMatches,
  startSession,
  clearSessionCookie,
  endSession,
  endAllSessions,
};
