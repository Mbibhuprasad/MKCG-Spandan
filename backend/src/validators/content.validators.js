const {
  z,
  objectId,
  text,
  line,
  date,
  nullableDate,
  nullableId,
  page,
  limit,
} = require('./common');
const {
  POST_TYPES,
  EVENT_TYPES,
  RSVP_STATUS,
  BLOG_CATEGORIES,
  POLL_RESULTS_VISIBILITY,
  REPORT_REASONS,
  LIMITS,
  MEDIA_PURPOSES,
} = require('../config/constants');
const { COMMENT_TARGETS } = require('../models/Comment');
const { LIKE_TARGETS } = require('../models/Like');
const { REPORT_TARGETS } = require('../models/Report');

const DAY = 24 * 60 * 60 * 1000;

/* ── Media ── */
const uploadBody = z.object({ purpose: z.enum(Object.keys(MEDIA_PURPOSES)) });

/* ── Posts ── */
const mediaIds = (max) => z.array(objectId).max(max, `Attach at most ${max} files.`);

const createPost = z.object({
  type: z.enum(POST_TYPES).default('GENERAL'),
  body: text(1, 5000, 'Your post'),
  mediaIds: mediaIds(LIMITS.postMedia).default([]),
});

const updatePost = z
  .object({
    type: z.enum(POST_TYPES),
    body: text(1, 5000, 'Your post'),
    mediaIds: mediaIds(LIMITS.postMedia),
  })
  .partial();

const postListQuery = z.object({ type: z.enum(POST_TYPES).optional(), page, limit: limit(10, 30) });

/* ── Blogs ── */
 
const markdown = z
  .string()
  // eslint-disable-next-line no-control-regex
  .transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').trim())
  .pipe(
    z
      .string()
      .min(200, 'A blog should be at least 200 characters long.')
      .max(50000, 'A blog can be at most 50,000 characters long.')
  );

const tags = z
  .array(line(1, 30, 'Tag').transform((t) => t.toLowerCase().replace(/^#+/, '')))
  .max(8, 'Add at most 8 tags.')
  .transform((items) => [...new Set(items.filter(Boolean))]);

const createBlog = z.object({
  title: line(5, 160, 'Title'),
  excerpt: line(20, 320, 'Excerpt'),
  body: markdown,
  category: z.enum(BLOG_CATEGORIES),
  tags: tags.default([]),
  coverId: nullableId.default(null),
});

const updateBlog = z
  .object({
    title: line(5, 160, 'Title'),
    excerpt: line(20, 320, 'Excerpt'),
    body: markdown,
    category: z.enum(BLOG_CATEGORIES),
    tags,
    coverId: nullableId,
  })
  .partial();

const blogListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.enum(BLOG_CATEGORIES).optional(),
  tag: z.string().trim().toLowerCase().max(30).optional(),
  author: objectId.optional(), // one doctor's blogs (their portfolio)
  page,
  limit: limit(9, 30),
});

const slugParams = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,200}$/, 'This link is not valid.') });

/* ── Comments ── */
const createComment = z.object({
  targetType: z.enum(COMMENT_TARGETS),
  targetId: objectId,
  body: text(1, 2000, 'Your comment'),
});

const updateComment = z.object({ body: text(1, 2000, 'Your comment') });

const commentListQuery = z.object({
  targetType: z.enum(COMMENT_TARGETS),
  targetId: objectId,
  page,
  limit: limit(10, 50),
});

/* ── Likes ── */
const likeParams = z.object({ targetType: z.enum(LIKE_TARGETS), targetId: objectId });

/* ── Memories ── */
const memoryDate = nullableDate.refine((d) => d === null || d.getTime() <= Date.now() + DAY, 'The date cannot be in the future.');

const createMemory = z.object({
  title: line(3, 140, 'Title'),
  caption: text(0, 1500, 'Caption').default(''),
  eventId: nullableId.default(null),
  memoryDate: memoryDate.default(null),
  mediaIds: mediaIds(LIMITS.memoryMedia).min(1, 'Add at least one photo or video.'),
  showInCommunity: z.boolean().default(true),
});

const updateMemory = z
  .object({
    title: line(3, 140, 'Title'),
    caption: text(0, 1500, 'Caption'),
    eventId: nullableId,
    memoryDate,
    mediaIds: mediaIds(LIMITS.memoryMedia).min(1, 'Add at least one photo or video.'),
    showInCommunity: z.boolean(),
  })
  .partial();

