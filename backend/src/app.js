const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { getEnv } = require('./config/env');
const { originGuard, rejectOperatorKeys } = require('./middleware/security');
const { createRateLimiters } = require('./middleware/rateLimiters');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { buildRouter } = require('./routes');

function createApp() {
  const env = getEnv();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);
  app.set('query parser', 'simple'); // flat query strings only — no nested objects

  app.use(helmet());

  // Liveness probe for uptime monitors and the keep-alive timer. Registered
  // before logging and rate limiting so frequent pings neither flood the logs
  // nor use up anyone's request budget. No database work: it must stay cheap.
  app.get('/ping', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and non-browser clients send no Origin header.
        if (!origin || env.frontendOrigins.includes(origin.replace(/\/+$/, ''))) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Client-Type'],
      maxAge: 600,
    })
  );

  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  const limiters = createRateLimiters();
  app.use(limiters.global);

  app.use(originGuard);
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  app.use(rejectOperatorKeys);

  // API responses are per-user and must never be cached by shared caches.
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api/v1', buildRouter(limiters));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
