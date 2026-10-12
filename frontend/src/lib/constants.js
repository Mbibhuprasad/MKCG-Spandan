// Display labels for values defined by the API (backend/src/config/constants.js).
// The backend remains the authority: these lists only drive form options and text.

export const POST_TYPES = [
  { value: 'GENERAL', label: 'General update' },
  { value: 'ACHIEVEMENT', label: 'Professional achievement' },
  { value: 'REUNION_UPDATE', label: 'Reunion update' },
  { value: 'ANNOUNCEMENT', label: 'Community announcement' },
  { value: 'EXPERIENCE', label: 'Experience' },
  { value: 'MEMORY', label: 'Memory' },
];

export const EVENT_TYPES = [
  { value: 'REUNION', label: 'Batch reunion' },
  { value: 'GET_TOGETHER', label: 'Get-together' },
  { value: 'DINNER', label: 'Dinner plan' },
  { value: 'MEETUP', label: 'Professional / social meetup' },
  { value: 'VISIT_PLAN', label: 'Visit plan' },
  { value: 'OTHER', label: 'Other gathering' },
];

export const RSVP_OPTIONS = [
  { value: 'GOING', label: 'Going' },
  { value: 'MAYBE', label: 'Maybe' },
  { value: 'NOT_GOING', label: "Can't go" },
];

export const BLOG_CATEGORIES = [
  'Clinical Practice',
  'Career & Growth',
  'Research',
  'Medical Education',
  'Wellbeing',
  'Batch Stories',
  'Travel & Life',
  'Technology in Medicine',
  'Other',
];

export const POLL_RESULTS_VISIBILITY = [
  { value: 'AFTER_VOTE', label: 'After a member votes' },
  { value: 'ALWAYS', label: 'Always visible' },
  { value: 'AFTER_CLOSE', label: 'Only after the poll closes' },
];

export const REPORT_REASONS = [
  { value: 'PATIENT_CONFIDENTIALITY', label: 'Shares patient or clinical information' },
  { value: 'HARASSMENT', label: 'Harassment, threats or discrimination' },
  { value: 'IMPERSONATION', label: 'Impersonation' },
  { value: 'EXPLICIT_OR_UNLAWFUL', label: 'Explicit or unlawful content' },
  { value: 'PRIVACY_VIOLATION', label: 'Shares private photos or information' },
  { value: 'SPAM', label: 'Spam or malicious links' },
  { value: 'OTHER', label: 'Something else' },
];

export const MODERATION_LABELS = {
  PENDING: 'Awaiting review',
  APPROVED: 'Approved',
  REJECTED: 'Not approved',
};

// Content types as used by the API for likes, comments and reports.
export const CONTENT_LABELS = {
  post: 'Post',
  blog: 'Blog',
  comment: 'Comment',
  memory: 'Memory',
  event: 'Event',
  poll: 'Poll',
};

// Admin moderation queues (URL segment → label).
export const MODERATION_QUEUES = [
  { key: 'posts', label: 'Posts' },
  { key: 'blogs', label: 'Blogs' },
  { key: 'comments', label: 'Comments' },
  { key: 'memories', label: 'Memories' },
  { key: 'events', label: 'Events' },
  { key: 'visit-plans', label: 'Visit plans' },
  { key: 'polls', label: 'Polls' },
];

export const UPLOAD_LIMITS = {
  imageMb: 8,
  videoMb: 60,
  imageAccept: 'image/jpeg,image/png,image/webp',
  videoAccept: 'video/mp4,video/quicktime,video/webm',
  postMedia: 4,
  memoryMedia: 12,
};

export const labelOf = (list, value) => {
  const found = list.find((item) => item.value === value);
  return found ? found.label : value;
};
