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

const SOCKET_TICKET_TYPE = 'socket-ticket';
const SOCKET_TICKET_TTL_SECONDS = 60;

// Session tokens only. A socket ticket (below) is signed with the same key, so
// it is refused here: it can never be used as a bearer token for the REST API.
function verifyToken(token) {
  const payload = jwt.verify(token, getEnv().jwtSecret, { algorithms: ['HS256'] });
  if (payload.typ) throw new Error('Not a session token');
  return payload;
}

// The website's session lives in an httpOnly cookie that JavaScript cannot
// read, and the realtime gateway never reads cookies. To open a chat socket the
// page asks for a ticket: short-lived, bound to the session, usable once, and
// accepted only by the socket handshake.
function signSocketTicket(userId, sessionId) {
  return jwt.sign(
    { sub: String(userId), sid: String(sessionId), typ: SOCKET_TICKET_TYPE, jti: crypto.randomBytes(12).toString('hex') },
    getEnv().jwtSecret,
    { algorithm: 'HS256', expiresIn: SOCKET_TICKET_TTL_SECONDS }
  );
}

const usedTickets = new Map(); // jti → expiry (ms)

function verifySocketTicket(ticket) {
  const payload = jwt.verify(ticket, getEnv().jwtSecret, { algorithms: ['HS256'] });
  if (payload.typ !== SOCKET_TICKET_TYPE || !payload.jti) throw new Error('Not a socket ticket');
  const now = Date.now();
  for (const [jti, expiry] of usedTickets) if (expiry < now) usedTickets.delete(jti);
  if (usedTickets.has(payload.jti)) throw new Error('Socket ticket already used');
  usedTickets.set(payload.jti, payload.exp * 1000);
  return payload;
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
  SOCKET_TICKET_TTL_SECONDS,
  verifyToken,
  signSocketTicket,
  verifySocketTicket,
  csrfTokenFor,
  csrfTokenMatches,
  startSession,
  clearSessionCookie,
  endSession,
  endAllSessions,
};
