const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { singleFileUpload } = require('../middleware/upload');
const { idParams } = require('../validators/common');
const v = require('../validators/content.validators');
const media = require('../controllers/media.controller');

module.exports = function mediaRoutes(limiters) {
  const router = express.Router();
  router.use(requireAuth);
  // multipart/form-data with the fields `purpose` and `file`
  router.post('/', limiters.upload, singleFileUpload(), validate({ body: v.uploadBody }), media.upload);
  router.delete('/:id', limiters.write, validate({ params: idParams }), media.remove);
  return router;
};
