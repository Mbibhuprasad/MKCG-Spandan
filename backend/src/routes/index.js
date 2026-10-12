const express = require('express');
const { requireAuth } = require('../middleware/auth');
const dashboard = require('../controllers/dashboard.controller');
const authRoutes = require('./auth.routes');
const doctorRoutes = require('./doctor.routes');
const mediaRoutes = require('./media.routes');
const postRoutes = require('./post.routes');
const blogRoutes = require('./blog.routes');
const { commentRoutes, likeRoutes, reportRoutes } = require('./interaction.routes');
const memoryRoutes = require('./memory.routes');
const eventRoutes = require('./event.routes');
const pollRoutes = require('./poll.routes');
const notificationRoutes = require('./notification.routes');
const chatRoutes = require('./chat.routes');
const adminRoutes = require('./admin.routes');
const adminAuthRoutes = require('./adminAuth.routes');

// API v1 — mounted at /api/v1 by app.js.
function buildRouter(limiters) {
  const api = express.Router();

  api.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

  api.use('/auth', authRoutes(limiters));
  api.use(adminAuthRoutes(limiters));
  api.use('/doctors', doctorRoutes(limiters));
  api.use('/media', mediaRoutes(limiters));
  api.use('/posts', postRoutes(limiters));
  api.use('/blogs', blogRoutes(limiters));
  api.use('/comments', commentRoutes(limiters));
  api.use('/likes', likeRoutes(limiters));
  api.use('/reports', reportRoutes(limiters));
  api.use('/memories', memoryRoutes(limiters));
  api.use('/events', eventRoutes(limiters));
  api.use('/polls', pollRoutes(limiters));
  api.use('/notifications', notificationRoutes(limiters));
  api.use('/chat', chatRoutes(limiters));
  api.get('/dashboard/summary', requireAuth, dashboard.summary);
  api.use('/admin', adminRoutes(limiters));

  return api;
}

module.exports = { buildRouter };
