const { v2: cloudinary } = require('cloudinary');
const { getEnv } = require('./env');

let configured = false;

// Returns the configured Cloudinary SDK, or null when credentials are absent
// (allowed outside production so the rest of the app can still be developed).
function getCloudinary() {
  const env = getEnv();
  if (!env.cloudinary.configured) return null;
  if (!configured) {
    cloudinary.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

module.exports = { getCloudinary };
