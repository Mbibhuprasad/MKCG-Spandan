const Poster = require('../models/Poster');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/respond');
const { POSTER_LIMITS } = require('../config/constants');
const posters = require('../services/poster.service');

// Batch Profile Poster Maker. Every query is scoped to the signed-in doctor:
// posters are private and there is no endpoint that reads someone else's.

async function list(req, res) {
  const docs = await Poster.find({ owner: req.user._id })
    .sort({ updatedAt: -1 })
    .limit(POSTER_LIMITS.perDoctor)
    .populate(posters.POPULATE);
  return ok(res, docs.map((doc) => posters.serializePosterSummary(doc, req.user)));
}

async function getOne(req, res) {
  const poster = await posters.loadOwnPoster(req.valid.params.id, req.user);
  return ok(res, posters.serializePoster(poster, req.user));
}

async function create(req, res) {
  const count = await Poster.countDocuments({ owner: req.user._id });
  if (count >= POSTER_LIMITS.perDoctor) {
    throw ApiError.conflict(
      `You can keep up to ${POSTER_LIMITS.perDoctor} posters. Delete one you no longer need to create another.`,
      undefined,
      'POSTER_LIMIT'
    );
  }

  const body = req.valid.body;
  const poster = new Poster({ owner: req.user._id, template: body.template || posters.DEFAULT_TEMPLATE });
  posters.applyContent(poster, body);
  posters.applyStatus(poster, body.status);
  const changes = await posters.applyPhotos(poster, body.photos, req.user._id);
  await posters.savePoster(poster, changes);
  return created(res, posters.serializePoster(poster, req.user));
}

async function update(req, res) {
  const poster = await posters.loadOwnPoster(req.valid.params.id, req.user);
  const body = req.valid.body;
  posters.applyContent(poster, body);
  posters.applyStatus(poster, body.status);
  const changes = await posters.applyPhotos(poster, body.photos, req.user._id);
  await posters.savePoster(poster, changes);
  return ok(res, posters.serializePoster(poster, req.user));
}

async function remove(req, res) {
  const poster = await posters.loadOwnPoster(req.valid.params.id, req.user, { populate: false });
  await posters.deletePoster(poster);
  return ok(res, { deleted: true });
}

// Authorises a download and returns the saved poster it must be drawn from.
// The image itself is drawn in the doctor's browser from these saved values
// (see docs/BATCH_POSTER.md) and is never uploaded or stored anywhere, so a
// poster with private details cannot end up at a public URL.
async function exportPoster(req, res) {
  const poster = await posters.loadOwnPoster(req.valid.params.id, req.user);
  const missing = posters.missingRequired(poster);
  if (Object.keys(missing).length || poster.status !== 'READY') {
    throw new ApiError(
      409,
      'POSTER_NOT_READY',
      'Finish the poster and save it before downloading it.',
      Object.keys(missing).length ? missing : undefined
    );
  }
  const now = new Date();
  // Recording an export is not an edit: leave `updatedAt` alone.
  await Poster.updateOne({ _id: poster._id }, { $set: { lastExportedAt: now }, $inc: { exportCount: 1 } }, { timestamps: false });
  poster.lastExportedAt = now;
  poster.exportCount = (poster.exportCount || 0) + 1;
  return ok(res, { format: req.valid.body.format, poster: posters.serializePoster(poster, req.user) });
}

module.exports = { list, getOne, create, update, remove, exportPoster };
