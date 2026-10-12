const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams, pageQuery } = require('../validators/common');
const v = require('../validators/content.validators');
const polls = require('../controllers/poll.controller');

module.exports = function pollRoutes(limiters) {
  const router = express.Router();
  const byId = validate({ params: idParams });
  const write = limiters.write;
  router.use(requireAuth);
  router.get('/', validate({ query: v.pollListQuery }), polls.list);
  router.get('/mine', validate({ query: pageQuery(10, 30) }), polls.mine);
  router.post('/', write, validate({ body: v.createPoll }), polls.create);
  router.get('/:id', byId, polls.getOne);
  router.patch('/:id', write, byId, validate({ body: v.updatePoll }), polls.update);
  router.delete('/:id', write, byId, polls.remove);
  router.post('/:id/vote', write, byId, validate({ body: v.voteBody }), polls.vote);
  return router;
};
