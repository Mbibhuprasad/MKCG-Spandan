const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { getEnv } = require('../config/env');

function limiter({ windowMs, limit, keyGenerator, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: message || 'Too many requests. Please slow down and try again shortly.' },
      }),
  });
}

const ipKey = (req) => ipKeyGenerator(req.ip || '0.0.0.0');
const userKey = (req) => (req.user ? `u:${req.user.id}` : ipKey(req));

function createRateLimiters() {
  const { rateLimit: cfg } = getEnv();
  return {
    global: limiter({ windowMs: 15 * 60 * 1000, limit: cfg.globalMax, keyGenerator: ipKey }),

    // Per IP + identifier, so one attacker cannot lock everyone else out.
    login: limiter({
      windowMs: 15 * 60 * 1000,
      limit: cfg.loginMax,
      keyGenerator: (req) => {
        const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim().toLowerCase().slice(0, 254) : '';
        return `${ipKey(req)}|${identifier}`;
      },
      message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
    }),
    loginIp: limiter({
      windowMs: 15 * 60 * 1000,
      limit: cfg.loginMax * 5,
      keyGenerator: ipKey,
      message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
    }),
    register: limiter({
      windowMs: 60 * 60 * 1000,
      limit: cfg.registerMax,
      keyGenerator: ipKey,
      message: 'Too many registration attempts. Please try again later.',
    }),
    write: limiter({ windowMs: 5 * 60 * 1000, limit: cfg.writeMax, keyGenerator: userKey }),
    upload: limiter({
      windowMs: 10 * 60 * 1000,
      limit: cfg.uploadMax,
      keyGenerator: userKey,
      message: 'Too many uploads. Please wait a few minutes and try again.',
    }),
    // Batch posters: autosave sends many small updates while a doctor types, so
    // it has its own budget instead of using up the general write limit.
    posterSave: limiter({
      windowMs: 10 * 60 * 1000,
      limit: cfg.posterSaveMax,
      keyGenerator: userKey,
      message: 'Too many saves in a short time. Please wait a moment before saving again.',
    }),
    posterExport: limiter({
      windowMs: 10 * 60 * 1000,
      limit: cfg.posterExportMax,
      keyGenerator: userKey,
      message: 'Too many poster downloads. Please wait a few minutes and try again.',
    }),
  };
}

module.exports = { createRateLimiters };
