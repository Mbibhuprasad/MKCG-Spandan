const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

function notFoundHandler(_req, _res, next) {
  next(ApiError.notFound('The requested resource was not found.'));
}

function toApiError(err) {
  if (err instanceof ApiError) return err;

  // Body parser
  if (err.type === 'entity.too.large') return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request is too large.');
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return ApiError.badRequest('The request body is not valid JSON.');
  }

  // Multer
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') return new ApiError(413, 'FILE_TOO_LARGE', 'That file is too large.');
    return ApiError.badRequest('The upload could not be processed.', undefined, 'UPLOAD_INVALID');
  }

  // Mongoose
  if (err.name === 'ValidationError' && err.errors) {
    const details = {};
    for (const [path, e] of Object.entries(err.errors)) details[path] = e.message;
    return new ApiError(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', details);
  }
  if (err.name === 'CastError') return ApiError.badRequest('An identifier in the request is not valid.');
  if (err.code === 11000) return ApiError.conflict('That record already exists.');

  return null;
}

 
function errorHandler(err, req, res, _next) {
  const apiError = toApiError(err);

  if (!apiError) {
    // Unexpected failure: log the detail server-side, return nothing sensitive.
    logger.error(`${req.method} ${req.originalUrl} →`, err && err.stack ? err.stack : err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' },
    });
  }

  const error = { code: apiError.code, message: apiError.message };
  if (apiError.details) error.details = apiError.details;
  return res.status(apiError.status).json({ success: false, error });
}

module.exports = { notFoundHandler, errorHandler };
