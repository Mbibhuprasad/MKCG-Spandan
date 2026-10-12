const { ok, created } = require('../utils/respond');
const chat = require('../services/chat.service');

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

module.exports = { listConversations, unreadCount, openDirect, getConversation, listMessages, sendMessage, markRead };
