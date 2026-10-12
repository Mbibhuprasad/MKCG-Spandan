const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams } = require('../validators/common');
const v = require('../validators/content.validators');
const notifications = require('../controllers/notification.controller');

module.exports = function notificationRoutes(limiters) {
  const router = express.Router();
  router.use(requireAuth);
  router.get('/', validate({ query: v.notificationQuery }), notifications.list);
  router.get('/unread-count', notifications.unreadCount);
  router.patch('/read-all', limiters.write, notifications.markAllRead);
  router.patch('/:id/read', limiters.write, validate({ params: idParams }), notifications.markRead);
  return router;
};
