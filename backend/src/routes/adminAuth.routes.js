const express = require('express');
const { validate } = require('../middleware/validate');
const v = require('../validators/adminAuth.validators');
const adminAuth = require('../controllers/adminAuth.controller');

// Mounted at the API root: POST /api/v1/admin-register and POST /api/v1/admin-login.
module.exports = function adminAuthRoutes(limiters) {
  const router = express.Router();
  router.post('/admin-register', limiters.register, validate({ body: v.adminRegister }), adminAuth.register);
  router.post('/admin-login', limiters.loginIp, limiters.login, validate({ body: v.adminLogin }), adminAuth.login);
  return router;
};
