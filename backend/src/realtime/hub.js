// Thin seam between the application and Socket.IO. Services publish through
// this module; when no socket server is attached (tests of the REST API, CLI
// scripts) every call is a harmless no-op.
let io = null;

const rooms = {
  user: (id) => `user:${id}`,
  session: (id) => `session:${id}`,
  conversation: (id) => `conversation:${id}`,
};

function setServer(server) {
  io = server;
}

function emitToConversation(conversationId, event, payload) {
  if (io) io.to(rooms.conversation(conversationId)).emit(event, payload);
}

// Subscribes every connected device of a user to a conversation they have just
// become a member of. Rooms are only ever assigned here, on the server.
function joinUser(userId, conversationId) {
  if (io) io.in(rooms.user(userId)).socketsJoin(rooms.conversation(conversationId));
}

// A session that has ended (logout, password change, suspension, deletion)
// must stop receiving messages at once.
function dropSession(sessionId) {
  if (io) io.in(rooms.session(sessionId)).disconnectSockets(true);
}

function dropUser(userId, exceptSessionId) {
  if (!io) return;
  const target = io.in(rooms.user(userId));
  (exceptSessionId ? target.except(rooms.session(exceptSessionId)) : target).disconnectSockets(true);
}

module.exports = { rooms, setServer, emitToConversation, joinUser, dropSession, dropUser };
