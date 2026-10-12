const Media = require('../models/Media');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { getEnv } = require('../config/env');
const { MEDIA_PURPOSES } = require('../config/constants');
const { detectFileType, ALLOWED_FORMATS } = require('../utils/fileSignature');
const cloud = require('./cloudinary.service');

function serializeMedia(media) {
  if (!media || !media.publicId) return null;
  return {
    id: String(media._id),
    resourceType: media.resourceType,
    format: media.format,
    width: media.width,
    height: media.height,
    duration: media.duration,
    bytes: media.bytes,
    url: cloud.displayUrl(media),
    thumbUrl: cloud.thumbUrl(media),
  };
}

// Validates the real file content, uploads it to Cloudinary and records the
// metadata. If the database write fails the Cloudinary asset is removed again,
// so a failed upload never leaves an inconsistent record behind.
async function createFromUpload({ file, purpose, user }) {
  const rules = MEDIA_PURPOSES[purpose];
  if (!rules) throw ApiError.badRequest('Unknown upload purpose.', { purpose: 'Choose a valid upload purpose.' });
  if (!file || !file.buffer || !file.buffer.length) {
    throw ApiError.badRequest('Please choose a file to upload.', { file: 'A file is required.' }, 'UPLOAD_INVALID');
  }

  const detected = detectFileType(file.buffer);
  if (!detected || !rules.kinds.includes(detected.kind)) {
    const allowed = rules.kinds.flatMap((k) => ALLOWED_FORMATS[k]).join(', ').toUpperCase();
    throw ApiError.badRequest(
      `That file type is not supported here. Allowed formats: ${allowed}.`,
      { file: 'Unsupported file type.' },
      'UNSUPPORTED_MEDIA_TYPE'
    );
  }

  const env = getEnv();
  const maxBytes = detected.kind === 'video' ? env.maxVideoBytes : env.maxImageBytes;
  if (file.buffer.length > maxBytes) {
    throw new ApiError(
      413,
      'FILE_TOO_LARGE',
      `That ${detected.kind} is too large. The limit is ${Math.round(maxBytes / (1024 * 1024))} MB.`
    );
  }

  let uploaded;
  try {
    uploaded = await cloud.uploadBuffer(file.buffer, {
      folder: `${env.cloudinary.folder}/${rules.folder}/${user.id}`,
      resourceType: detected.kind,
      deliveryType: rules.deliveryType,
      formats: ALLOWED_FORMATS[detected.kind],
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.error('Cloudinary upload failed:', err && err.message ? err.message : err);
    throw new ApiError(502, 'UPLOAD_FAILED', 'The upload could not be completed. Please try again.');
  }

  const descriptor = {
    publicId: uploaded.public_id,
    resourceType: detected.kind,
    deliveryType: rules.deliveryType,
  };
  try {
    return await Media.create({
      ...descriptor,
      owner: user._id,
      purpose,
      format: uploaded.format || detected.format,
      bytes: uploaded.bytes || file.buffer.length,
      width: uploaded.width ?? null,
      height: uploaded.height ?? null,
      duration: uploaded.duration ?? null,
    });
  } catch (err) {
    await cloud.destroyAsset(descriptor);
    throw err;
  }
}

async function unclaim(ids) {
  if (!ids.length) return;
  await Media.updateMany({ _id: { $in: ids } }, { $set: { 'attachedTo.kind': null, 'attachedTo.item': null, attachedAt: null } });
}

// Attaches uploads to a content item. Each id must be an unattached upload that
// belongs to the caller and was made for this purpose — a client can never
// attach someone else's asset or an arbitrary URL.
async function claimMedia({ ids, ownerId, purpose, kind, itemId }) {
  const unique = [...new Set(ids.map(String))];
  const claimed = [];
  for (const id of unique) {
    const media = await Media.findOneAndUpdate(
      { _id: id, owner: ownerId, purpose, 'attachedTo.item': null },
      { $set: { 'attachedTo.kind': kind, 'attachedTo.item': itemId, attachedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!media) {
      await unclaim(claimed);
      throw ApiError.badRequest(
        'One of the attached files is not available. Please upload it again.',
        { mediaIds: 'Invalid or unavailable upload.' },
        'MEDIA_INVALID'
      );
    }
    claimed.push(media._id);
  }
  return claimed;
}

async function destroyMedia(ids) {
  const list = (ids || []).filter(Boolean);
  if (!list.length) return;
  const docs = await Media.find({ _id: { $in: list } });
  const results = await Promise.all(docs.map((doc) => cloud.destroyAsset(doc)));
  const removed = docs.filter((_, i) => results[i]).map((d) => d._id);
  const failed = docs.filter((_, i) => !results[i]).map((d) => d._id);
  if (removed.length) await Media.deleteMany({ _id: { $in: removed } });
  // If Cloudinary could not delete an asset (outage), keep its record as an
  // unattached orphan so the periodic cleanup retries instead of losing track of it.
  if (failed.length) await unclaim(failed);
}

// Replaces the media of an existing item: keeps ids already attached to it,
// claims newly uploaded ones and removes the ones that were dropped.
async function syncMedia({ currentIds, nextIds, ownerId, purpose, kind, itemId }) {
  const current = (currentIds || []).filter(Boolean).map(String);
  const next = [...new Set((nextIds || []).map(String))];
  const toClaim = next.filter((id) => !current.includes(id));
  const toRemove = current.filter((id) => !next.includes(id));
  await claimMedia({ ids: toClaim, ownerId, purpose, kind, itemId });
  return { ids: next, removed: toRemove, claimed: toClaim };
}

// Removes uploads that were never attached to anything (abandoned forms).
async function cleanupOrphans(olderThanMs = 24 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const orphans = await Media.find({ 'attachedTo.item': null, createdAt: { $lt: cutoff } }).limit(200);
  let removed = 0;
  for (const doc of orphans) {
    if (!(await cloud.destroyAsset(doc))) continue; // try again on the next run
    await Media.deleteOne({ _id: doc._id, 'attachedTo.item': null });
    removed += 1;
  }
  return removed;
}

module.exports = { serializeMedia, createFromUpload, claimMedia, unclaim, destroyMedia, syncMedia, cleanupOrphans };
