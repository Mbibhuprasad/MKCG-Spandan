const express = require('express');
const { requireAuth, probeSession, sessionForLogout } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const v = require('../validators/auth.validators');
const auth = require('../controllers/auth.controller');

module.exports = function authRoutes(limiters) {
  const router = express.Router();
  router.post('/register', limiters.register, validate({ body: v.register }), auth.register);
  router.post('/login', limiters.loginIp, limiters.login, validate({ body: v.login }), auth.login);
  router.post('/logout', sessionForLogout, auth.logout);
  router.get('/session', probeSession, auth.session);
  router.get('/me', requireAuth, auth.me);
  router.patch('/password', requireAuth, limiters.write, validate({ body: v.changePassword }), auth.changePassword);
  return router;
};
