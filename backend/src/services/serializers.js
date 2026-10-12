// Explicit output shapes. Controllers never send Mongoose documents directly,
// so internal fields (password hashes, sessions, Cloudinary ids, moderation
// internals of other people's content) cannot leak by accident.
const { ROLES, MODERATION } = require('../config/constants');
const { serializeMedia } = require('./media.service');

const AUTHOR_FIELDS = 'name role status profile.professionalTitle profile.specialization profile.photo';

const idOf = (ref) => (ref && ref._id ? String(ref._id) : ref ? String(ref) : null);
const isAdmin = (viewer) => Boolean(viewer && viewer.role === ROLES.ADMIN);
const owns = (viewer, ownerRef) => Boolean(viewer && idOf(ownerRef) === String(viewer._id));

function authorSummary(user) {
  if (!user || !user.name) {
    return { id: null, name: 'Former member', isAdmin: false, professionalTitle: '', specialization: '', photoUrl: '' };
  }
  const profile = user.profile || {};
  return {
    id: String(user._id),
    name: user.name,
    isAdmin: user.role === ROLES.ADMIN,
    professionalTitle: profile.professionalTitle || '',
    specialization: profile.specialization || '',
    photoUrl: (profile.photo && profile.photo.thumbUrl) || '',
  };
}

function moderationInfo(doc) {
  return {
    status: doc.moderationStatus,
    submittedAt: doc.submittedAt,
    reviewedAt: doc.reviewedAt,
    rejectionReason: doc.moderationStatus === MODERATION.REJECTED ? doc.rejectionReason || '' : '',
  };
}

// Moderation details are only for the owner and admins.
function withModeration(out, doc, viewer, ownerRef) {
  out.isMine = owns(viewer, ownerRef);
  if (out.isMine || isAdmin(viewer)) out.moderation = moderationInfo(doc);
  return out;
}

const mediaList = (list) => (list || []).map(serializeMedia).filter(Boolean);
const mediaOne = (m) => (m && m.publicId ? serializeMedia(m) : null);

/* ───────────── Users ───────────── */

