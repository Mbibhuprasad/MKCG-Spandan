// Explicit output shapes. Controllers never send Mongoose documents directly,
// so internal fields (password hashes, sessions, Cloudinary ids, moderation
// internals of other people's content) cannot leak by accident.
const {
  ROLES,
  MODERATION,
  PROFILE_SECTIONS,
  PROFILE_WIZARD_STEPS,
  PROFILE_WIZARD_LAYOUT,
  PROFILE_WIZARD_LEGACY_STEP_MAP,
} = require('../config/constants');
const { serializeMedia } = require('./media.service');
const { orderProfile, experienceSummary } = require('./profileOrder');
const { formatIsoDay } = require('../utils/calendar');

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

// What the profile wizard requires before it can be submitted. Keys match the
// request body, so the web form can attach each message to its field.
// Administrators are never listed in the directory, so only their name is required.
const REQUIRED_PROFILE_FIELDS = [
  ['name', 'Full name', (user) => Boolean(user.name && user.name.trim().length >= 2)],
  ['profile.specialization', 'Primary specialization', (user, p) => user.role === ROLES.ADMIN || Boolean(p.specialization)],
  ['profile.city', 'City', (user, p) => user.role === ROLES.ADMIN || Boolean(p.city)],
];

function requiredProfileIssues(user) {
  const p = user.profile || {};
  const issues = {};
  for (const [key, label, present] of REQUIRED_PROFILE_FIELDS) {
    if (!present(user, p)) issues[key] = `${label} is required.`;
  }
  return issues;
}

// The step the wizard reopens on. A position saved by the former 11-step wizard
// is translated to the step that now covers the same ground.
function resumeStepOf(wizard) {
  const step = wizard.step || 0;
  if (wizard.layout === PROFILE_WIZARD_LAYOUT) return Math.min(step, PROFILE_WIZARD_STEPS - 1);
  return PROFILE_WIZARD_LEGACY_STEP_MAP[step] ?? 0;
}

// `percent` and `missing` describe how much of the portfolio is filled in.
// `isComplete` is the wizard's status: it turns true only once the doctor has
// submitted the wizard (a timestamp written by the API after a successful
// save) and stays true only while the required fields are still present.
function profileCompletion(user) {
  const p = user.profile || {};
  const wizard = user.profileWizard || {};
  const required = requiredProfileIssues(user);
  const requiredMissing = REQUIRED_PROFILE_FIELDS.filter(([key]) => required[key]).map(([, label]) => label);
  const checks = [
    ['Profile photo', Boolean(p.photo && p.photo.url)],
    ['Professional title', Boolean(p.professionalTitle || p.designation)],
    ['Specialization', Boolean(p.specialization)],
    ['Hospital or clinic', Boolean(p.hospital)],
    ['City', Boolean(p.city)],
    ['Short biography', Boolean(p.bio)],
    ['Medical education', Boolean(p.education && p.education.length)],
    ['Qualifications', Boolean((p.qualifications && p.qualifications.length) || (p.credentials && p.credentials.length))],
    ['Professional experience', Boolean(p.experience && p.experience.length)],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  const percent = Math.round((done / checks.length) * 100);
  return {
    percent,
    isComplete: Boolean(wizard.completedAt) && requiredMissing.length === 0,
    missing: checks.filter(([, ok]) => !ok).map(([label]) => label),
    requiredMissing,
    completedAt: wizard.completedAt || null,
    resumeStep: resumeStepOf(wizard),
  };
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
    headline: p.headline || '',
    bloodGroup: p.bloodGroup || '',
    dateOfBirth: formatIsoDay(p.dateOfBirth), // "YYYY-MM-DD" or null
    address: p.address || '',
    specialization: p.specialization || '',
    subspecialty: p.subspecialty || '',
    fieldOfWork: p.fieldOfWork || '',
    expertise: [...(p.expertise || [])],
    procedures: [...(p.procedures || [])],
    practiceArea: p.practiceArea || '',
    designation: p.designation || '',
    hospital: p.hospital || '',
    city: p.city || '',
    state: p.state || '',
    country: p.country || '',
    workAddress: p.workAddress || '',
    workEmail: p.workEmail || '',
    workPhone: p.workPhone || '',
    batchYear: p.batchYear ?? null,
    yearsOfExperience: p.yearsOfExperience ?? null,
    bio: p.bio || '',
    qualifications: [...(p.qualifications || [])],
    interests: [...(p.interests || [])],
    languages: [...(p.languages || [])],
    education: plain(p.education, ['degree', 'level', 'institution', 'fieldOfStudy', 'startYear', 'year', 'certification', 'details']),
    credentials: plain(p.credentials, ['title', 'type', 'institution', 'year', 'registration', 'details']),
    experience: plain(p.experience, [
      'role',
      'organization',
      'employmentType',
      'city',
      'state',
      'startYear',
      'endYear',
      'current',
      'description',
    ]),
    fellowships: plain(p.fellowships, ['title', 'institution', 'specialty', 'startYear', 'endYear', 'certificate', 'description']),
    achievements: (p.achievements || []).map((item) => ({
      id: String(item._id),
      title: item.title,
      issuer: item.issuer || '',
      year: item.year ?? null,
      description: item.description || '',
      imageId: item.image && item.image.media ? String(item.image.media) : null,
      imageUrl: (item.image && item.image.url) || '',
      imageThumbUrl: (item.image && item.image.thumbUrl) || '',
    })),
    memberships: plain(p.memberships, ['organization', 'type', 'number', 'startYear', 'endYear', 'current']),
    practiceLocations: plain(p.practiceLocations, ['hospital', 'designation', 'area', 'address', 'city', 'state', 'country', 'phone']),
    publications: plain(p.publications, ['title', 'journal', 'authors', 'year', 'description', 'url']),
    links: plain(p.links, ['label', 'url']),
  };
}

