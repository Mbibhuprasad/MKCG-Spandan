# Security

This document lists the security controls that are actually implemented and where to find them. It is **not** a
guarantee that the application is secure. Before production use the system needs an independent security review and
penetration test, dependency monitoring, and a legal review of its policies.

## Principles

- The backend is the only authority. Roles, account status, ownership, publication state and identifiers supplied by
  a client are never trusted.
- Deny by default: unpublished content and other people's private data return `404`, not a hint that they exist.
- Secrets exist only in server-side environment variables.

## Implemented controls

### Transport, headers and origins

| Control | Implementation |
| --- | --- |
| Strict CORS | `backend/src/app.js` — allow-list from `FRONTEND_URL`, `credentials: true`, fixed methods and headers. Other origins receive no CORS headers |
| Origin guard | `backend/src/middleware/security.js` `originGuard` — state-changing requests with a foreign `Origin` → `403 ORIGIN_NOT_ALLOWED` |
| API security headers | `helmet()` defaults; `x-powered-by` disabled; `Cache-Control: no-store` on `/api` |
| Web security headers | `frontend/next.config.mjs` — Content-Security-Policy, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; `poweredByHeader: false` |
| Same-origin API access | The browser reaches the API through the Next.js rewrite, so the session cookie is first-party |

The CSP restricts images and media to `self`, `data:`/`blob:` and `https://res.cloudinary.com`, forbids framing,
plugins and foreign form targets, and limits connections to `self`. It still allows `'unsafe-inline'` scripts and
styles because Next.js emits inline bootstrap scripts; a nonce-based policy would be stricter (see limitations).

### Authentication and sessions

| Control | Implementation |
| --- | --- |
| Password hashing | bcrypt via `bcryptjs`, cost `BCRYPT_ROUNDS` (default 12). `passwordHash` has `select: false` and is never serialised. Passwords over 72 bytes are refused rather than silently truncated |
| Session tokens | HS256 JWT naming a MongoDB session; verification pins the algorithm (`algorithms: ['HS256']`), so `alg: none` and other algorithms are rejected |
| Revocation | Sessions are deleted on logout, on password change (other sessions), on reactivation after a suspension and on account deletion. While an account is suspended every request is refused with `403 ACCOUNT_SUSPENDED`, because the status is read from the database each time |
| Cookie attributes | `HttpOnly`, `Secure` in production, `SameSite=Lax` by default, `Path=/`. `COOKIE_SAMESITE=none` is refused unless the cookie is secure |
| CSRF | HMAC token bound to the session, required on cookie-authenticated non-GET requests, constant-time comparison (`session.service.js`, `middleware/auth.js`) |
| Account enumeration | Identical login error for wrong password and unknown account, with a dummy bcrypt comparison to equalise timing |
| Role integrity | Public registration always creates `DOCTOR`; `role` is immutable on the schema; admin exists only via the CLI bootstrap |
| Suspension | Status is read from the database on every request |

Details: [AUTHENTICATION.md](AUTHENTICATION.md).

### Authorisation

| Control | Implementation |
| --- | --- |
| Role-based access | `requireAdmin` on the entire `/admin` router (`backend/src/routes/admin.routes.js`) |
| Resource-level ownership | `loadManageable` / `isOwner` in `backend/src/services/content.service.js`; ownership fields are set from `req.user` only |
| Visibility of unpublished content | `canView` / `loadVisible` — owner and admin only, `404` otherwise |
| Publishing cannot be abused to impersonate or escalate | Content is published on creation, so the control is on *who* and *what*: the owner is always the authenticated user (no validator accepts `author`, `userId`, `role`, `moderationStatus` or `publishedAt`), every write passes authentication, CSRF, validation, sanitisation and the per-user rate limit, only the owner may edit, and only the owner or an admin may delete |
| Upload ownership | `claimMedia` attaches an upload only if it belongs to the caller, has the right purpose and is unattached. Clients cannot submit URLs or Cloudinary ids |

### Input handling

| Threat | Control |
| --- | --- |
| Invalid or malicious input | Zod schemas for every body, query and params (`backend/src/validators/`), applied by `middleware/validate.js`. Handlers read only `req.valid` |
| Mass assignment | Zod drops unknown keys; controllers copy named fields only; sensitive fields are not in any schema |
| NoSQL injection | `rejectOperatorKeys` refuses keys starting with `$`, containing `.`, or named `__proto__` / `constructor` / `prototype`; the query parser is set to `simple` (no nested objects); validated values are strings, numbers, booleans or arrays of those; ids must match a 24-hex pattern |
| Regular-expression injection / ReDoS | User search terms are length-limited and passed through `escapeRegex` before use in `$regex` |
| Oversized payloads | JSON limit 200 kB; per-field length limits; page size limits; Multer file-size, file-count and field limits |
| Pagination abuse | `page` and `limit` are bounded integers |

### Cross-site scripting

| Content | Control |
| --- | --- |
| Plain text (posts, comments, captions, profile fields, poll text) | Stored as text with control characters removed (`cleanText` / `cleanLine`) and rendered by React as text, which escapes it. It is never injected as HTML |
| Blog bodies | Written in Markdown. `markdown.service.js` renders with `markdown-it` (`html: false`, so raw HTML is escaped; `javascript:`/`data:` links rejected; images disabled) and then passes the HTML through an independent **allow-list** sanitiser (`xss`) that permits only basic formatting tags and `href`/`title`/`target`/`rel` on links. Links get `rel="noopener noreferrer nofollow"` |
| Profile and publication links | Must be absolute `http://` or `https://` URLs (`isHttpUrl`) |
| Redirect after login | `safeNextPath` accepts only same-site paths (no open redirect) |

