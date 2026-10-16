const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams } = require('../validators/common');
const { ROLES } = require('../config/constants');
const v = require('../validators/poster.validators');
const posters = require('../controllers/poster.controller');

// Batch posters belong to doctors; every route is owner-scoped in the controller.
module.exports = function posterRoutes(limiters) {
  const router = express.Router();
  const byId = validate({ params: idParams });
  const write = limiters.write;
  router.use(requireAuth, requireRole(ROLES.DOCTOR));
  router.get('/', posters.list);
  router.post('/', write, validate({ body: v.createPoster }), posters.create);
  router.get('/:id', byId, posters.getOne);
  router.patch('/:id', limiters.posterSave, byId, validate({ body: v.updatePoster }), posters.update);
  router.delete('/:id', write, byId, posters.remove);
  router.post('/:id/export', limiters.posterExport, byId, validate({ body: v.exportPoster }), posters.exportPoster);
  return router;
};
