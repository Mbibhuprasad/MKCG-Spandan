const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, idParams, objectId, pageQuery } = require('../validators/common');
const v = require('../validators/content.validators');
const events = require('../controllers/event.controller');

module.exports = function eventRoutes(limiters) {
  const router = express.Router();
  const byId = validate({ params: idParams });
  const write = limiters.write;
  router.get('/public', events.publicUpcoming); // public, minimal fields
  router.use(requireAuth);
  router.get('/', validate({ query: v.eventListQuery }), events.list);
  router.get('/mine', validate({ query: pageQuery(10, 30) }), events.mine);
  router.post('/', write, validate({ body: v.createEvent }), events.create);
  router.get('/:id', byId, events.getOne);
  router.patch('/:id', write, byId, validate({ body: v.updateEvent }), events.update);
  router.delete('/:id', write, byId, events.remove);
  router.put('/:id/rsvp', write, byId, validate({ body: v.rsvpBody }), events.setRsvp);
  router.delete('/:id/rsvp', write, byId, events.clearRsvp);
  router.get('/:id/attendees', byId, validate({ query: pageQuery(30, 50) }), events.attendees);
  // Travel schedules: everyone attending can read; each member writes only their own.
  router.get('/:id/schedule', byId, validate({ query: pageQuery(50, 100) }), events.schedule);
  router.put('/:id/schedule', write, byId, validate({ body: v.scheduleBody }), events.setSchedule);
  router.delete('/:id/schedule', write, byId, events.clearSchedule);
  router.delete(
    '/:id/schedule/:userId',
    requireAdmin,
    write,
    validate({ params: z.object({ id: objectId, userId: objectId }) }),
    events.removeScheduleOf
  );
  return router;
};
