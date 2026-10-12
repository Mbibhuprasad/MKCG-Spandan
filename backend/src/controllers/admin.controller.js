const User = require('../models/User');
const Post = require('../models/Post');
const Blog = require('../models/Blog');
const Comment = require('../models/Comment');
const Memory = require('../models/Memory');
const Event = require('../models/Event');
const Poll = require('../models/Poll');
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');
const { ok, pageMeta } = require('../utils/respond');
const { paging } = require('../utils/pagination');
const { escapeRegex } = require('../utils/text');
const { ROLES, ACCOUNT_STATUS, MODERATION } = require('../config/constants');
const { MODERATION_QUEUES } = require('../validators/admin.validators');
const content = require('../services/content.service');
const moderation = require('../services/moderation.service');
const { deleteDoctorCascade } = require('../services/doctor.service');
const { endAllSessions } = require('../services/session.service');
const { notify } = require('../services/notification.service');
const { audit } = require('../services/audit.service');
const s = require('../services/serializers');

const HIDDEN = { moderationStatus: { $ne: MODERATION.APPROVED } };

/* ── Dashboard ── */

async function stats(_req, res) {
  const doctors = { role: ROLES.DOCTOR };
  const visitPlan = { eventType: 'VISIT_PLAN' };
  const otherEvent = { eventType: { $ne: 'VISIT_PLAN' } };
  const [activeDoctors, suspendedDoctors, posts, blogs, comments, memories, events, visitPlans, polls, hidden, openReports] =
    await Promise.all([
      User.countDocuments({ ...doctors, status: ACCOUNT_STATUS.ACTIVE }),
      User.countDocuments({ ...doctors, status: ACCOUNT_STATUS.SUSPENDED }),
      Post.countDocuments(),
      Blog.countDocuments(),
      Comment.countDocuments(),
      Memory.countDocuments(),
      Event.countDocuments(otherEvent),
      Event.countDocuments(visitPlan),
      Poll.countDocuments(),
      // Records still hidden by the former approval workflow (see scripts/publishPending.js).
      Promise.all([Post, Blog, Comment, Memory, Event, Poll].map((Model) => Model.countDocuments(HIDDEN))),
      Report.countDocuments({ status: 'OPEN' }),
    ]);
  return ok(res, {
    doctors: { active: activeDoctors, suspended: suspendedDoctors },
    content: { posts, blogs, comments, memories, events, 'visit-plans': visitPlans, polls },
    hiddenLegacyItems: hidden.reduce((sum, n) => sum + n, 0),
    openReports,
  });
}

/* ── Doctor management ── */

async function loadDoctor(id) {
  const doctor = await User.findOne({ _id: id, role: ROLES.DOCTOR });
  if (!doctor) throw ApiError.notFound('That doctor could not be found.');
  return doctor;
}

async function listDoctors(req, res) {
  const { q, status, page, limit } = req.valid.query;
  const filter = { role: ROLES.DOCTOR };
  if (status !== 'ALL') filter.status = status;
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { 'profile.specialization': rx }, { 'profile.city': rx }];
  }
  const { skip } = paging({ page, limit });
  const [doctors, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return ok(res, doctors.map(s.serializeDoctorAdmin), pageMeta({ page, limit, total }));
}

async function getDoctor(req, res) {
  const doctor = await loadDoctor(req.valid.params.id);
  const owned = { post: 'author', blog: 'author', comment: 'author', memory: 'owner', event: 'organizer', poll: 'creator' };
  const counts = {};
  await Promise.all(
    Object.entries(owned).map(async ([type, field]) => {
      counts[type] = await content.entry(type).Model.countDocuments({ [field]: doctor._id });
    })
  );
  return ok(res, { ...s.serializeDoctorAdmin(doctor), contentCounts: counts });
}

