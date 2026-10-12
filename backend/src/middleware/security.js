const ApiError = require('../utils/ApiError');
const { getEnv } = require('../config/env');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Browsers attach an Origin header to cross-origin and state-changing requests.
// Anything that is not our own frontend is refused before it reaches a route.
function originGuard(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !getEnv().frontendOrigins.includes(origin.replace(/\/+$/, ''))) {
    throw ApiError.forbidden('Requests from this origin are not allowed.', 'ORIGIN_NOT_ALLOWED');
  }
  next();
}

function hasUnsafeKey(value, depth = 0) {
  if (depth > 12) return true;
  if (Array.isArray(value)) return value.some((v) => hasUnsafeKey(v, depth + 1));
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return true;
      }
      if (hasUnsafeKey(value[key], depth + 1)) return true;
    }
  }
  return false;
}

// NoSQL-injection guard: operator-style keys ("$gt", "a.b") are never valid in
// client input. Rejecting them outright complements schema validation.
function rejectOperatorKeys(req, _res, next) {
  if (hasUnsafeKey(req.body) || hasUnsafeKey(req.query) || hasUnsafeKey(req.params)) {
    throw ApiError.badRequest('The request contains characters that are not allowed.', undefined, 'INVALID_INPUT');
  }
  next();
}

module.exports = { originGuard, rejectOperatorKeys };
