const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams, pageQuery } = require('../validators/common');
const v = require('../validators/content.validators');
const memories = require('../controllers/memory.controller');

module.exports = function memoryRoutes(limiters) {
  const router = express.Router();
  const byId = validate({ params: idParams });
  const write = limiters.write;
  router.use(requireAuth); // memories are members-only
  router.get('/', validate({ query: v.memoryListQuery }), memories.list);
  router.get('/events', memories.eventFilters);
  router.get('/mine', validate({ query: pageQuery(12, 36) }), memories.mine);
  router.post('/', write, validate({ body: v.createMemory }), memories.create);
  router.get('/:id', byId, memories.getOne);
  router.patch('/:id', write, byId, validate({ body: v.updateMemory }), memories.update);
  router.delete('/:id', write, byId, memories.remove);
  router.get('/:id/media/:mediaId/download', validate({ params: v.memoryDownloadParams }), memories.download);
  return router;
};
