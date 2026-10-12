import 'server-only';

// Server-side reads of PUBLIC API endpoints only (homepage sections, approved
// blogs, sitemap). No cookies or credentials are ever forwarded from here, so
// nothing member-only can end up in server-rendered HTML.
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, '');

export async function publicFetch(path, { query, revalidate = 60 } = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  const url = `${BACKEND_URL}/api/v1${path}${qs ? `?${qs}` : ''}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate },
      signal: AbortSignal.timeout(8000),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json || json.success !== true) {
      return { ok: false, status: response.status, data: null, meta: null };
    }
    return { ok: true, status: response.status, data: json.data, meta: json.meta || null };
  } catch {
    // API unreachable (for example during a build): pages render their empty states.
    return { ok: false, status: 0, data: null, meta: null };
  }
}
