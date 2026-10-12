const User = require('../models/User');
const Media = require('../models/Media');
const ApiError = require('../utils/ApiError');
const { ok, pageMeta } = require('../utils/respond');
const { paging } = require('../utils/pagination');
const { escapeRegex } = require('../utils/text');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');
const { claimMedia, destroyMedia, unclaim, syncMedia } = require('../services/media.service');
const cloud = require('../services/cloudinary.service');
const {
  requiredProfileIssues,
  serializeSelf,
  serializeDoctorCard,
  serializeDoctorPublicCard,
  serializeDoctorProfile,
} = require('../services/serializers');

const COLLATION = { locale: 'en', strength: 2 }; // case-insensitive matching and sorting

const directoryFilter = () => ({
  role: ROLES.DOCTOR,
  status: ACCOUNT_STATUS.ACTIVE,
  'visibility.directory': true,
});

async function list(req, res) {
  const { q, specialization, city, page, limit } = req.valid.query;
  const filter = directoryFilter();
  if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };
  if (specialization) filter['profile.specialization'] = specialization;
  if (city) filter['profile.city'] = city;

  const { skip } = paging({ page, limit });
  const [doctors, total] = await Promise.all([
    User.find(filter).collation(COLLATION).sort({ name: 1, _id: 1 }).skip(skip).limit(limit),
    User.countDocuments(filter).collation(COLLATION),
  ]);
  return ok(res, doctors.map(serializeDoctorCard), pageMeta({ page, limit, total }));
}

async function filters(_req, res) {
  const base = directoryFilter();
  const [specializations, cities] = await Promise.all([
    User.distinct('profile.specialization', base),
    User.distinct('profile.city', base),
  ]);
  const tidy = (values) =>
    [...new Map(values.filter(Boolean).map((v) => [v.toLowerCase(), v])).values()].sort((a, b) => a.localeCompare(b));
  return ok(res, { specializations: tidy(specializations), cities: tidy(cities) });
}

// Public homepage: only doctors who consented to a public listing AND were
// featured by an admin, and only a handful of non-contact fields.
async function featured(_req, res) {
  const doctors = await User.find({ ...directoryFilter(), 'visibility.publicListing': true, featured: true })
    .sort({ updatedAt: -1 })
    .limit(8);
  return ok(res, doctors.map(serializeDoctorPublicCard));
}

async function getOne(req, res) {
  const doctor = await User.findById(req.valid.params.id);
  const viewer = req.user;
  const isSelf = doctor && String(doctor._id) === String(viewer._id);
  const viewerIsAdmin = viewer.role === ROLES.ADMIN;
  if (
    !doctor ||
    (doctor.role !== ROLES.DOCTOR && !isSelf) ||
    (doctor.status !== ACCOUNT_STATUS.ACTIVE && !viewerIsAdmin && !isSelf)
  ) {
    throw ApiError.notFound('That profile could not be found.');
  }
  return ok(res, serializeDoctorProfile(doctor, viewer));
}

async function getMe(req, res) {
  return ok(res, serializeSelf(req.user));
}

const NO_IMAGE = { media: null, url: '', thumbUrl: '' };

// Awards may carry a photo or certificate. The request names uploads by id; the
// uploads are claimed for this account (they must be the caller's own, unattached
// and made for this purpose) and the URLs are derived here, on the server.
async function attachAwardImages(user, awards) {
  const current = user.profile.achievements.map((a) => a.image && a.image.media).filter(Boolean);
  const next = awards.map((a) => a.imageId).filter(Boolean);
  const sync = await syncMedia({ currentIds: current, nextIds: next, ownerId: user._id, purpose: 'award', kind: 'User', itemId: user._id });
  const docs = await Media.find({ _id: { $in: sync.ids } });
  const byId = new Map(docs.map((m) => [String(m._id), m]));
  const withImages = awards.map(({ imageId, ...award }) => {
    const media = imageId ? byId.get(String(imageId)) : null;
    return { ...award, image: media ? { media: media._id, url: cloud.displayUrl(media), thumbUrl: cloud.thumbUrl(media) } : NO_IMAGE };
  });
  return { awards: withImages, claimed: sync.claimed, removed: sync.removed };
}

async function updateMe(req, res) {
  const { name, profile, visibility, dismissProfilePrompt, wizardStep, submit } = req.valid.body;
  const user = req.user;

  if (name !== undefined) user.name = name;
  // Award images are handled just before saving (below), so nothing is claimed
  // if the request turns out to be refused.
  const { achievements: awards, ...fields } = profile || {};
  if (profile) {
    // Assign field by field: the photo sub-document is managed separately.
    for (const [key, value] of Object.entries(fields)) user.profile[key] = value;
    if (awards) user.profile.achievements = awards.map(({ imageId: _imageId, ...award }) => award); // for the checks below
  }
  if (visibility) {
    const { sections, ...flags } = visibility;
    for (const [key, value] of Object.entries(flags)) user.visibility[key] = value;
    for (const [key, value] of Object.entries(sections || {})) user.visibility.sections[key] = value;
  }
  if (dismissProfilePrompt === true) user.profilePromptDismissedAt = new Date();
  if (wizardStep !== undefined) user.profileWizard.step = wizardStep;

  // Final submission of the profile wizard: the required fields are checked
  // against the profile as it would be stored, and nothing is saved if any is
  // missing. Only a successful save marks the profile as complete.
  if (submit === true) {
    const missing = requiredProfileIssues(user);
    if (Object.keys(missing).length) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Please complete the required fields before submitting your profile.',
        missing
      );
    }
    if (!user.profileWizard.completedAt) user.profileWizard.completedAt = new Date();
  }

  let claimed = [];
  let removed = [];
  if (awards) {
    // Re-read the stored awards: the in-memory copy above no longer has the old images.
    const stored = await User.findById(user._id).select('profile.achievements');
    const result = await attachAwardImages(stored, awards);
    user.profile.achievements = result.awards;
    ({ claimed, removed } = result);
  }

  try {
    await user.save();
  } catch (err) {
    await unclaim(claimed);
    throw err;
  }
  await destroyMedia(removed);
  return ok(res, serializeSelf(user));
}

async function setPhoto(req, res) {
  const user = req.user;
  const previous = user.profile.photo && user.profile.photo.media;

  const [mediaId] = await claimMedia({
    ids: [req.valid.body.mediaId],
    ownerId: user._id,
    purpose: 'profile',
    kind: 'User',
    itemId: user._id,
  });

  try {
    const media = await Media.findById(mediaId);
    user.profile.photo = { media: media._id, url: cloud.displayUrl(media), thumbUrl: cloud.avatarUrl(media) };
    await user.save();
  } catch (err) {
    await unclaim([mediaId]);
    throw err;
  }

  if (previous && String(previous) !== String(mediaId)) await destroyMedia([previous]);
  return ok(res, serializeSelf(user));
}

async function removePhoto(req, res) {
  const user = req.user;
  const previous = user.profile.photo && user.profile.photo.media;
  user.profile.photo = { media: null, url: '', thumbUrl: '' };
  await user.save();
  if (previous) await destroyMedia([previous]);
  return ok(res, serializeSelf(user));
}

module.exports = { list, filters, featured, getOne, getMe, updateMe, setPhoto, removePhoto };