### File uploads and media

| Control | Implementation |
| --- | --- |
| No local storage | Multer **memory** storage; the buffer is streamed to Cloudinary; nothing touches disk; no binaries in MongoDB |
| Real content validation | `backend/src/utils/fileSignature.js` inspects magic bytes; extension and declared MIME type are ignored. Cloudinary validates again (`allowed_formats`) |
| Type and size limits | Per-purpose allowed kinds; `MAX_IMAGE_MB` / `MAX_VIDEO_MB` |
| Authentication and rate limiting | `requireAuth` + upload limiter on `POST /media` |
| Private media | Posts, events and memories use Cloudinary's `authenticated` delivery type; URLs are signed with the API secret and issued only to members allowed to see the item. Original downloads use 5-minute signed links |
| Consistency | Failed Cloudinary upload → no database record; failed database write → asset destroyed; abandoned uploads are cleaned up |
| Secrets | The Cloudinary secret is read only in `backend/src/config/cloudinary.js` and never sent to clients; original filenames are not used |

Details: [CLOUDINARY.md](CLOUDINARY.md).

### Abuse and duplicates

| Control | Implementation |
| --- | --- |
| Rate limiting | Global, login (per IP + identifier and per IP), registration, write and upload limiters (`middleware/rateLimiters.js`) |
| Duplicate likes | Unique index `(user, targetType, target)`; a duplicate is treated as success without changing the count |
| Duplicate votes | Unique index `(poll, user)`; a second ballot returns `409 ALREADY_VOTED` |
| Duplicate RSVPs | Unique index `(event, user)` with an upsert |
| Duplicate reports / notifications | Unique indexes on `(reporter, targetType, target)` and `(user, dedupeKey)` |
| Repeated submits in the UI | Buttons are disabled while a request runs (`loading` prop, `useAction`) |

### Data exposure

| Control | Implementation |
| --- | --- |
| Explicit serialisers | `backend/src/services/serializers.js` — no Mongoose document is ever sent directly |
| Contact privacy | Email/phone appear on a portfolio only if the doctor enabled them (or for self/admin) |
| Public endpoints | Return a fixed minimal set of fields and require opt-in (featured doctors, public events) |
| Server rendering | `frontend/src/lib/server-api.js` calls public endpoints without credentials, so member data cannot enter cached HTML |
| Search engines | Private routes are `noindex` and excluded in `robots`; this is in addition to — not instead of — API authorisation |
| Safe errors | `middleware/errorHandler.js` returns generic messages for unexpected errors and logs details server-side; no stack traces are sent |
| Configuration errors | `config/env.js` reports variable names only, never values |

### Audit and accountability

`AuditLog` records sensitive administrative actions: admin bootstrap and password rotation, doctor suspension,
reactivation, visibility changes and deletion, content deletion, and report resolution.
Entries hold the actor, action, target id and a short summary — never passwords or full content. Admins read them at
`GET /admin/audit-logs`.

### Data minimisation

- No patient data is collected, and the Community Guidelines prohibit sharing it.
- Sessions store a truncated user agent, not IP addresses.
- No location tracking: events and visit plans hold only a voluntarily entered city, venue and dates.
- Notifications expire after about 180 days; expired sessions are removed automatically.
- Deleting a doctor removes their profile, content, interactions and media (see [DATABASE.md](DATABASE.md)).

### Database access

- Give the application a MongoDB user limited to `readWrite` on its own database (least privilege).
- No multi-document transactions are assumed; consistency relies on unique indexes, atomic updates and idempotent
  cascades.

### Dependencies

```bash
npm --prefix backend run audit:deps     # npm audit --omit=dev
npm --prefix frontend audit --omit=dev
```

Run these regularly and before each release, and enable automated dependency alerts in your repository host.
`package-lock.json` files pin the resolved versions.

### Automated security tests

The backend suite exercises the controls above (role assignment at registration, CSRF and origin checks, forged and
expired tokens, suspension, and more). See [TESTING.md](TESTING.md) for the list of suites and the latest recorded
results.

## Remaining limitations

- **No independent review.** The controls have not been audited or penetration-tested.
- **CSP allows inline scripts and styles.** Moving to a nonce-based CSP would further reduce XSS impact.
- **Rate limits are per process and in memory.** They reset on restart and are not shared between API instances. A
  mis-set `TRUST_PROXY` would make all users share one bucket or let clients spoof their IP.
- **Signed Cloudinary delivery URLs do not expire** on plans without token authentication; a member who copies such a
  URL can share it. Only the original-file download links are time-limited.
- **EXIF metadata** (including GPS position) in original photos is not stripped from the stored original.
- **Uploads are buffered in memory** (up to `MAX_VIDEO_MB` per request) — size the server accordingly.
- **Suspension does not unpublish** content the doctor already published; an admin must delete it.
- **No malware scanning** of uploads beyond type validation.
- **No email/SMS**, therefore no email verification, password reset, login alerts or multi-factor authentication.
- **Event capacity** is checked before the RSVP is written, not atomically; two simultaneous RSVPs can exceed it by
  a small margin.
- **Background jobs and audit/notification writes are best-effort**; a failure is logged, not retried.
- **Legal pages are drafts** and the application makes no claim of legal or regulatory compliance.
