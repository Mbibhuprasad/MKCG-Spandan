// REST client for the existing MKCGSPANDAN API.
//
// The app authenticates the way docs/AUTHENTICATION.md describes for mobile
// clients: `X-Client-Type: mobile` on register/login returns a session token,
// which is then sent as `Authorization: Bearer <token>`. The token is held in
// memory here and persisted by AuthContext in the device's secure storage.
import { API_URL, REQUEST_TIMEOUT_MS, UPLOAD_TIMEOUT_MS, isApiConfigured } from './config';

export class ApiError extends Error {
  constructor({ status = 0, code = 'UNKNOWN', message = 'Something went wrong. Please try again.', details = null }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetwork() {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT';
  }
}

let token = null;
let authFailureHandler = null;

export const setToken = (value) => {
  token = value || null;
};
export const getToken = () => token;
// Called when the API says the session is no longer usable.
export const onAuthFailure = (handler) => {
  authFailureHandler = handler;
};

const AUTH_FAILURE_CODES = new Set(['SESSION_EXPIRED', 'UNAUTHENTICATED', 'ACCOUNT_SUSPENDED']);

function buildUrl(path, query) {
  let url = `${API_URL}${path}`;
  if (query) {
    const parts = [];
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
    if (parts.length) url += `?${parts.join('&')}`;
  }
  return url;
}

function toApiError(status, payload) {
  const error = (payload && payload.error) || {};
  return new ApiError({
    status,
    code: error.code || (status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN'),
    message: error.message || 'Something went wrong. Please try again.',
    details: error.details || null,
  });
}

function reportAuthFailure(error, hadToken) {
  if (hadToken && AUTH_FAILURE_CODES.has(error.code) && authFailureHandler) authFailureHandler(error);
}

const notConfigured = () =>
  new ApiError({ code: 'NOT_CONFIGURED', message: 'This build has no server address. Set EXPO_PUBLIC_API_URL and rebuild.' });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Resolves with { data, meta }. Rejects with ApiError.
//
// Only reads are retried: a GET that could not reach the server is tried once
// more after a short pause. Requests that change something are never repeated
// automatically, so a flaky connection cannot create a second post, event or
// message (chat messages carry their own idempotency key instead).
export async function request(method, path, options = {}) {
  const retries = options.retries ?? (method === 'GET' ? 1 : 0);
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await send(method, path, options);
    } catch (err) {
      if (!(err instanceof ApiError) || !err.isNetwork || attempt >= retries) throw err;
      await wait(700);
    }
  }
}

async function send(method, path, { query, body, auth = true, headers, timeout = REQUEST_TIMEOUT_MS } = {}) {
  if (!isApiConfigured) throw notConfigured();
  const sentToken = auth ? token : null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : null),
        ...(sentToken ? { Authorization: `Bearer ${sentToken}` } : null),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err && err.name === 'AbortError';
    throw new ApiError({
      code: timedOut ? 'TIMEOUT' : 'NETWORK',
      message: timedOut
        ? 'The server took too long to answer. Please try again.'
        : 'Could not reach the server. Check your connection and try again.',
    });
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.success !== true) {
    const error = toApiError(response.status, payload);
    reportAuthFailure(error, Boolean(sentToken));
    throw error;
  }
  return { data: payload.data, meta: payload.meta || null };
}

export const api = {
  get: (path, query, options) => request('GET', path, { ...options, query }),
  post: (path, body, options) => request('POST', path, { ...options, body: body === undefined ? {} : body }),
  put: (path, body, options) => request('PUT', path, { ...options, body: body === undefined ? {} : body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body: body === undefined ? {} : body }),
  delete: (path, options) => request('DELETE', path, options),
};

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };

// Uploads one file through the API, which validates it and forwards it to
// Cloudinary (the app never talks to Cloudinary directly and holds no
// Cloudinary credentials). Resolves with the Media object; its `id` is what
// content requests refer to. `asset` is an expo-image-picker asset.
export function uploadMedia(asset, purpose, options) {
  return uploadFile('/media', asset, { purpose }, options);
}

// Multipart upload of one picked file to `path`, with `fields` sent before the
// file (the API reads them first). Reports progress from 0 to 1.
export function uploadFile(path, asset, fields = {}, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (!isApiConfigured) return reject(notConfigured());
    const sentToken = token;
    const mimeType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
    const name = asset.fileName || `upload.${EXTENSIONS[mimeType] || (asset.type === 'video' ? 'mp4' : 'jpg')}`;

    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value); // e.g. `purpose`, before `file`
    form.append('file', { uri: asset.uri, name, type: mimeType });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}${path}`);
    xhr.setRequestHeader('Accept', 'application/json');
    if (sentToken) xhr.setRequestHeader('Authorization', `Bearer ${sentToken}`);
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) onProgress(Math.min(1, event.loaded / event.total));
      };
    }
    xhr.onload = () => {
      let payload = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload && payload.success) return resolve(payload.data);
      const error = toApiError(xhr.status, payload);
      reportAuthFailure(error, Boolean(sentToken));
      reject(error);
    };
    xhr.onerror = () =>
      reject(new ApiError({ code: 'NETWORK', message: 'The upload could not reach the server. Check your connection and try again.' }));
    xhr.ontimeout = () => reject(new ApiError({ code: 'TIMEOUT', message: 'The upload took too long. Please try again on a faster connection.' }));
    xhr.send(form);
  });
}

// First message for a field from a VALIDATION_ERROR / ACCOUNT_EXISTS response.
export function fieldErrors(error) {
  return error && error.details && typeof error.details === 'object' ? error.details : {};
}

export const messageOf = (error, fallback = 'Something went wrong. Please try again.') =>
  (error && error.message) || fallback;
