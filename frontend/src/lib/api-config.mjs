// Where the Express API runs — the single source of truth for the website.
//
// Browsers never call the API directly: they call this website's own
// /api/v1/* (see next.config.mjs), which Next.js proxies to the address
// resolved here, so the session cookie stays first-party and no CORS setup is
// needed in the browser. Server-side rendering of public pages uses the same
// address (src/lib/server-api.js).
//
// Resolution (read when `next build` / `next dev` / `next start` starts):
//   1. BACKEND_URL, or NEXT_PUBLIC_API_URL as an alias, when set — validated
//      and normalised (trailing slashes and a trailing /api/v1 are removed;
//      /api/v1 is added back by the callers);
//   2. otherwise, in production (next build / next start, Vercel):
//      the deployed Render API;
//   3. otherwise (next dev): the local API on port 5000.
// A deployment on Vercel refuses a localhost address, so a production site
// can never silently send its requests to localhost.
//
// Plain ESM without path aliases: next.config.mjs imports this file too.

export const PRODUCTION_BACKEND_URL = 'https://mkcg-spandan.onrender.com';
export const DEVELOPMENT_BACKEND_URL = 'http://localhost:5000';
export const API_PREFIX = '/api/v1';

const LOOPBACK = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|0\.0\.0\.0)$/i;

export class ApiConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApiConfigError';
  }
}

/** Returns the API origin (plus any base path) without a trailing slash or /api/v1. */
export function normalizeBackendUrl(value, name = 'BACKEND_URL') {
  const text = String(value || '').trim();
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new ApiConfigError(`${name} must be a full http(s) address such as ${PRODUCTION_BACKEND_URL} (got "${text}").`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ApiConfigError(`${name} must start with http:// or https://.`);
  }
  if (url.username || url.password) throw new ApiConfigError(`${name} must not contain a user name or password.`);
  if (url.search || url.hash) throw new ApiConfigError(`${name} must not contain a query string or #fragment.`);
  const path = url.pathname.replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
  return `${url.origin}${path}`;
}

export const isLoopbackUrl = (value) => {
  try {
    return LOOPBACK.test(new URL(value).hostname);
  } catch {
    return false;
  }
};

/**
 * Resolves the API address from an environment object (process.env by default).
 * Returns { url, source } where source names the variable or default used.
 * Throws ApiConfigError for an invalid value, or a localhost address on Vercel.
 */
export function resolveBackendUrl(env = process.env) {
  const backend = String(env.BACKEND_URL || '').trim();
  const alias = String(env.NEXT_PUBLIC_API_URL || '').trim();
  let result;
  if (backend) result = { url: normalizeBackendUrl(backend, 'BACKEND_URL'), source: 'BACKEND_URL' };
  else if (alias) result = { url: normalizeBackendUrl(alias, 'NEXT_PUBLIC_API_URL'), source: 'NEXT_PUBLIC_API_URL' };
  else if (env.NODE_ENV === 'production') result = { url: PRODUCTION_BACKEND_URL, source: 'production default' };
  else result = { url: DEVELOPMENT_BACKEND_URL, source: 'development default' };

  if (backend && alias && normalizeBackendUrl(alias, 'NEXT_PUBLIC_API_URL') !== result.url) {
    result.warning = 'BACKEND_URL and NEXT_PUBLIC_API_URL point at different addresses; BACKEND_URL is used.';
  }
  if (env.VERCEL && isLoopbackUrl(result.url)) {
    throw new ApiConfigError(
      `${result.source} points at ${result.url}, which a Vercel deployment cannot reach. ` +
        `Set BACKEND_URL=${PRODUCTION_BACKEND_URL} in the Vercel project settings, or remove it to use that default.`
    );
  }
  return result;
}

/** Full URL of an API path, e.g. apiUrl('https://x.onrender.com', '/health') → https://x.onrender.com/api/v1/health. */
export const apiUrl = (backendUrl, path = '') => `${backendUrl}${API_PREFIX}${path.startsWith('/') || !path ? path : `/${path}`}`;
