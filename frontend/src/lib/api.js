// Browser-side API client. All business rules and permissions live in the API;
// this module only transports requests.
//
//  • credentials: the session is an httpOnly cookie, so JavaScript never sees it.
//  • CSRF: the API returns a session-bound token from /auth/me, /auth/login and
//    /auth/register. It is kept in memory only and sent on every change request.
const BASE = (process.env.NEXT_PUBLIC_API_URL || '/api/v1').replace(/\/+$/, '');

let csrfToken = '';
let unauthorizedHandler = null;

export function setCsrfToken(token) {
  csrfToken = token || '';
}

// The auth provider registers a handler so an expired session signs the UI out.
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details || null; // { fieldName: message }
  }
}

function buildUrl(path, query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ''}`;
}

function toApiError(status, json) {
  const error = json && json.error;
  if (error) return new ApiError(status, error.code || 'ERROR', error.message || 'Something went wrong.', error.details);
  if (status >= 500 || status === 0) {
    return new ApiError(status, 'SERVER_UNAVAILABLE', 'The server is not reachable right now. Please try again in a moment.');
  }
  return new ApiError(status, 'ERROR', 'Something went wrong. Please try again.');
}

function notifyIfSessionEnded(error) {
  const ended = error.status === 401 || error.code === 'ACCOUNT_SUSPENDED';
  if (ended && error.code !== 'INVALID_CREDENTIALS' && unauthorizedHandler) unauthorizedHandler(error);
}

async function request(method, path, { query, body, signal, silentAuth = false } = {}) {
  const headers = { Accept: 'application/json' };
  const options = { method, headers, credentials: 'include', cache: 'no-store', signal };

  if (method !== 'GET') {
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
  }

  let response;
  try {
    response = await fetch(buildUrl(path, query), options);
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.');
  }

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok || !json || json.success !== true) {
    const error = toApiError(response.status, json);
    if (!silentAuth) notifyIfSessionEnded(error);
    throw error;
  }
  return { data: json.data, meta: json.meta || null };
}

export const api = {
  get: (path, query, options) => request('GET', path, { query, ...options }),
  post: (path, body, options) => request('POST', path, { body: body ?? {}, ...options }),
  put: (path, body, options) => request('PUT', path, { body: body ?? {}, ...options }),
  patch: (path, body, options) => request('PATCH', path, { body: body ?? {}, ...options }),
  delete: (path, body, options) => request('DELETE', path, { body, ...options }),
};

// Uploads one file to the API (which validates it and stores it in Cloudinary).
// XMLHttpRequest is used because fetch cannot report upload progress.
// Resolves with the media object: { id, resourceType, url, thumbUrl, … }.
export function uploadMedia(purpose, file, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('purpose', purpose); // fields must precede the file
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildUrl('/media'));
    xhr.withCredentials = true;
    xhr.responseType = 'json';
    xhr.setRequestHeader('Accept', 'application/json');
    if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
    }
    xhr.onload = () => {
      const json = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300 && json && json.success) return resolve(json.data);
      const error = toApiError(xhr.status, json);
      notifyIfSessionEnded(error);
      return reject(error);
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', 'The upload was interrupted. Please try again.'));
    xhr.onabort = () => reject(new ApiError(0, 'ABORTED', 'The upload was cancelled.'));
    if (signal) signal.addEventListener('abort', () => xhr.abort(), { once: true });

    xhr.send(form);
  });
}

// Maps an ApiError to { fieldErrors, message } for forms.
export function formErrors(error) {
  if (error instanceof ApiError) {
    return { fieldErrors: error.details || {}, message: error.message };
  }
  return { fieldErrors: {}, message: 'Something went wrong. Please try again.' };
}
