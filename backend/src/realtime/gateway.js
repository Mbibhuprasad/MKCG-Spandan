// Socket.IO gateway for real-time chat.
//
// Security model:
//   • A connection is accepted only with a valid session token (the same bearer
//     token the REST API issues). Cookies are not read here, so a web page on
//     another origin cannot open a socket with someone's ambient session.
//   • The server alone decides which rooms a socket is in: on connect it joins
//     the conversations the user is a member of. There is no "subscribe" event.
//   • Every incoming event is validated, re-checks the session, and goes
//     through chat.service — the same membership checks as the REST API.
const { Server } = require('socket.io');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { formatIssues } = require('../middleware/validate');
const v = require('../validators/chat.validators');
const chat = require('../services/chat.service');
const hub = require('./hub');

const MAX_SOCKETS_PER_USER = 5;

function failure(err) {
  if (err instanceof ApiError) {
    const error = { code: err.code, message: err.message };
    if (err.details) error.details = err.details;
    return { ok: false, error };
  }
  logger.error('Realtime handler failed:', err && err.stack ? err.stack : err);
  return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' } };
}

function parse(schema, payload) {
  const result = schema.safeParse(payload && typeof payload === 'object' ? payload : {});
  if (!result.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Please check your message.', formatIssues(result.error.issues));
  }
  return result.data;
}

// Wraps an event handler: only a callback-carrying, well-formed event from a
// still-valid session is processed; anything else is answered with an error or ignored.
function handle(socket, schema, action) {
  return async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const data = parse(schema, payload);
      // The session may have been ended since the socket connected.
      const { user } = await authenticateToken(socket.data.token);
      reply({ ok: true, ...(await action(user, data)) });
    } catch (err) {
      reply(failure(err));
      if (err instanceof ApiError && (err.status === 401 || err.code === 'ACCOUNT_SUSPENDED')) socket.disconnect(true);
    }
  };
}

function attachRealtime(httpServer) {
  const io = new Server(httpServer, {
    path: '/socket.io',
    serveClient: false,
    maxHttpBufferSize: 32 * 1024, // text messages only
    pingInterval: 25000,
    pingTimeout: 20000,
    cors: { origin: false },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (typeof token !== 'string' || !token) throw ApiError.unauthorized();
      const { user, session } = await authenticateToken(token);
      socket.data.token = token;
      socket.data.userId = String(user._id);
      socket.data.sessionId = String(session._id);
      next();
    } catch (err) {
      const error = new Error(err instanceof ApiError ? err.message : 'Connection refused.');
      error.data = { code: err instanceof ApiError ? err.code : 'INTERNAL_ERROR' };
      if (!(err instanceof ApiError)) logger.error('Realtime handshake failed:', err && err.stack ? err.stack : err);
      next(error);
    }
  });

  io.on('connection', async (socket) => {
    const { userId, sessionId } = socket.data;

    // Registered before the asynchronous setup below, so an event sent
    // straight after connecting is not lost.
    socket.on(
      'message:send',
      handle(socket, v.socketSend, async (user, data) => {
        const { message, duplicate } = await chat.sendMessage(user, data);
        return { message, duplicate };
      })
    );
    socket.on(
      'conversation:read',
      handle(socket, v.socketRead, (user, data) => chat.markRead(data.conversationId, user))
    );
    socket.on(
      'message:react',
      handle(socket, v.socketReact, (user, data) => chat.reactToMessage(user, data))
    );

    try {
      // Keep the number of simultaneous devices per account bounded.
      const existing = await io.in(hub.rooms.user(userId)).fetchSockets();
      if (existing.length >= MAX_SOCKETS_PER_USER) existing[0].disconnect(true);

      socket.join([hub.rooms.user(userId), hub.rooms.session(sessionId)]);
      const { user } = await authenticateToken(socket.data.token);
      await chat.ensureCommunityMembership(user);
      const conversationIds = await chat.conversationIdsOf(user._id);
      socket.join(conversationIds.map((id) => hub.rooms.conversation(id)));
      socket.emit('ready', { userId });
    } catch (err) {
      if (!(err instanceof ApiError)) logger.error('Realtime connection setup failed:', err && err.stack ? err.stack : err);
      socket.disconnect(true);
    }
  });

  hub.setServer(io);
  return io;
}

async function closeRealtime(io) {
  hub.setServer(null);
  if (io) await io.close();
}

module.exports = { attachRealtime, closeRealtime };
