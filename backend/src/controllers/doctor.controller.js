const User = require('../models/User');
const Media = require('../models/Media');
const ApiError = require('../utils/ApiError');
const { ok, pageMeta } = require('../utils/respond');
const { paging } = require('../utils/pagination');
const { escapeRegex } = require('../utils/text');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');
const { claimMedia, destroyMedia, unclaim } = require('../services/media.service');
const cloud = require('../services/cloudinary.service');
const {
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

async function updateMe(req, res) {
  const { name, profile, visibility, dismissProfilePrompt } = req.valid.body;
  const user = req.user;

  if (name !== undefined) user.name = name;
  if (profile) {
    // Assign field by field: the photo sub-document is managed separately.
    for (const [key, value] of Object.entries(profile)) user.profile[key] = value;
  }
  if (visibility) {
    for (const [key, value] of Object.entries(visibility)) user.visibility[key] = value;
  }
  if (dismissProfilePrompt === true) user.profilePromptDismissedAt = new Date();

  await user.save();
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
