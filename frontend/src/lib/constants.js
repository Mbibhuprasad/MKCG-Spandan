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

// Content is published when it is created. PENDING and REJECTED only occur on
// items left hidden by the former approval workflow.
export const MODERATION_LABELS = {
  PENDING: 'Not published',
  APPROVED: 'Published',
  REJECTED: 'Not published',
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

// Admin content lists (URL segment → label).
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

/* ── Doctor profile ── */

export const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'VISITING', label: 'Visiting consultant' },
  { value: 'HONORARY', label: 'Honorary' },
  { value: 'PRIVATE_PRACTICE', label: 'Private practice' },
  { value: 'TRAINING', label: 'Residency / training post' },
  { value: 'ACADEMIC', label: 'Academic / teaching' },
  { value: 'OTHER', label: 'Other' },
];

export const DEGREE_LEVELS = [
  { value: 'UNDERGRADUATE', label: 'Undergraduate (e.g. MBBS, BDS)' },
  { value: 'POSTGRADUATE', label: 'Postgraduate (e.g. MD, MS, DNB)' },
  { value: 'SUPER_SPECIALITY', label: 'Super-speciality (e.g. DM, MCh)' },
  { value: 'DOCTORATE', label: 'Doctorate (PhD)' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'OTHER', label: 'Other' },
];

export const CREDENTIAL_TYPES = [
  { value: 'DEGREE', label: 'Professional degree' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'BOARD_CERTIFICATION', label: 'Board certification' },
  { value: 'MEMBERSHIP', label: 'Membership of a college or society' },
  { value: 'LICENCE', label: 'Licence / registration' },
  { value: 'OTHER', label: 'Other' },
];

// Portfolio sections a doctor can hide from other members (keys are the API's).
export const PROFILE_SECTIONS = [
  { key: 'experience', label: 'Work experience' },
  { key: 'education', label: 'Education and degrees' },
  { key: 'qualifications', label: 'Professional qualifications and certifications' },
  { key: 'fellowships', label: 'Fellowships and postdoctoral certification' },
  { key: 'achievements', label: 'Awards' },
  { key: 'memberships', label: 'Memberships' },
  { key: 'publications', label: 'Publications' },
  { key: 'gallery', label: 'Gallery (items kept for the portfolio only)' },
  { key: 'links', label: 'Professional links' },
];

// Suggestions only — the profile accepts any specialization a doctor types.
export const SPECIALIZATIONS = [
  'Anaesthesiology',
  'Anatomy',
  'Biochemistry',
  'Cardiology',
  'Cardiothoracic and Vascular Surgery',
  'Community Medicine',
  'Critical Care Medicine',
  'Dentistry',
  'Dermatology',
  'Emergency Medicine',
  'Endocrinology',
  'ENT (Otorhinolaryngology)',
  'Family Medicine',
  'Forensic Medicine',
  'Gastroenterology',
  'General Medicine',
  'General Practice',
  'General Surgery',
  'Geriatrics',
  'Haematology',
  'Hospital Administration',
  'Infectious Diseases',
  'Microbiology',
  'Neonatology',
  'Nephrology',
  'Neurology',
  'Neurosurgery',
  'Nuclear Medicine',
  'Obstetrics and Gynaecology',
  'Oncology (Medical)',
  'Oncology (Radiation)',
  'Oncology (Surgical)',
  'Ophthalmology',
  'Orthopaedics',
  'Paediatric Surgery',
  'Paediatrics',
  'Palliative Medicine',
  'Pathology',
  'Pharmacology',
  'Physical Medicine and Rehabilitation',
  'Physiology',
  'Plastic and Reconstructive Surgery',
  'Psychiatry',
  'Public Health',
  'Pulmonology',
  'Radiology',
  'Rheumatology',
  'Sports Medicine',
  'Transfusion Medicine',
  'Urology',
];

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

// The community is India-based (see DEFAULT_COUNTRY_CODE on the API).
export const DEFAULT_COUNTRY = 'India';

export const labelOf = (list, value) => {
  const found = list.find((item) => item.value === value);
  return found ? found.label : value;
};
