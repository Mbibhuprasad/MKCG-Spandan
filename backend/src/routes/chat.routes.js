const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { singleFileUpload } = require('../middleware/upload');
const { idParams } = require('../validators/common');
const v = require('../validators/chat.validators');
const chat = require('../controllers/chat.controller');

module.exports = function chatRoutes(limiters) {
  const router = express.Router();
  const byId = validate({ params: idParams });
  router.use(requireAuth); // chat is members-only
  router.get('/conversations', validate({ query: v.conversationListQuery }), chat.listConversations);
  router.get('/unread-count', chat.unreadCount);
  router.post('/direct', limiters.write, validate({ body: v.openDirect }), chat.openDirect);
  router.get('/conversations/:id', byId, chat.getConversation);
  router.get('/conversations/:id/messages', byId, validate({ query: v.messageListQuery }), chat.listMessages);
  // Sending has its own per-member limit inside chat.service (shared with sockets).
  router.post('/conversations/:id/messages', byId, validate({ body: v.sendMessage }), chat.sendMessage);
  router.post('/conversations/:id/read', byId, chat.markRead);
  // Reactions share the per-member sending limit inside chat.service.
  router.put(
    '/conversations/:id/messages/:messageId/reaction',
    validate({ params: v.messageParams, body: v.react }),
    chat.react
  );
  // "Delete for everyone" (sender only). Shares the per-member sending limit.
  router.delete('/conversations/:id/messages/:messageId', validate({ params: v.messageParams }), chat.deleteMessage);
  // multipart/form-data with the field `file`; membership is checked before the file is stored.
  router.post('/conversations/:id/images', limiters.upload, byId, singleFileUpload(), chat.uploadImage);
  // The original photo of an image message, streamed with a download filename.
  router.get('/conversations/:id/messages/:messageId/image', validate({ params: v.messageParams }), chat.downloadImage);
  // Website only: a one-time ticket for the Socket.IO handshake.
  router.post('/socket-ticket', limiters.write, chat.socketTicket);
  return router;
};