async function setDoctorStatus(req, res) {
  const { status, reason } = req.valid.body;
  const doctor = await loadDoctor(req.valid.params.id);
  if (doctor.status === status) return ok(res, s.serializeDoctorAdmin(doctor));

  doctor.status = status;
  if (status === ACCOUNT_STATUS.SUSPENDED) {
    doctor.suspension = { reason, at: new Date(), by: req.user._id };
  } else {
    doctor.suspension = { reason: '', at: null, by: null };
  }
  await doctor.save();

  // While suspended, every request with an existing session is refused with
  // ACCOUNT_SUSPENDED (the status is read from the database on each request),
  // so the doctor sees why. On reactivation the old sessions are discarded and
  // the doctor signs in afresh.
  if (status === ACCOUNT_STATUS.ACTIVE) {
    await endAllSessions(doctor._id);
  }
  await notify(doctor._id, {
    type: 'ACCOUNT_STATUS',
    title: status === ACCOUNT_STATUS.SUSPENDED ? 'Your account has been suspended' : 'Your account has been reactivated',
    message:
      status === ACCOUNT_STATUS.SUSPENDED
        ? reason || 'Please contact the community administrator for details.'
        : 'Welcome back. You can use the community again.',
    link: '/community-guidelines',
  });
  await audit(req.user, {
    action: status === ACCOUNT_STATUS.SUSPENDED ? 'DOCTOR_SUSPENDED' : 'DOCTOR_REACTIVATED',
    targetType: 'doctor',
    targetId: doctor._id,
    summary: `${status === ACCOUNT_STATUS.SUSPENDED ? 'Suspended' : 'Reactivated'} ${doctor.name}`,
    metadata: { reason: reason || undefined },
  });
  return ok(res, s.serializeDoctorAdmin(doctor));
}

async function setDoctorVisibility(req, res) {
  const { directory, featured } = req.valid.body;
  const doctor = await loadDoctor(req.valid.params.id);
  if (directory !== undefined) doctor.visibility.directory = directory;
  if (featured !== undefined) doctor.featured = featured;
  await doctor.save();
  await audit(req.user, {
    action: 'DOCTOR_VISIBILITY_CHANGED',
    targetType: 'doctor',
    targetId: doctor._id,
    summary: `Updated visibility for ${doctor.name}`,
    metadata: { directory, featured },
  });
  return ok(res, s.serializeDoctorAdmin(doctor));
}

async function deleteDoctor(req, res) {
  const doctor = await loadDoctor(req.valid.params.id);
  const snapshot = { id: String(doctor._id), name: doctor.name };
  await deleteDoctorCascade(doctor);
  await audit(req.user, {
    action: 'DOCTOR_DELETED',
    targetType: 'doctor',
    targetId: snapshot.id,
    summary: `Deleted the account of ${snapshot.name} and all content they owned`,
    metadata: { reason: req.valid.body.reason || undefined },
  });
  return ok(res, { deleted: true });
}

/* ── Content management (view and delete; nothing needs approving) ── */

const QUEUE_POPULATE = {
  post: [{ path: 'author', select: s.AUTHOR_FIELDS }, { path: 'media' }],
  blog: [{ path: 'author', select: s.AUTHOR_FIELDS }, { path: 'cover' }],
  comment: [{ path: 'author', select: s.AUTHOR_FIELDS }],
  memory: [{ path: 'owner', select: s.AUTHOR_FIELDS }, { path: 'media' }, { path: 'event', select: 'title moderationStatus' }],
  event: [{ path: 'organizer', select: s.AUTHOR_FIELDS }, { path: 'cover' }],
  poll: [{ path: 'creator', select: s.AUTHOR_FIELDS }],
};

async function commentContext(comments) {
  const context = new Map();
  await Promise.all(
    comments.map(async (c) => {
      const target = await content.entry(c.targetType).Model.findById(c.target).select('title body question slug');
      context.set(String(c._id), {
        type: c.targetType,
        id: String(c.target),
        title: target ? content.titleOf(c.targetType, target) : '(removed)',
        link: target ? await content.linkFor(c.targetType, target) : '',
      });
    })
  );
  return context;
}

async function serializeQueueItems(type, docs, viewer) {
  switch (type) {
    case 'post':
      return docs.map((d) => s.serializePost(d, { viewer }));
    case 'blog':
      return docs.map((d) => s.serializeBlogDetail(d, { viewer }));
    case 'memory':
      return docs.map((d) => s.serializeMemory(d, { viewer }));
    case 'event':
      return docs.map((d) => s.serializeEvent(d, { viewer }));
    case 'poll':
      return docs.map((d) => s.serializePoll(d, { viewer }));
    case 'comment': {
      const context = await commentContext(docs);
      return docs.map((d) => ({ ...s.serializeComment(d, { viewer }), target: context.get(String(d._id)) }));
    }
    default:
      return [];
  }
}

