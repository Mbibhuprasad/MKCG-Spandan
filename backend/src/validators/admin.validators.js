const { z, objectId, line, text, page, limit, moderationStatusFilter } = require('./common');
const { ACCOUNT_STATUS, REPORT_STATUS } = require('../config/constants');

// URL segment → content type (+ optional filter). Visit plans are events with
// eventType VISIT_PLAN, reviewed in their own queue.
const MODERATION_QUEUES = Object.freeze({
  posts: { type: 'post', filter: {} },
  blogs: { type: 'blog', filter: {} },
  comments: { type: 'comment', filter: {} },
  memories: { type: 'memory', filter: {} },
  events: { type: 'event', filter: { eventType: { $ne: 'VISIT_PLAN' } } },
  'visit-plans': { type: 'event', filter: { eventType: 'VISIT_PLAN' } },
  polls: { type: 'poll', filter: {} },
});

const queueParams = z.object({ queue: z.enum(Object.keys(MODERATION_QUEUES)) });
const queueItemParams = z.object({ queue: z.enum(Object.keys(MODERATION_QUEUES)), id: objectId });

const queueQuery = z.object({ status: moderationStatusFilter.default('PENDING'), page, limit: limit(10, 30) });

const reviewBody = z
  .object({
    action: z.enum(['approve', 'reject']),
    reason: text(0, 500, 'Reason').default(''),
  });

const deleteBody = z.object({ reason: text(0, 500, 'Reason').default('') });

const doctorListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum([...Object.values(ACCOUNT_STATUS), 'ALL']).default('ALL'),
  page,
  limit: limit(12, 50),
});

const doctorStatusBody = z.object({
  status: z.enum(Object.values(ACCOUNT_STATUS)),
  reason: line(0, 500, 'Reason').default(''),
});

const doctorVisibilityBody = z
  .object({ directory: z.boolean(), featured: z.boolean() })
  .partial()
  .refine((d) => d.directory !== undefined || d.featured !== undefined, 'Nothing to update.');

const reportListQuery = z.object({ status: z.enum([...REPORT_STATUS, 'ALL']).default('OPEN'), page, limit: limit(10, 30) });

const reportStatusBody = z.object({ status: z.enum(['RESOLVED', 'DISMISSED']) });

const auditQuery = z.object({ page, limit: limit(20, 50) });

module.exports = {
  MODERATION_QUEUES,
  queueParams,
  queueItemParams,
  queueQuery,
  reviewBody,
  deleteBody,
  doctorListQuery,
  doctorStatusBody,
  doctorVisibilityBody,
  reportListQuery,
  reportStatusBody,
  auditQuery,
};
