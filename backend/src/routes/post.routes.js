const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams } = require('../validators/common');
const v = require('../validators/content.validators');
const posts = require('../controllers/post.controller');

module.exports = function postRoutes(limiters) {
  const router = express.Router();
  const byId = validate({ params: idParams });
  const write = limiters.write;
  router.use(requireAuth);
  router.get('/', validate({ query: v.postListQuery }), posts.feed);
  router.get('/mine', validate({ query: v.postListQuery }), posts.mine);
  router.post('/', write, validate({ body: v.createPost }), posts.create);
  router.get('/:id', byId, posts.getOne);
  router.patch('/:id', write, byId, validate({ body: v.updatePost }), posts.update);
  router.delete('/:id', write, byId, posts.remove);
  return router;
};