function profileCompletion(user) {
  const p = user.profile || {};
  const checks = [
    ['Profile photo', Boolean(p.photo && p.photo.url)],
    ['Professional title', Boolean(p.professionalTitle || p.designation)],
    ['Specialization', Boolean(p.specialization)],
    ['Hospital or clinic', Boolean(p.hospital)],
    ['City', Boolean(p.city)],
    ['Years of experience', p.yearsOfExperience !== null && p.yearsOfExperience !== undefined],
    ['Short biography', Boolean(p.bio)],
    ['Medical education', Boolean(p.education && p.education.length)],
    ['Qualifications', Boolean(p.qualifications && p.qualifications.length)],
    ['Professional experience', Boolean(p.experience && p.experience.length)],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  const percent = Math.round((done / checks.length) * 100);
  return { percent, isComplete: percent >= 70, missing: checks.filter(([, ok]) => !ok).map(([label]) => label) };
}

function profileBody(user) {
  const p = user.profile || {};
  const plain = (list, fields) =>
    (list || []).map((item) => {
      const out = { id: String(item._id) };
      for (const f of fields) out[f] = item[f] ?? (typeof item[f] === 'boolean' ? false : null);
      return out;
    });
  return {
    photoUrl: (p.photo && p.photo.url) || '',
    professionalTitle: p.professionalTitle || '',
    specialization: p.specialization || '',
    subspecialty: p.subspecialty || '',
    designation: p.designation || '',
    hospital: p.hospital || '',
    city: p.city || '',
    state: p.state || '',
    batchYear: p.batchYear ?? null,
    yearsOfExperience: p.yearsOfExperience ?? null,
    bio: p.bio || '',
    qualifications: [...(p.qualifications || [])],
    interests: [...(p.interests || [])],
    languages: [...(p.languages || [])],
    education: plain(p.education, ['degree', 'institution', 'year']),
    experience: plain(p.experience, ['role', 'organization', 'city', 'startYear', 'endYear', 'current', 'description']),
    achievements: plain(p.achievements, ['title', 'year', 'description']),
    publications: plain(p.publications, ['title', 'journal', 'year', 'url']),
    links: plain(p.links, ['label', 'url']),
  };
}

function visibilityOf(user) {
  const v = user.visibility || {};
  return {
    directory: v.directory !== false,
    publicListing: Boolean(v.publicListing),
    showEmail: Boolean(v.showEmail),
    showPhone: Boolean(v.showPhone),
  };
}

// The signed-in user's own account.
function serializeSelf(user) {
  return {
    id: String(user._id),
    role: user.role,
    status: user.status,
    name: user.name,
    email: user.email,
    phone: user.phone,
    profile: profileBody(user),
    visibility: visibilityOf(user),
    featured: Boolean(user.featured),
    profileCompletion: profileCompletion(user),
    profilePromptDismissed: Boolean(user.profilePromptDismissedAt),
    policyAcceptance: {
      version: (user.policyAcceptance && user.policyAcceptance.version) || '',
      acceptedAt: (user.policyAcceptance && user.policyAcceptance.acceptedAt) || null,
    },
    createdAt: user.createdAt,
  };
}

// Directory card shown to signed-in members.
function serializeDoctorCard(user) {
  const p = user.profile || {};
  return {
    id: String(user._id),
    name: user.name,
    photoUrl: (p.photo && p.photo.thumbUrl) || '',
    professionalTitle: p.professionalTitle || '',
    specialization: p.specialization || '',
    designation: p.designation || '',
    hospital: p.hospital || '',
    city: p.city || '',
    state: p.state || '',
    yearsOfExperience: p.yearsOfExperience ?? null,
    batchYear: p.batchYear ?? null,
  };
}

// Minimal card for the public homepage (requires doctor consent + admin feature flag).
function serializeDoctorPublicCard(user) {
  const p = user.profile || {};
  return {
    id: String(user._id),
    name: user.name,
    photoUrl: (p.photo && p.photo.thumbUrl) || '',
    professionalTitle: p.professionalTitle || '',
    specialization: p.specialization || '',
    city: p.city || '',
  };
}

// Full portfolio for members. Contact details follow the doctor's own settings.
function serializeDoctorProfile(user, viewer) {
  const self = owns(viewer, user);
  const admin = isAdmin(viewer);
  const visibility = visibilityOf(user);

  if (!visibility.directory && !self && !admin) {
    // The doctor opted out of the directory: other members only see a name card.
    const p = user.profile || {};
    return {
      id: String(user._id),
      name: user.name,
      limited: true,
      isMine: false,
      profile: {
        photoUrl: (p.photo && p.photo.url) || '',
        professionalTitle: p.professionalTitle || '',
        specialization: p.specialization || '',
      },
      contact: {},
    };
  }

  const contact = {};
  if (visibility.showEmail || self || admin) contact.email = user.email;
  if (visibility.showPhone || self || admin) contact.phone = user.phone;

  const out = {
    id: String(user._id),
    name: user.name,
    limited: false,
    isMine: self,
    profile: profileBody(user),
    contact,
    memberSince: user.createdAt,
  };
  if (self || admin) out.visibility = visibility;
  return out;
}

// Admin view of a doctor account.
function serializeDoctorAdmin(user) {
  return {
    id: String(user._id),
    role: user.role,
    status: user.status,
    name: user.name,
    email: user.email,
    phone: user.phone,
    profile: profileBody(user),
    visibility: visibilityOf(user),
    featured: Boolean(user.featured),
    profileCompletion: profileCompletion(user),
    suspension:
      user.status === 'SUSPENDED'
        ? { reason: (user.suspension && user.suspension.reason) || '', at: (user.suspension && user.suspension.at) || null }
        : null,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

/* ───────────── Content ───────────── */

function serializePost(post, { viewer, likedIds } = {}) {
  const out = {
    id: String(post._id),
    type: post.type,
    body: post.body,
    media: mediaList(post.media),
    author: authorSummary(post.author),
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    likedByMe: Boolean(likedIds && likedIds.has(String(post._id))),
    createdAt: post.createdAt,
    publishedAt: post.publishedAt,
  };
  return withModeration(out, post, viewer, post.author);
}

function serializeBlogSummary(blog, { viewer } = {}) {
  const out = {
    id: String(blog._id),
    slug: blog.slug,
    title: blog.title,
    excerpt: blog.excerpt,
    category: blog.category,
    tags: [...(blog.tags || [])],
    cover: mediaOne(blog.cover),
    author: authorSummary(blog.author),
    readingMinutes: blog.readingMinutes,
    likeCount: blog.likeCount,
    commentCount: blog.commentCount,
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt,
    publishedAt: blog.publishedAt,
  };
  return withModeration(out, blog, viewer, blog.author);
}

function serializeBlogDetail(blog, { viewer, likedByMe = false, includeSource = false } = {}) {
  const out = serializeBlogSummary(blog, { viewer });
  out.bodyHtml = blog.bodyHtml;
  out.likedByMe = likedByMe;
  if (includeSource && (out.isMine || isAdmin(viewer))) out.bodyMarkdown = blog.bodyMarkdown;
  return out;
}

function serializeComment(comment, { viewer } = {}) {
  const out = {
    id: String(comment._id),
    targetType: comment.targetType,
    targetId: String(comment.target),
    body: comment.body,
    author: authorSummary(comment.author),
    createdAt: comment.createdAt,
  };
  return withModeration(out, comment, viewer, comment.author);
}

function serializeMemory(memory, { viewer, likedIds } = {}) {
  // An unpublished event's title must not leak through a published memory.
  const eventVisible =
    memory.event &&
    memory.event.title &&
    (memory.event.moderationStatus === MODERATION.APPROVED || owns(viewer, memory.owner) || isAdmin(viewer));
  const event = eventVisible ? { id: String(memory.event._id), title: memory.event.title } : null;
  const out = {
    id: String(memory._id),
    title: memory.title,
    caption: memory.caption,
    memoryDate: memory.memoryDate,
    event,
    media: mediaList(memory.media),
    owner: authorSummary(memory.owner),
    likeCount: memory.likeCount,
    commentCount: memory.commentCount,
    likedByMe: Boolean(likedIds && likedIds.has(String(memory._id))),
    createdAt: memory.createdAt,
    publishedAt: memory.publishedAt,
  };
  return withModeration(out, memory, viewer, memory.owner);
}

function serializeEvent(event, { viewer, counts, myRsvp } = {}) {
  const now = Date.now();
  const c = counts || { going: 0, maybe: 0, notGoing: 0, guests: 0 };
  const out = {
    id: String(event._id),
    title: event.title,
    description: event.description,
    eventType: event.eventType,
    venue: event.venue,
    city: event.city,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    budgetNote: event.budgetNote,
    cover: mediaOne(event.cover),
    organizer: authorSummary(event.organizer),
    rsvpEnabled: event.rsvpEnabled,
    rsvpDeadline: event.rsvpDeadline,
    capacity: event.capacity,
    showOnPublicSite: event.showOnPublicSite,
    isPast: new Date(event.endsAt).getTime() < now,
    rsvp: {
      going: c.going,
      maybe: c.maybe,
      notGoing: c.notGoing,
      guests: c.guests,
      attending: c.going + c.guests,
      mine: myRsvp ? { status: myRsvp.status, guests: myRsvp.guests } : null,
    },
    commentCount: event.commentCount,
    createdAt: event.createdAt,
    publishedAt: event.publishedAt,
  };
  return withModeration(out, event, viewer, event.organizer);
}

// The only event fields that ever appear on public pages.
function serializeEventPublic(event) {
  return {
    id: String(event._id),
    title: event.title,
    eventType: event.eventType,
    city: event.city,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
  };
}

function pollState(poll, now = Date.now()) {
  if (new Date(poll.endsAt).getTime() <= now) return 'CLOSED';
  if (new Date(poll.startsAt).getTime() > now) return 'UPCOMING';
  return 'OPEN';
}

function serializePoll(poll, { viewer, myVote, tally } = {}) {
  const state = pollState(poll);
  const mine = owns(viewer, poll.creator);
  const voted = Boolean(myVote);
  const resultsVisible =
    mine ||
    isAdmin(viewer) ||
    state === 'CLOSED' ||
    poll.resultsVisibility === 'ALWAYS' ||
    (poll.resultsVisibility === 'AFTER_VOTE' && voted);

  const counts = (tally && tally.counts) || {};
  const totalSelections = Object.values(counts).reduce((a, b) => a + b, 0);
  const out = {
    id: String(poll._id),
    question: poll.question,
    description: poll.description,
    allowMultiple: poll.allowMultiple,
    resultsVisibility: poll.resultsVisibility,
    startsAt: poll.startsAt,
    endsAt: poll.endsAt,
    state,
    creator: authorSummary(poll.creator),
    resultsVisible,
    totalVoters: resultsVisible ? (tally ? tally.voters : 0) : null,
    myVote: myVote ? myVote.options.map(String) : null,
    options: poll.options.map((o) => {
      const option = { id: String(o._id), text: o.text };
      if (resultsVisible) {
        const votes = counts[String(o._id)] || 0;
        option.votes = votes;
        option.percent = totalSelections ? Math.round((votes / totalSelections) * 100) : 0;
      }
      return option;
    }),
    createdAt: poll.createdAt,
    publishedAt: poll.publishedAt,
  };
  return withModeration(out, poll, viewer, poll.creator);
}

function serializeNotification(n) {
  return {
    id: String(n._id),
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    read: Boolean(n.readAt),
    createdAt: n.createdAt,
  };
}

module.exports = {
  AUTHOR_FIELDS,
  idOf,
  owns,
  authorSummary,
  moderationInfo,
  profileCompletion,
  pollState,
  serializeSelf,
  serializeDoctorCard,
  serializeDoctorPublicCard,
  serializeDoctorProfile,
  serializeDoctorAdmin,
  serializePost,
  serializeBlogSummary,
  serializeBlogDetail,
  serializeComment,
  serializeMemory,
  serializeEvent,
  serializeEventPublic,
  serializePoll,
  serializeNotification,
};