async function listQueue(req, res) {
  const { type, filter: queueFilter } = MODERATION_QUEUES[req.valid.params.queue];
  const { status, page, limit } = req.valid.query;
  const filter = { ...queueFilter };
  if (status !== 'ALL') filter.moderationStatus = status;

  const { Model } = content.entry(type);
  const { skip } = paging({ page, limit });
  const sort = { createdAt: -1, _id: -1 };
  const [docs, total] = await Promise.all([
    Model.find(filter).sort(sort).skip(skip).limit(limit).populate(QUEUE_POPULATE[type]),
    Model.countDocuments(filter),
  ]);
  return ok(res, await serializeQueueItems(type, docs, req.user), pageMeta({ page, limit, total }));
}

async function assertInQueue(queue, id) {
  const { type, filter } = MODERATION_QUEUES[queue];
  const exists = await content.entry(type).Model.exists({ _id: id, ...filter });
  if (!exists) throw ApiError.notFound('That item could not be found.');
  return type;
}

async function deleteItem(req, res) {
  const { queue, id } = req.valid.params;
  const type = await assertInQueue(queue, id);
  await moderation.removeAsAdmin({ type, id, admin: req.user, reason: req.valid.body.reason });
  return ok(res, { deleted: true });
}

/* ── Reports ── */

async function listReports(req, res) {
  const { status, page, limit } = req.valid.query;
  const filter = status === 'ALL' ? {} : { status };
  const { skip } = paging({ page, limit });
  const [reports, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('reporter', s.AUTHOR_FIELDS),
    Report.countDocuments(filter),
  ]);

  const items = await Promise.all(
    reports.map(async (r) => {
      const target = await content.entry(r.targetType).Model.findById(r.target);
      return {
        id: String(r._id),
        targetType: r.targetType,
        targetId: String(r.target),
        reason: r.reason,
        details: r.details,
        status: r.status,
        reporter: s.authorSummary(r.reporter),
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        target: target
          ? {
              exists: true,
              title: content.titleOf(r.targetType, target),
              link: await content.linkFor(r.targetType, target),
              moderationStatus: target.moderationStatus,
              queue: Object.keys(MODERATION_QUEUES).find((key) => {
                const q = MODERATION_QUEUES[key];
                if (q.type !== r.targetType) return false;
                if (r.targetType !== 'event') return true;
                return (key === 'visit-plans') === (target.eventType === 'VISIT_PLAN');
              }),
            }
          : { exists: false },
      };
    })
  );
  return ok(res, items, pageMeta({ page, limit, total }));
}

async function setReportStatus(req, res) {
  const report = await Report.findById(req.valid.params.id);
  if (!report) throw ApiError.notFound('That report could not be found.');
  report.status = req.valid.body.status;
  report.resolvedBy = req.user._id;
  report.resolvedAt = new Date();
  await report.save();
  await audit(req.user, {
    action: `REPORT_${report.status}`,
    targetType: 'report',
    targetId: report._id,
    summary: `Marked a ${report.targetType} report as ${report.status.toLowerCase()}`,
  });
  return ok(res, { id: String(report._id), status: report.status });
}

/* ── Audit log ── */

async function listAuditLogs(req, res) {
  const { page, limit } = req.valid.query;
  const { skip } = paging({ page, limit });
  const [logs, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(),
  ]);
  return ok(
    res,
    logs.map((l) => ({
      id: String(l._id),
      action: l.action,
      actorName: l.actorName,
      targetType: l.targetType,
      targetId: l.targetId,
      summary: l.summary,
      createdAt: l.createdAt,
    })),
    pageMeta({ page, limit, total })
  );
}

module.exports = {
  stats,
  listDoctors,
  getDoctor,
  setDoctorStatus,
  setDoctorVisibility,
  deleteDoctor,
  listQueue,
  deleteItem,
  listReports,
  setReportStatus,
  listAuditLogs,
};