// The doctor's WhatsApp number. When they said it is the same as their
// registered phone number, that number is used instead of a second copy.
function whatsappOf(user) {
  const w = user.whatsapp || {};
  return (w.sameAsPhone ? user.phone : w.number) || '';
}

function visibilityOf(user) {
  const v = user.visibility || {};
  const sections = v.sections || {};
  return {
    directory: v.directory !== false,
    portfolio: v.portfolio !== false,
    publicListing: Boolean(v.publicListing),
    showEmail: Boolean(v.showEmail),
    showPhone: Boolean(v.showPhone),
    showWhatsapp: v.showWhatsapp !== false,
    showWorkContact: v.showWorkContact !== false,
    showRegistration: Boolean(v.showRegistration),
    showBloodGroup: Boolean(v.showBloodGroup),
    showBirthday: v.showBirthday !== false,
    sections: Object.fromEntries(PROFILE_SECTIONS.map((key) => [key, sections[key] !== false])),
  };
}

// The profile as another member may see it. The doctor's visibility choices are
// applied here, on the server, so hidden details never leave the API — the web
// app has nothing to hide because it never receives them.
function memberProfileBody(user, visibility) {
  const body = profileBody(user);
  const { sections } = visibility;

  // Workplace contact details travel in `contact`, and only when allowed.
  body.workEmail = '';
  body.workPhone = '';
  // Private unless the doctor opted in. No section switch can reveal it.
  if (!visibility.showBloodGroup) body.bloodGroup = '';
  // Never shared: members only see the doctor in "Today's Birthdays" on the day.
  body.dateOfBirth = null;

  if (!visibility.showWorkContact) body.practiceLocations = body.practiceLocations.map((l) => ({ ...l, phone: '' }));
  if (!visibility.showRegistration) {
    body.credentials = body.credentials.map((c) => ({ ...c, registration: '' }));
    body.memberships = body.memberships.map((m) => ({ ...m, number: '' }));
  }
  if (!sections.education) body.education = [];
  if (!sections.qualifications) {
    body.qualifications = [];
    body.credentials = [];
  }
  if (!sections.experience) body.experience = [];
  if (!sections.fellowships) body.fellowships = [];
  if (!sections.achievements) body.achievements = [];
  if (!sections.memberships) body.memberships = [];
  if (!sections.publications) body.publications = [];
  if (!sections.links) body.links = [];
  return body;
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
    whatsapp: { number: whatsappOf(user), sameAsPhone: Boolean(user.whatsapp && user.whatsapp.sameAsPhone) },
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

// Directory card shown to signed-in members. `contact` carries a phone number
// only under the same rules as the portfolio: the account phone with
// visibility.showPhone, the workplace phone with visibility.showWorkContact
// (the doctor themselves and admins always see theirs).
function serializeDoctorCard(user, viewer) {
  const p = user.profile || {};
  const visibility = visibilityOf(user);
  const always = owns(viewer, user) || isAdmin(viewer);
  const contact = {};
  if (visibility.showPhone || always) contact.phone = user.phone;
  if (p.workPhone && (visibility.showWorkContact || always)) contact.workPhone = p.workPhone;
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
    contact,
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

  if ((!visibility.directory || !visibility.portfolio) && !self && !admin) {
    // The doctor opted out of the directory, or keeps the portfolio to
    // themselves: other members only see a name card.
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

  const p = user.profile || {};
  const contact = {};
  if (visibility.showEmail || self || admin) contact.email = user.email;
  if (visibility.showPhone || self || admin) contact.phone = user.phone;
  const whatsapp = whatsappOf(user);
  if (whatsapp && (visibility.showWhatsapp || self || admin)) contact.whatsapp = whatsapp;
  if (visibility.showWorkContact || self || admin) {
    if (p.workEmail) contact.workEmail = p.workEmail;
    if (p.workPhone) contact.workPhone = p.workPhone;
  }

  // The portfolio shows each repeated section in display order (most recent or
  // highest first); the stored order, which the profile form edits, is untouched.
  const profile = orderProfile(self || admin ? profileBody(user) : memberProfileBody(user, visibility));
  const out = {
    id: String(user._id),
    name: user.name,
    limited: false,
    isMine: self,
    profile,
    // Derived from what this viewer may see, so a hidden section reveals nothing here.
    summary: { experience: experienceSummary(profile.experience) },
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
    showInCommunity: memory.showInCommunity !== false,
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

// A travel plan stored on an RSVP, or null when the member has not shared one.
function serializeTravel(travel) {
  if (!travel || !travel.arrivalAt) return null;
  return {
    from: travel.from,
    arrivalAt: travel.arrivalAt,
    departureAt: travel.departureAt,
    note: travel.note || '',
    updatedAt: travel.updatedAt,
  };
}

// One row of an event's schedule: who is coming, from where, and when. Only the
// member summary that appears on every post is included — no contact details.
function serializeScheduleEntry(rsvp, { viewer } = {}) {
  return {
    id: String(rsvp._id),
    doctor: authorSummary(rsvp.user),
    status: rsvp.status,
    travel: serializeTravel(rsvp.travel),
    isMine: owns(viewer, rsvp.user),
  };
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
    address: event.address || '',
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
      mine: myRsvp ? { status: myRsvp.status, guests: myRsvp.guests, travel: serializeTravel(myRsvp.travel) } : null,
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
  requiredProfileIssues,
  whatsappOf,
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
  serializeTravel,
  serializeScheduleEntry,
  serializePoll,
  serializeNotification,
};
