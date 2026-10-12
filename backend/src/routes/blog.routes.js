const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams, pageQuery } = require('../validators/common');
const v = require('../validators/content.validators');
const blogs = require('../controllers/blog.controller');

module.exports = function blogRoutes(limiters) {
  const router = express.Router();
  const byId = validate({ params: idParams });
  const write = limiters.write;
  router.get('/', optionalAuth, validate({ query: v.blogListQuery }), blogs.list); // public: approved only
  router.get('/taxonomy', blogs.taxonomy); // public
  router.get('/mine', requireAuth, validate({ query: pageQuery(10, 30) }), blogs.mine);
  router.get('/slug/:slug', optionalAuth, validate({ params: v.slugParams }), blogs.getBySlug); // public when approved
  router.post('/', requireAuth, write, validate({ body: v.createBlog }), blogs.create);
  router.get('/:id', requireAuth, byId, blogs.getForEdit);
  router.patch('/:id', requireAuth, write, byId, validate({ body: v.updateBlog }), blogs.update);
  router.delete('/:id', requireAuth, write, byId, blogs.remove);
  return router;
};
