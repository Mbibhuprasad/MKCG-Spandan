# Architecture

## Overview

```
Browser ──HTTPS──▶ Next.js (frontend/)  ──/api/v1/* rewrite──▶ Express API (backend/) ──▶ MongoDB
   ▲                 │  server components read PUBLIC                │
   │                 │  endpoints for SEO pages                      └──▶ Cloudinary (media)
   └── Cloudinary CDN (images / videos delivered directly, signed where private)
```

- **`backend/`** owns every business rule, permission check and database operation. It is a plain versioned REST API
  (`/api/v1`) that a future React Native app can call directly.
- **`frontend/`** renders the user interface. It never talks to MongoDB or Cloudinary's upload API and never holds a
  secret.
- **`docs/`** is this documentation.

## Backend (`backend/src`)

| Folder | Responsibility |
| --- | --- |
| `config/` | `env.js` validates environment variables with Zod and exposes a frozen config; `db.js` connects Mongoose; `cloudinary.js` lazily configures the SDK; `constants.js` holds roles, statuses, enums, upload purposes, limits and the policy version |
| `models/` | Mongoose schemas and indexes. `plugins/moderation.js` adds the shared publication fields |
| `middleware/` | `auth.js` (session resolution, CSRF, role guard), `security.js` (origin guard, operator-key rejection), `rateLimiters.js`, `validate.js` (Zod → `req.valid`), `upload.js` (Multer memory storage), `errorHandler.js` |
| `validators/` | Zod schemas for every body, query string and route parameter |
| `controllers/` | HTTP handlers. They read only `req.valid` and `req.user`, call services, and return serialised data |
| `services/` | Business logic shared between controllers (see below) |
| `routes/` | One router file per feature; `routes/index.js` mounts them under `/api/v1` |
| `utils/` | `ApiError`, response envelope helpers, text/phone/email normalisation, file-signature detection, logger |
| `scripts/` | `createAdmin.js`, `setAdminPassword.js`, `cleanupMedia.js`, `devMemory.js` |
| `../tests/` | Jest + Supertest suites and helpers; `../__mocks__/cloudinary.js` is the Cloudinary test double |

### Services

| Service | Purpose |
| --- | --- |
| `session.service.js` | Creates/ends sessions, signs and verifies the JWT, derives and checks the CSRF token, cookie options |
| `adminBootstrap.service.js` | Idempotent creation of the first admin; explicit password rotation |
| `content.service.js` | **Content registry**: one table mapping `post`, `blog`, `memory`, `event`, `poll`, `comment` to model, owner field and capabilities; visibility (`canView`, `loadVisible`), ownership (`loadManageable`), publishing on create (`publishedState`) and on edit (`publishAfterEdit`), links, cascade deletion |
| `moderation.service.js` | Announcements when something is published (event, poll, comment) and admin removal with notification and audit entry. There is no approve / reject |
| `legacyContent.service.js` | One-off, idempotent publication of content left `PENDING` by the former approval workflow (`npm run content:publish-pending`) |
| `media.service.js` | Upload validation and Cloudinary upload, claiming uploads for content, syncing on edit, destruction, orphan cleanup, media serialisation |
| `cloudinary.service.js` | The only module that calls the Cloudinary SDK: upload stream, destroy, signed delivery URLs, short-lived download URLs |
| `markdown.service.js` | Markdown → sanitised HTML, reading time, slugs |
| `interaction.service.js` | "Which of these has the viewer liked?" lookups |
| `notification.service.js` | Best-effort, de-duplicated in-app notifications and fan-out |
| `audit.service.js` | Append-only audit log entries |
| `doctor.service.js` | Cascade deletion of a doctor |
| `jobs.service.js` | In-process timers: event reminders and orphan-media cleanup |
| `serializers.js` | Explicit output shapes — controllers never send Mongoose documents |

### Request lifecycle

Order is defined in `backend/src/app.js`:

1. `helmet()` security headers.
2. `cors` with an allow-list built from `FRONTEND_URL`, `credentials: true`.
3. Request logging (`morgan`, disabled in tests).
4. Global rate limiter (per IP).
5. `originGuard` — a state-changing request that carries an `Origin` header not in the allow-list is refused (`403 ORIGIN_NOT_ALLOWED`).
6. `express.json({ limit: '200kb' })` and `cookie-parser`.
7. `rejectOperatorKeys` — any key starting with `$` or containing `.` (or prototype keys) in body/query → `400 INVALID_INPUT`.
8. `Cache-Control: no-store` on everything under `/api`.
9. The feature router. A typical route reads: *limiter → `requireAuth` → role guard → `validate(...)` → handler*.
10. `notFoundHandler` and `errorHandler` — every error becomes `{ success:false, error:{ code, message, details? } }`; unexpected errors are logged server-side and returned as a generic `500 INTERNAL_ERROR`.

