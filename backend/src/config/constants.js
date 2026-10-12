const ROLES = Object.freeze({ ADMIN: 'ADMIN', DOCTOR: 'DOCTOR' });

const ACCOUNT_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED' });

const MODERATION = Object.freeze({ PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' });

const POST_TYPES = Object.freeze(['GENERAL', 'ACHIEVEMENT', 'REUNION_UPDATE', 'ANNOUNCEMENT', 'EXPERIENCE', 'MEMORY']);

const EVENT_TYPES = Object.freeze(['REUNION', 'GET_TOGETHER', 'DINNER', 'MEETUP', 'VISIT_PLAN', 'OTHER']);

const RSVP_STATUS = Object.freeze(['GOING', 'MAYBE', 'NOT_GOING']);

const BLOG_CATEGORIES = Object.freeze([
  'Clinical Practice',
  'Career & Growth',
  'Research',
  'Medical Education',
  'Wellbeing',
  'Batch Stories',
  'Travel & Life',
  'Technology in Medicine',
  'Other',
]);

const POLL_RESULTS_VISIBILITY = Object.freeze(['ALWAYS', 'AFTER_VOTE', 'AFTER_CLOSE']);

const REPORT_REASONS = Object.freeze([
  'PATIENT_CONFIDENTIALITY',
  'HARASSMENT',
  'IMPERSONATION',
  'EXPLICIT_OR_UNLAWFUL',
  'PRIVACY_VIOLATION',
  'SPAM',
  'OTHER',
]);

const REPORT_STATUS = Object.freeze(['OPEN', 'RESOLVED', 'DISMISSED']);

// Media upload purposes → what may be uploaded and how Cloudinary delivers it.
// `authenticated` assets are only reachable through signed URLs issued by this API.
const MEDIA_PURPOSES = Object.freeze({
  profile: { kinds: ['image'], deliveryType: 'upload', folder: 'profiles' },
  blog: { kinds: ['image'], deliveryType: 'upload', folder: 'blogs' },
  post: { kinds: ['image'], deliveryType: 'authenticated', folder: 'posts' },
  event: { kinds: ['image'], deliveryType: 'authenticated', folder: 'events' },
  memory: { kinds: ['image', 'video'], deliveryType: 'authenticated', folder: 'memories' },
  // Award photos and certificates shown on a doctor's portfolio (same delivery as profile photos).
  award: { kinds: ['image'], deliveryType: 'upload', folder: 'awards' },
});

// Doctor profile: values offered by the profile wizard. '' always means "not stated".
const EMPLOYMENT_TYPES = Object.freeze([
  'FULL_TIME',
  'PART_TIME',
  'VISITING',
  'HONORARY',
  'PRIVATE_PRACTICE',
  'TRAINING',
  'ACADEMIC',
  'OTHER',
]);

// Level of an academic degree (education entries).
const DEGREE_LEVELS = Object.freeze(['UNDERGRADUATE', 'POSTGRADUATE', 'SUPER_SPECIALITY', 'DOCTORATE', 'DIPLOMA', 'OTHER']);

const CREDENTIAL_TYPES = Object.freeze(['DEGREE', 'DIPLOMA', 'BOARD_CERTIFICATION', 'MEMBERSHIP', 'LICENCE', 'OTHER']);

// Portfolio sections a doctor may hide from other members.
const PROFILE_SECTIONS = Object.freeze([
  'education',
  'qualifications',
  'experience',
  'fellowships',
  'achievements',
  'memberships',
  'publications',
  'gallery',
  'links',
]);

// Number of steps in the profile wizard (used to validate the saved resume position).
const PROFILE_WIZARD_STEPS = 11;

const LIMITS = Object.freeze({
  postMedia: 4,
  memoryMedia: 12,
  pollOptionsMin: 2,
  pollOptionsMax: 10,
  pageSizeMax: 50,
});

// Bump when Terms, Privacy Policy or Community Guidelines change.
const POLICY_VERSION = '2026-10-01';

module.exports = {
  ROLES,
  ACCOUNT_STATUS,
  MODERATION,
  POST_TYPES,
  EVENT_TYPES,
  RSVP_STATUS,
  BLOG_CATEGORIES,
  POLL_RESULTS_VISIBILITY,
  REPORT_REASONS,
  REPORT_STATUS,
  MEDIA_PURPOSES,
  EMPLOYMENT_TYPES,
  DEGREE_LEVELS,
  CREDENTIAL_TYPES,
  PROFILE_SECTIONS,
  PROFILE_WIZARD_STEPS,
  LIMITS,
  POLICY_VERSION,
};
