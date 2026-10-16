const { getCloudinary } = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// Delivery transformations. The video ones are also requested as eager
// transformations at upload time so large videos never transcode on first view.
const TRANSFORMS = Object.freeze({
  imageDisplay: { width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
  imageThumb: { width: 600, height: 600, crop: 'fill', gravity: 'auto', quality: 'auto', fetch_format: 'auto' },
  // Chat bubbles: the whole photo (never cropped), small enough for a timeline.
  imagePreview: { width: 800, height: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
  avatar: { width: 320, height: 320, crop: 'fill', gravity: 'face', quality: 'auto', fetch_format: 'auto' },
  videoDisplay: { quality: 'auto' },
  videoPoster: { width: 600, height: 600, crop: 'fill', start_offset: '0' },
});

function requireCloudinary() {
  const cloudinary = getCloudinary();
  if (!cloudinary) {
    throw ApiError.unavailable(
      'Media uploads are not available because Cloudinary is not configured on the server.',
      'MEDIA_NOT_CONFIGURED'
    );
  }
  return cloudinary;
}

function uploadBuffer(buffer, { folder, resourceType, deliveryType, formats }) {
  const cloudinary = requireCloudinary();
  const options = {
    folder,
    resource_type: resourceType,
    type: deliveryType,
    allowed_formats: formats,
    use_filename: false, // never leak original filenames
    unique_filename: true,
    overwrite: false,
  };
  if (resourceType === 'video') {
    options.eager = [
      { ...TRANSFORMS.videoDisplay, format: 'mp4' },
      { ...TRANSFORMS.videoPoster, format: 'jpg' },
    ];
    options.eager_async = true;
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) return reject(error || new Error('Empty Cloudinary response'));
      resolve(result);
    });
    stream.end(buffer);
  });
}

async function destroyAsset({ publicId, resourceType, deliveryType }) {
  const cloudinary = getCloudinary();
  if (!cloudinary) return false;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: deliveryType, invalidate: true });
    return true;
  } catch (err) {
    logger.error('Cloudinary destroy failed for an asset:', err.message);
    return false;
  }
}

function buildUrl(media, transformation, format) {
  const cloudinary = getCloudinary();
  if (!cloudinary) return '';
  const options = {
    resource_type: media.resourceType,
    type: media.deliveryType,
    secure: true,
    // Authenticated assets are only reachable with a signature made from the API secret.
    sign_url: media.deliveryType === 'authenticated',
    transformation: [transformation],
  };
  if (format) options.format = format;
  return cloudinary.url(media.publicId, options);
}

function displayUrl(media) {
  return media.resourceType === 'video'
    ? buildUrl(media, TRANSFORMS.videoDisplay, 'mp4')
    : buildUrl(media, TRANSFORMS.imageDisplay);
}

function thumbUrl(media) {
  return media.resourceType === 'video'
    ? buildUrl(media, TRANSFORMS.videoPoster, 'jpg')
    : buildUrl(media, TRANSFORMS.imageThumb);
}

function avatarUrl(media) {
  return buildUrl(media, TRANSFORMS.avatar);
}

function previewUrl(media) {
  return media.resourceType === 'video' ? thumbUrl(media) : buildUrl(media, TRANSFORMS.imagePreview);
}

// Short-lived, signed download link for the original file of a private asset.
function downloadUrl(media, ttlSeconds = 300) {
  const cloudinary = requireCloudinary();
  return cloudinary.utils.private_download_url(media.publicId, media.format, {
    resource_type: media.resourceType,
    type: media.deliveryType,
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
    attachment: true,
  });
}

// Fetches the original file of a private asset on the server, for endpoints
// that stream it to an authorised member instead of handing out a link.
// Resolves with a fetch Response; rejects with ApiError when Cloudinary fails.
async function fetchOriginal(media) {
  const url = downloadUrl(media, 60);
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  } catch (err) {
    logger.error('Cloudinary download failed:', err && err.message ? err.message : err);
    throw new ApiError(502, 'DOWNLOAD_FAILED', 'The file could not be fetched right now. Please try again.');
  }
  if (!response.ok || !response.body) {
    logger.error(`Cloudinary download answered ${response.status}`);
    throw new ApiError(502, 'DOWNLOAD_FAILED', 'The file could not be fetched right now. Please try again.');
  }
  return response;
}

module.exports = {
  uploadBuffer,
  destroyAsset,
  displayUrl,
  thumbUrl,
  avatarUrl,
  previewUrl,
  downloadUrl,
  fetchOriginal,
  TRANSFORMS,
};
