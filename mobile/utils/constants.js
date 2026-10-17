// Display labels for values defined by the API (backend/src/config/constants.js).
// The API remains the authority: these lists only drive form options and text,
// exactly as frontend/src/lib/constants.js does for the website.

export const site = {
  name: "MKCGSPANDAN",
  tagline: "Together in Medicine. Connected Beyond Medicine.",
  description:
    "MKCGSPANDAN is a private community where doctors and medical Friends reconnect, celebrate professional journeys, preserve shared memories and plan reunions.",
  // "Designed & Developed by" credit at the end of Home and About (the website
  // footer shows the same credit — keep frontend/src/lib/site.js in sync).
  // Only full https:// addresses become links; an empty value hides that link.
  developer: {
    name: "Bibhu Prasad Mahapatra",
    // Personal portfolio website — not set yet: add its full https:// address here.
    portfolioUrl: "",
    linkedinUrl: "https://www.linkedin.com/in/bibhuprasad-mahapatra-a9a896282/",
  },
};

export const POST_TYPES = [
  { value: 'GENERAL', label: 'General update', icon: 'chatbubble-ellipses' },
  { value: 'ACHIEVEMENT', label: 'Achievement', icon: 'trophy' },
  { value: 'REUNION_UPDATE', label: 'Reunion update', icon: 'people' },
  { value: 'ANNOUNCEMENT', label: 'Announcement', icon: 'megaphone' },
  { value: 'EXPERIENCE', label: 'Experience', icon: 'medkit' },
  { value: 'MEMORY', label: 'Memory', icon: 'images' },
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
  { value: 'GOING', label: 'Going', icon: 'checkmark-circle' },
  { value: 'MAYBE', label: 'Maybe', icon: 'help-circle' },
  { value: 'NOT_GOING', label: "Can't go", icon: 'close-circle' },
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

export const REPORT_REASONS = [
  { value: 'PATIENT_CONFIDENTIALITY', label: 'Shares patient or clinical information' },
  { value: 'HARASSMENT', label: 'Harassment, threats or discrimination' },
  { value: 'IMPERSONATION', label: 'Impersonation' },
  { value: 'EXPLICIT_OR_UNLAWFUL', label: 'Explicit or unlawful content' },
  { value: 'PRIVACY_VIOLATION', label: 'Shares private photos or information' },
  { value: 'SPAM', label: 'Spam or malicious links' },
  { value: 'OTHER', label: 'Something else' },
];

// Server-side limits (MAX_IMAGE_MB / MAX_VIDEO_MB and LIMITS on the API).
export const UPLOAD_LIMITS = { imageMb: 8, videoMb: 60, postMedia: 4, memoryMedia: 12 };

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
  { value: 'SUPER_SPECIALITY', label: 'Super-speciality (e.g. DM, MCh)' },
  { value: 'DOCTORATE', label: 'Doctorate (PhD)' },
  { value: 'POSTGRADUATE', label: 'Postgraduate (e.g. MD, MS, DNB)' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'UNDERGRADUATE', label: 'Undergraduate (e.g. MBBS, BDS)' },
  { value: 'HIGHER_SECONDARY', label: 'Higher secondary (+2 / 12th)' },
  { value: 'SECONDARY', label: 'Secondary (10th)' },
  { value: 'OTHER', label: 'Other' },
];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

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
  { key: 'education', label: 'Education' },
  { key: 'qualifications', label: 'Qualifications and certifications' },
  { key: 'fellowships', label: 'Fellowships and postdoctoral certification' },
  { key: 'achievements', label: 'Awards' },
  { key: 'memberships', label: 'Memberships' },
  { key: 'publications', label: 'Publications' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'links', label: 'Professional links' },
];

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
];

export const DEFAULT_COUNTRY = 'India';
export const YEAR_MIN = 1940;
export const YEAR_MAX = 2100;