`requireAuth` (`middleware/auth.js`) reads the bearer token or the session cookie, verifies the JWT (HS256 only), loads
the **session** and the **user** from MongoDB, refuses non-`ACTIVE` accounts, and — for cookie sessions on
state-changing methods — verifies the `X-CSRF-Token` header. Role and status always come from the database, never
from the token or the request.

### The content registry and publication fields

All content models use `moderationPlugin`, which adds `moderationStatus` (`APPROVED` for everything created now;
`PENDING` / `REJECTED` only on records from the former approval workflow), `submittedAt`, `reviewedAt`, `reviewedBy`,
`rejectionReason` and `publishedAt`.

`content.service.js` then gives every content type identical behaviour:

- `publishedState()` — new content is published as soon as it is saved. The status is never read from the request.
- `canView` / `loadVisible` — published content is visible to members; a record still hidden by the former workflow exists only for its owner and
  admins, and everyone else receives the same `404` as for a missing item.
- `loadManageable` — only the owner can edit; the owner or (where allowed) an admin can delete.
- `publishAfterEdit` — an edit keeps the item published (and publishes a still-hidden legacy item).
- `deleteContent` — removes the item and everything that depends on it.

Likes, comments and reports are implemented once (`interaction.controller.js`) against this registry, so there is no
per-page variant of the logic. See [CONTENT_MODERATION.md](CONTENT_MODERATION.md).

### Background jobs

`jobs.service.js` starts two `setInterval` timers when the server boots (unless `JOBS_ENABLED=false`):

| Job | Interval | Effect |
| --- | --- | --- |
| Event reminders | every 30 min (first run 15 s after boot) | Notifies the organiser and members who RSVP'd Going/Maybe about events starting within 48 hours. A dedupe key makes each reminder at-most-once |
| Orphan media cleanup | every 6 h | Deletes uploads never attached to content and older than 24 h, from Cloudinary and MongoDB |

Both are idempotent, so running several API instances is safe, but they are not distributed-locked.

## Frontend (`frontend/src`)

| Folder | Responsibility |
| --- | --- |
| `app/` | App Router routes. `layout.js` sets fonts, metadata, the theme init script, `Providers`, `Navbar`, `Footer`. `error.js`, `not-found.js`, `loading.js` are the fallbacks |
| `components/providers/` | `ThemeProvider` (light default, `localStorage` key `mkcg-theme`), `AuthProvider` (session state), `ToastProvider`, and `Providers` which also sets Framer Motion's `reducedMotion="user"` |
| `components/ui/` | The UI kit: `Button`, `Form` (Field, Input, Textarea, Select, Checkbox, FormMessage), `Feedback` (Spinner, Skeleton, EmptyState, ErrorState, Badge, ModerationBadge, ModerationNotice), `Modal`/`ConfirmDialog` (native `<dialog>`), `Pagination`, `Avatar`, `Layout` (PageHeader, SectionHeading, Tabs), `Reveal` |
| `components/layout/` | `Navbar`, `Footer`, `Logo`, `ThemeToggle`, `NotificationBell` |
| `components/auth/` | `LoginForm`, `RegisterForm`, `AuthShell`, and the guards `RequireAuth`, `RequireAdmin`, `MemberGate` |
| `components/content/` | Shared interaction components: `AuthorLine`, `LikeButton`, `CommentSection`, `ReportButton`, `MediaUploader` |
| `components/cards/` | `DoctorCard`, `BlogCard`, `EventCard` |
| `components/<feature>/` | Feature components (dashboard, doctors, community, memories, events, blog, admin, home) |
| `lib/` | `api.js` (browser client), `server-api.js` (server-side reads of public endpoints), `hooks.js` (`useApi`, `useAction`, `useDebounced`), `format.js`, `constants.js`, `site.js` (branding) |

### Route map

| Route | Audience | Rendering |
| --- | --- | --- |
| `/`, `/about`, `/terms`, `/privacy`, `/community-guidelines` | Public, indexable | Server components; the homepage reads public endpoints only |
| `/blogs`, `/blogs/[slug]` | Public | Server-rendered for SEO and not cached, so a new, edited or deleted blog shows at once; likes and comments are client-side and member-only |
| `/login`, `/register` | Public | Client forms |
| `/doctors`, `/doctors/[id]`, `/memories`, `/community`, `/community/posts/[id]`, `/events`, `/events/[id]` | Members | Page shell + `MemberGate`; data is fetched in the browser with the session cookie |
| `/dashboard`, `/dashboard/profile`, `/dashboard/submissions`, `/dashboard/notifications`, `/dashboard/create/{post,blog,memory,event,poll}` | Signed-in users | `dashboard/layout.js` wraps everything in `RequireAuth`; `noindex` |
| `/admin`, `/admin/doctors`, `/admin/moderation`, `/admin/reports`, `/admin/audit-log` | `ADMIN` only | `RequireAdmin`; `noindex` |

