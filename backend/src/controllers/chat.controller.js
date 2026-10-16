const { Readable } = require('stream');
const { ok, created } = require('../utils/respond');
const chat = require('../services/chat.service');
const { signSocketTicket, SOCKET_TICKET_TTL_SECONDS } = require('../services/session.service');

// Every handler passes the signed-in user to chat.service, which checks
// membership before anything is read or written.
async function listConversations(req, res) {
  return ok(res, await chat.listConversations(req.user, req.valid.query));
}

async function unreadCount(req, res) {
  return ok(res, { unreadCount: await chat.unreadTotal(req.user) });
}

async function openDirect(req, res) {
  const { conversation, created: isNew } = await chat.openDirect(req.user, req.valid.body.doctorId);
  return isNew ? created(res, conversation) : ok(res, conversation);
}

async function getConversation(req, res) {
  return ok(res, await chat.getConversation(req.valid.params.id, req.user));
}

async function listMessages(req, res) {
  const { messages, hasMore, nextBefore } = await chat.listMessages(req.valid.params.id, req.user, req.valid.query);
  return ok(res, messages, { hasMore, nextBefore });
}

async function sendMessage(req, res) {
  const { message, duplicate } = await chat.sendMessage(req.user, { conversationId: req.valid.params.id, ...req.valid.body });
  return duplicate ? ok(res, message) : created(res, message);
}

async function markRead(req, res) {
  return ok(res, await chat.markRead(req.valid.params.id, req.user));
}

async function react(req, res) {
  const { id: conversationId, messageId } = req.valid.params;
  return ok(res, await chat.reactToMessage(req.user, { conversationId, messageId, emoji: req.valid.body.emoji }));
}

async function uploadImage(req, res) {
  return created(res, await chat.uploadImage(req.valid.params.id, req.user, req.file));
}

async function deleteMessage(req, res) {
  const { id: conversationId, messageId } = req.valid.params;
  return ok(res, await chat.deleteMessage(req.user, { conversationId, messageId }));
}

// Streams the original photo to a member of the conversation. Cloudinary links
// to the original never leave the server, and the response is never cached.
async function downloadImage(req, res) {
  const { id: conversationId, messageId } = req.valid.params;
  const { response, filename, contentType, bytes } = await chat.openMessageImage(req.user, { conversationId, messageId });
  res.set({
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
  });
  const length = response.headers.get('content-length') || bytes;
  if (length) res.set('Content-Length', String(length));
  const stream = Readable.fromWeb(response.body);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

// A one-time ticket that lets the website open the chat socket (see
// session.service.signSocketTicket). The mobile app uses its bearer token instead.
async function socketTicket(req, res) {
  return ok(res, {
    ticket: signSocketTicket(req.user._id, req.session._id),
    expiresInSeconds: SOCKET_TICKET_TTL_SECONDS,
  });
}

module.exports = {
  listConversations,
  unreadCount,
  openDirect,
  getConversation,
  listMessages,
  sendMessage,
  markRead,
  react,
  uploadImage,
  deleteMessage,
  downloadImage,
  socketTicket,
};
