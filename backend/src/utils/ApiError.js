class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }

  static badRequest(message = 'Invalid request.', details, code = 'BAD_REQUEST') {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'Please sign in to continue.', code = 'UNAUTHENTICATED') {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'You do not have permission to do that.', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }

  static notFound(message = 'Not found.', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }

  static conflict(message = 'Conflict.', details, code = 'CONFLICT') {
    return new ApiError(409, code, message, details);
  }

  static unavailable(message = 'Service temporarily unavailable.', code = 'SERVICE_UNAVAILABLE') {
    return new ApiError(503, code, message);
  }
}

module.exports = ApiError;