// `owner` asks for one doctor's portfolio gallery instead of the community list.
const memoryListQuery = z.object({ eventId: objectId.optional(), owner: objectId.optional(), page, limit: limit(12, 36) });

const memoryDownloadParams = z.object({ id: objectId, mediaId: objectId });

/* ── Events ── */
const eventFields = {
  title: line(5, 140, 'Title'),
  description: text(10, 4000, 'Description'),
  eventType: z.enum(EVENT_TYPES),
  venue: line(0, 200, 'Venue'),
  city: line(2, 80, 'City'),
  startsAt: date,
  endsAt: nullableDate,
  budgetNote: line(0, 140, 'Budget'),
  coverId: nullableId,
  rsvpEnabled: z.boolean(),
  rsvpDeadline: nullableDate,
  capacity: z.union([z.null(), z.number().int().min(1, 'Enter a valid capacity.').max(100000, 'Enter a valid capacity.')]),
  showOnPublicSite: z.boolean(),
};

const createEvent = z.object({
  ...eventFields,
  venue: eventFields.venue.default(''),
  endsAt: eventFields.endsAt.default(null),
  budgetNote: eventFields.budgetNote.default(''),
  coverId: eventFields.coverId.default(null),
  rsvpEnabled: eventFields.rsvpEnabled.default(true),
  rsvpDeadline: eventFields.rsvpDeadline.default(null),
  capacity: eventFields.capacity.default(null),
  showOnPublicSite: eventFields.showOnPublicSite.default(false),
});

const updateEvent = z.object(eventFields).partial();

const eventListQuery = z.object({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
  type: z.enum(EVENT_TYPES).optional(),
  page,
  limit: limit(9, 30),
});

const rsvpBody = z.object({
  status: z.enum(RSVP_STATUS),
  guests: z.number().int().min(0).max(5, 'You can bring at most 5 guests.').default(0),
});

/* ── Polls ── */
const pollOptions = z
  .array(line(1, 140, 'Option'))
  .min(LIMITS.pollOptionsMin, `Add at least ${LIMITS.pollOptionsMin} options.`)
  .max(LIMITS.pollOptionsMax, `Add at most ${LIMITS.pollOptionsMax} options.`)
  .refine((items) => new Set(items.map((i) => i.toLowerCase())).size === items.length, 'Each option must be different.');

const createPoll = z.object({
  question: line(8, 240, 'Question'),
  description: text(0, 1000, 'Description').default(''),
  options: pollOptions,
  allowMultiple: z.boolean().default(false),
  resultsVisibility: z.enum(POLL_RESULTS_VISIBILITY).default('AFTER_VOTE'),
  startsAt: nullableDate.default(null),
  endsAt: date,
});

const updatePoll = z
  .object({
    question: line(8, 240, 'Question'),
    description: text(0, 1000, 'Description'),
    options: pollOptions,
    allowMultiple: z.boolean(),
    resultsVisibility: z.enum(POLL_RESULTS_VISIBILITY),
    startsAt: nullableDate,
    endsAt: date,
  })
  .partial();

const pollListQuery = z.object({ state: z.enum(['open', 'closed', 'all']).default('all'), page, limit: limit(10, 30) });

const voteBody = z.object({
  optionIds: z
    .array(objectId)
    .min(1, 'Choose an option.')
    .max(LIMITS.pollOptionsMax)
    .refine((ids) => new Set(ids).size === ids.length, 'Choose each option once.'),
});

/* ── Reports ── */
const createReport = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: objectId,
  reason: z.enum(REPORT_REASONS),
  details: text(0, 1000, 'Details').default(''),
});

/* ── Notifications ── */
const notificationQuery = z.object({
  unread: z.enum(['true', 'false']).optional(),
  page,
  limit: limit(15, 50),
});

module.exports = {
  uploadBody,
  createPost,
  updatePost,
  postListQuery,
  createBlog,
  updateBlog,
  blogListQuery,
  slugParams,
  createComment,
  updateComment,
  commentListQuery,
  likeParams,
  createMemory,
  updateMemory,
  memoryListQuery,
  memoryDownloadParams,
  createEvent,
  updateEvent,
  eventListQuery,
  rsvpBody,
  createPoll,
  updatePoll,
  pollListQuery,
  voteBody,
  createReport,
  notificationQuery,
};
