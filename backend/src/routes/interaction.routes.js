const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams, pageQuery } = require('../validators/common');
const v = require('../validators/content.validators');
const interactions = require('../controllers/interaction.controller');

// Likes, comments and reports use one API for every content type.
function commentRoutes(limiters) {
  const router = express.Router();
  const byId = validate({ params: idParams });
  const write = limiters.write;
  router.use(requireAuth);
  router.get('/', validate({ query: v.commentListQuery }), interactions.listComments);
  router.get('/mine', validate({ query: pageQuery(10, 30) }), interactions.myComments);
  router.post('/', write, validate({ body: v.createComment }), interactions.createComment);
  router.patch('/:id', write, byId, validate({ body: v.updateComment }), interactions.updateComment);
  router.delete('/:id', write, byId, interactions.removeComment);
  return router;
}

function likeRoutes(limiters) {
  const router = express.Router();
  router.use(requireAuth);
  router.put('/:targetType/:targetId', limiters.write, validate({ params: v.likeParams }), interactions.like);
  router.delete('/:targetType/:targetId', limiters.write, validate({ params: v.likeParams }), interactions.unlike);
  return router;
}

function reportRoutes(limiters) {
  const router = express.Router();
  router.post('/', requireAuth, limiters.write, validate({ body: v.createReport }), interactions.createReport);
  return router;
}

module.exports = { commentRoutes, likeRoutes, reportRoutes };
