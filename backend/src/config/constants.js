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
  // Photos placed on a doctor's private batch poster. Only the poster's owner ever receives their URLs.
  poster: { kinds: ['image'], deliveryType: 'authenticated', folder: 'posters' },
  // Photos sent in a chat. Uploaded only through POST /chat/conversations/:id/images,
  // which checks membership first; the URLs are given only to that conversation's members.
  chat: { kinds: ['image'], deliveryType: 'authenticated', folder: 'chat' },
});

// Purposes that have their own upload endpoint and are refused by the generic POST /media.
const DEDICATED_UPLOAD_PURPOSES = Object.freeze(['chat']);

// Batch Profile Poster Maker. Each template lists its colour variations; the
// first one is the default. Bump a template's `version` when its layout changes
// in a way that alters how saved content is placed.
const POSTER_TEMPLATES = Object.freeze({
  'classic-tribute': { version: 1, palettes: ['royal', 'teal', 'rose'] },
  'silver-jubilee': { version: 1, palettes: ['navy', 'maroon', 'emerald'] },
  'modern-professional': { version: 1, palettes: ['navy', 'slate', 'teal'] },
  'college-memories': { version: 1, palettes: ['vintage', 'sepia', 'sage'] },
  'friends-forever': { version: 1, palettes: ['sky', 'sunset', 'twilight'] },
  'medical-blue': { version: 1, palettes: ['blue', 'teal', 'indigo'] },
});

const POSTER_STATUS = Object.freeze({ DRAFT: 'DRAFT', READY: 'READY' });

const POSTER_PORTRAIT_PLACEMENTS = Object.freeze(['LEFT', 'CENTER', 'RIGHT']);

const POSTER_PHOTO_SOURCES = Object.freeze(['NONE', 'PROFILE', 'UPLOAD']);

// Optional poster sections the doctor can switch off (content is kept).
const POSTER_SECTIONS = Object.freeze([
  'birthday',
  'professional',
  'achievements',
  'introduction',
  'messageToFriends',
  'quotation',
  'memory',
  'batchMessage',
  'closing',
  'gallery',
  'celebration',
]);

// Maximum lengths of poster fields (kept equal in frontend/src/components/posters/model.js).
const POSTER_LIMITS = Object.freeze({
  perDoctor: 20,
  title: 80,
  displayName: 80,
  professionalTitle: 80,
  college: 120,
  hometown: 80,
  specialization: 80,
  workplace: 120,
  role: 80,
  qualifications: 160,
  achievements: 400,
  milestones: 400,
  greeting: 120,
  introduction: 600,
  messageToFriends: 600,
  quotation: 240,
  quotationAuthor: 80,
  memory: 600,
  batchMessage: 600,
  closing: 200,
  signature: 80,
  celebrationTitle: 60,
  celebrationTagline: 120,
  celebrationYearsMax: 75,
  contactEmail: 254,
  contactPhone: 20,
  contactAddress: 160,
  contactWebsite: 300,
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

// Level of an education entry, from school to super-speciality. The portfolio
// orders education by this level (see services/profileOrder.js).
const DEGREE_LEVELS = Object.freeze([
  'SUPER_SPECIALITY',
  'DOCTORATE',
  'POSTGRADUATE',
  'DIPLOMA',
  'UNDERGRADUATE',
  'HIGHER_SECONDARY',
  'SECONDARY',
  'OTHER',
]);

// Optional and private by default: shown to members only if the doctor opts in.
const BLOOD_GROUPS = Object.freeze(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

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
const PROFILE_WIZARD_STEPS = 9;

// The wizard once had 11 steps in a different order. A resume position saved
// under that layout (`profileWizard.layout` 1) is translated on read:
// old step index → the step of the current layout that covers the same ground.
const PROFILE_WIZARD_LAYOUT = 2;
const PROFILE_WIZARD_LEGACY_STEP_MAP = Object.freeze([0, 1, 2, 2, 4, 5, 5, 6, 7, 8, 8]);

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
  DEDICATED_UPLOAD_PURPOSES,
  POSTER_TEMPLATES,
  POSTER_STATUS,
  POSTER_PORTRAIT_PLACEMENTS,
  POSTER_PHOTO_SOURCES,
  POSTER_SECTIONS,
  POSTER_LIMITS,
  EMPLOYMENT_TYPES,
  DEGREE_LEVELS,
  BLOOD_GROUPS,
  CREDENTIAL_TYPES,
  PROFILE_SECTIONS,
  PROFILE_WIZARD_STEPS,
  PROFILE_WIZARD_LAYOUT,
  PROFILE_WIZARD_LEGACY_STEP_MAP,
  LIMITS,
  POLICY_VERSION,
};