Create pages double as edit pages with `?edit=<id>`; `/dashboard/create/event?type=VISIT_PLAN` preselects a visit plan.

### Server and client components, and the privacy boundary

- Server components may call **only** `publicFetch()` from `lib/server-api.js`. It never forwards cookies or
  credentials and only targets public endpoints (`/doctors/featured`, `/blogs`, `/blogs/taxonomy`,
  `/blogs/slug/:slug`, `/events/public`). Therefore member-only data cannot appear in server-rendered HTML, the
  sitemap, or any cached page.
- Member data is requested in the browser by client components through `lib/api.js`, after `AuthProvider` has
  restored the session.
- The guards decide what to *show*; they are not security. The API refuses every request independently.

### Why the browser calls the API through a rewrite

`next.config.mjs` rewrites `/api/v1/:path*` to `${BACKEND_URL}/api/v1/:path*`. The browser therefore only ever talks
to the web origin, which means:

- the session cookie is **first-party** (works in Safari and other browsers that block third-party cookies) and can
  stay `SameSite=Lax`;
- no CORS preflights are needed in normal operation;
- web and API can be hosted on unrelated domains.

`experimental.proxyTimeout` is raised to 5 minutes because media uploads pass through this proxy. A direct mode is
also supported: set `NEXT_PUBLIC_API_URL` to an absolute API URL on a sibling sub-domain and configure
`COOKIE_DOMAIN` and `FRONTEND_URL` on the API to match.

### Browser API client

`lib/api.js` sends `credentials: 'include'`, keeps the CSRF token **in memory only** (received from
`/auth/session`, `/auth/login`, `/auth/register`), attaches it to every non-GET request, converts API errors into
`ApiError { status, code, message, details }`, and tells `AuthProvider` when a request reports an expired session or a
suspension. `uploadMedia()` uses `XMLHttpRequest` to report upload progress.

### Theming, motion and branding

- Colours are CSS variables defined for `:root` (light) and `.dark`; Tailwind utilities such as `bg-surface`,
  `text-fg`, `border-line`, `bg-brand`, `text-leaf` map to them, so components need no per-theme overrides.
- A tiny inline script in `<head>` applies the stored theme before first paint. First-time visitors always get light
  mode.
- Framer Motion is used for component transitions (`Reveal`, menus, toasts); GSAP is reserved for the homepage hero
  and scroll storytelling. `prefers-reduced-motion` is honoured by both and by a global CSS rule.
- Branding is centralised in `lib/site.js`; the logo is a replaceable file in `frontend/public/brand/` rendered only
  by `components/layout/Logo.jsx`.

## Future React Native compatibility

Nothing essential depends on Next.js server actions or browser-only behaviour:

| Concern | How a mobile app uses the same API |
| --- | --- |
| Authentication | Send `X-Client-Type: mobile` on `POST /auth/register` or `/auth/login`. The response body then contains `token`; no cookie is set. Send `Authorization: Bearer <token>` on every request |
| CSRF | Not required for bearer requests (the token is not an ambient credential). Native apps send no `Origin` header, so the origin guard does not apply |
| Logout | `POST /auth/logout` with the bearer token deletes the server-side session |
| Uploads | `multipart/form-data` to `POST /api/v1/media` with fields `purpose` then `file`; use the returned `id` in `mediaIds` / `coverId` / `PUT /doctors/me/photo` |
| Media display | Use the `url` / `thumbUrl` values returned by the API; request a download link from `GET /memories/:id/media/:mediaId/download` when needed |
| Permissions and publishing rules | Identical — all enforced in the API |

Store the token in the platform's secure storage (Keychain / Keystore). Building the mobile app is out of scope for
this project.

## Remaining limitations

- Rate-limit counters and background jobs live in the memory of one API process. For several instances, use a shared
  rate-limit store and move the jobs to a scheduler.
- Files are buffered in memory while they are forwarded to Cloudinary (see [CLOUDINARY.md](CLOUDINARY.md)).
- `frontend/src/lib/constants.js` duplicates a few backend values (upload limits, enums, policy version). The API is
  the authority; keep them in sync when changing `backend/src/config/constants.js` or the `MAX_*_MB` variables.
