const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams } = require('../validators/common');
const v = require('../validators/doctor.validators');
const doctors = require('../controllers/doctor.controller');

module.exports = function doctorRoutes(limiters) {
  const router = express.Router();
  const write = limiters.write;
  router.get('/featured', doctors.featured); // public, minimal fields
  router.get('/filters', requireAuth, doctors.filters);
  router.get('/me', requireAuth, doctors.getMe);
  router.patch('/me', requireAuth, write, validate({ body: v.updateProfile }), doctors.updateMe);
  router.put('/me/photo', requireAuth, write, validate({ body: v.setPhoto }), doctors.setPhoto);
  router.delete('/me/photo', requireAuth, write, doctors.removePhoto);
  router.get('/', requireAuth, validate({ query: v.directoryQuery }), doctors.list);
  router.get('/:id', requireAuth, validate({ params: idParams }), doctors.getOne);
  return router;
};
