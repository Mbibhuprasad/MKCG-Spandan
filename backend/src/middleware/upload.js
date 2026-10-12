const multer = require('multer');
const { getEnv } = require('../config/env');

// Memory storage only: the file lives in RAM for the duration of the request
// and is streamed to Cloudinary. Nothing is ever written to the server's disk.
function singleFileUpload() {
  const env = getEnv();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: Math.max(env.maxImageBytes, env.maxVideoBytes),
      files: 1,
      fields: 5,
      fieldSize: 1024,
    },
  });
  return upload.single('file');
}

module.exports = { singleFileUpload };
