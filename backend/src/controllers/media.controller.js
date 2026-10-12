const Media = require('../models/Media');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/respond');
const { createFromUpload, serializeMedia, destroyMedia } = require('../services/media.service');

async function upload(req, res) {
  const media = await createFromUpload({ file: req.file, purpose: req.valid.body.purpose, user: req.user });
  return created(res, serializeMedia(media));
}

// Lets the uploader discard a file they have not attached to anything yet.
async function remove(req, res) {
  const media = await Media.findOne({ _id: req.valid.params.id, owner: req.user._id });
  if (!media) throw ApiError.notFound('That upload could not be found.');
  if (media.attachedTo && media.attachedTo.item) {
    throw ApiError.conflict('This file is already in use. Remove it from the content it belongs to instead.');
  }
  await destroyMedia([media._id]);
  return ok(res, { deleted: true });
}

module.exports = { upload, remove };
