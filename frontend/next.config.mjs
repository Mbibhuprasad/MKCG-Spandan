// The browser only ever talks to this Next.js origin. Requests to /api/v1/* are
// proxied to the Express API, so the session cookie is first-party and no
// cross-site cookie configuration is needed. The API address and its defaults
// are resolved in src/lib/api-config.mjs.
import { API_PREFIX, resolveBackendUrl } from './src/lib/api-config.mjs';

const backend = resolveBackendUrl(process.env);
const BACKEND_URL = backend.url;
const isDev = process.env.NODE_ENV !== 'production';

// Chat's live connection goes straight to the API origin: rewrites cannot carry
// WebSockets. It authenticates with a one-time ticket, never with cookies.
const CHAT_SOCKET_ORIGIN = new URL(BACKEND_URL).origin;
const CHAT_SOCKET_CSP = CHAT_SOCKET_ORIGIN.replace(/^http/, 'ws');

// Build-log diagnostics: the address is public configuration, never a secret.
console.log(`[api] /api/v1/* → ${BACKEND_URL}${API_PREFIX}/* (from ${backend.source})`);
if (backend.warning) console.warn(`[api] ${backend.warning}`);

const csp = [
  "default-src 'self'",
  // Next.js needs inline bootstrap scripts; eval is only required by the dev toolchain.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "media-src 'self' blob: https://res.cloudinary.com",
  "font-src 'self' data:",
  // Cloudinary: the batch poster exporter reads the doctor's own poster photos
  // (CORS) to draw them into the downloaded file. The API's ws(s) origin: chat.
  `connect-src 'self' https://res.cloudinary.com ${CHAT_SOCKET_CSP}${isDev ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_CHAT_SOCKET_ORIGIN: CHAT_SOCKET_ORIGIN },
  experimental: {
    // Media uploads pass through the proxy and can take a while on slow links.
    proxyTimeout: 300000,
  },
  async rewrites() {
    return [{ source: `${API_PREFIX}/:path*`, destination: `${BACKEND_URL}${API_PREFIX}/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
