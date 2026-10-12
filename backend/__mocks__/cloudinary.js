// Test double for the Cloudinary SDK (used automatically by Jest).
// It records calls so tests can assert on uploads, deletions and signed URLs
// without any network access or real credentials.
const { Writable } = require('stream');

const state = {
  uploads: [],
  destroyed: [],
  failNextUpload: false,
  counter: 0,
};

function reset() {
  state.uploads = [];
  state.destroyed = [];
  state.failNextUpload = false;
}

const v2 = {
  config() {},
  uploader: {
    upload_stream(options, callback) {
      const chunks = [];
      return new Writable({
        write(chunk, _enc, done) {
          chunks.push(chunk);
          done();
        },
        final(done) {
          done();
          if (state.failNextUpload) {
            state.failNextUpload = false;
            return callback(new Error('Simulated Cloudinary outage'));
          }
          state.counter += 1;
          const bytes = Buffer.concat(chunks).length;
          const result = {
            public_id: `${options.folder}/asset_${state.counter}`,
            resource_type: options.resource_type,
            type: options.type,
            format: options.resource_type === 'video' ? 'mp4' : 'png',
            bytes,
            width: 640,
            height: 480,
            duration: options.resource_type === 'video' ? 3.5 : undefined,
          };
          state.uploads.push({ options, result });
          return callback(null, result);
        },
      });
    },
    async destroy(publicId, options) {
      state.destroyed.push({ publicId, options });
      return { result: 'ok' };
    },
  },
  url(publicId, options = {}) {
    const signature = options.sign_url ? 's--testsig--/' : '';
    const ext = options.format ? `.${options.format}` : '';
    return `https://res.cloudinary.com/test-cloud/${options.resource_type}/${options.type}/${signature}${publicId}${ext}`;
  },
  utils: {
    private_download_url(publicId, format, options = {}) {
      return `https://api.cloudinary.com/v1_1/test-cloud/${options.resource_type}/download?public_id=${encodeURIComponent(
        publicId
      )}&format=${format}&type=${options.type}&expires_at=${options.expires_at}&signature=testsig`;
    },
  },
};

module.exports = { v2, __state: state, __reset: reset };
