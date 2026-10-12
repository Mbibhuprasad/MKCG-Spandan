const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams } = require('../validators/common');
const v = require('../validators/admin.validators');
const admin = require('../controllers/admin.controller');

// Every route below requires an authenticated user whose role, read from the
// database, is ADMIN. There is no other elevated role.
module.exports = function adminRoutes(limiters) {
  const router = express.Router();
  const byId = validate({ params: idParams });
  const write = limiters.write;
  router.use(requireAuth, requireAdmin);

  router.get('/stats', admin.stats);

  router.get('/doctors', validate({ query: v.doctorListQuery }), admin.listDoctors);
  router.get('/doctors/:id', byId, admin.getDoctor);
  router.patch('/doctors/:id/status', write, byId, validate({ body: v.doctorStatusBody }), admin.setDoctorStatus);
  router.patch('/doctors/:id/visibility', write, byId, validate({ body: v.doctorVisibilityBody }), admin.setDoctorVisibility);
  router.delete('/doctors/:id', write, byId, validate({ body: v.deleteBody }), admin.deleteDoctor);

  router.get('/moderation/:queue', validate({ params: v.queueParams, query: v.queueQuery }), admin.listQueue);
  router.patch('/moderation/:queue/:id', write, validate({ params: v.queueItemParams, body: v.reviewBody }), admin.reviewItem);
  router.delete('/moderation/:queue/:id', write, validate({ params: v.queueItemParams, body: v.deleteBody }), admin.deleteItem);

  router.get('/reports', validate({ query: v.reportListQuery }), admin.listReports);
  router.patch('/reports/:id', write, byId, validate({ body: v.reportStatusBody }), admin.setReportStatus);

  router.get('/audit-logs', validate({ query: v.auditQuery }), admin.listAuditLogs);
  return router;
};
