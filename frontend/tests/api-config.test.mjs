// node --test tests/ — checks how the website resolves the API address.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiConfigError,
  DEVELOPMENT_BACKEND_URL,
  PRODUCTION_BACKEND_URL,
  apiUrl,
  normalizeBackendUrl,
  resolveBackendUrl,
} from '../src/lib/api-config.mjs';

test('production without a configured address uses the Render API', () => {
  assert.equal(PRODUCTION_BACKEND_URL, 'https://mkcg-spandan.onrender.com');
  assert.deepEqual(resolveBackendUrl({ NODE_ENV: 'production' }), { url: PRODUCTION_BACKEND_URL, source: 'production default' });
  // Vercel builds run with NODE_ENV=production and VERCEL=1.
  assert.equal(resolveBackendUrl({ NODE_ENV: 'production', VERCEL: '1' }).url, PRODUCTION_BACKEND_URL);
});

test('local development without a configured address uses localhost:5000', () => {
  assert.equal(resolveBackendUrl({ NODE_ENV: 'development' }).url, 'http://localhost:5000');
  assert.equal(resolveBackendUrl({}).url, DEVELOPMENT_BACKEND_URL);
});

test('production never falls back to localhost', () => {
  for (const env of [{ NODE_ENV: 'production' }, { NODE_ENV: 'production', VERCEL: '1' }, { NODE_ENV: 'production', BACKEND_URL: '' }]) {
    assert.doesNotMatch(resolveBackendUrl(env).url, /localhost|127\.0\.0\.1/);
  }
});

test('an explicit address wins and is normalised', () => {
  assert.equal(resolveBackendUrl({ NODE_ENV: 'production', BACKEND_URL: 'https://mkcg-spandan.onrender.com/' }).url, PRODUCTION_BACKEND_URL);
  assert.equal(resolveBackendUrl({ NODE_ENV: 'production', BACKEND_URL: ' https://mkcg-spandan.onrender.com/api/v1/ ' }).url, PRODUCTION_BACKEND_URL);
  assert.equal(resolveBackendUrl({ NODE_ENV: 'development', BACKEND_URL: 'http://localhost:5100' }).url, 'http://localhost:5100');
  // A base path in front of the API is kept; only a trailing /api/v1 is removed.
  assert.equal(normalizeBackendUrl('https://example.com/backend/api/v1'), 'https://example.com/backend');
  assert.equal(normalizeBackendUrl('https://example.com/backend/'), 'https://example.com/backend');
});

test('NEXT_PUBLIC_API_URL is accepted as an alias; BACKEND_URL takes precedence', () => {
  assert.deepEqual(resolveBackendUrl({ NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://mkcg-spandan.onrender.com' }), {
    url: PRODUCTION_BACKEND_URL,
    source: 'NEXT_PUBLIC_API_URL',
  });
  const both = resolveBackendUrl({ NODE_ENV: 'production', BACKEND_URL: 'https://a.example.com', NEXT_PUBLIC_API_URL: 'https://b.example.com' });
  assert.equal(both.url, 'https://a.example.com');
  assert.match(both.warning, /different addresses/);
});

test('invalid addresses are refused instead of guessed', () => {
  for (const value of ['mkcg-spandan.onrender.com', 'ftp://example.com', 'https://user:pw@example.com', 'https://example.com/?x=1']) {
    assert.throws(() => resolveBackendUrl({ NODE_ENV: 'production', BACKEND_URL: value }), ApiConfigError, value);
  }
});

test('a Vercel deployment refuses a localhost address', () => {
  for (const value of ['http://localhost:5000', 'http://127.0.0.1:5000', 'http://[::1]:5000']) {
    assert.throws(() => resolveBackendUrl({ NODE_ENV: 'production', VERCEL: '1', BACKEND_URL: value }), /Vercel deployment cannot reach/);
  }
  // A local production build may still point at a local API on purpose.
  assert.equal(resolveBackendUrl({ NODE_ENV: 'production', BACKEND_URL: 'http://localhost:5100' }).url, 'http://localhost:5100');
});

test('apiUrl adds the /api/v1 prefix exactly once', () => {
  assert.equal(apiUrl(PRODUCTION_BACKEND_URL, '/health'), 'https://mkcg-spandan.onrender.com/api/v1/health');
  assert.equal(apiUrl(PRODUCTION_BACKEND_URL, 'blogs'), 'https://mkcg-spandan.onrender.com/api/v1/blogs');
  assert.equal(apiUrl(normalizeBackendUrl('https://mkcg-spandan.onrender.com/api/v1'), '/health'), 'https://mkcg-spandan.onrender.com/api/v1/health');
});
