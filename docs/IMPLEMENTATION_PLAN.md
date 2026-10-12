# Implementation Plan

MKCGSPANDAN was built in the seven phases required by the project brief. This document records what each phase
delivered and where it lives in the repository.

Legend: **Done** — implemented in the repository. Verification results (tests, lint, build) are recorded in
[TESTING.md](TESTING.md#latest-results), not here.

## Phase 1 — Project foundation

| Item | Where | Status |
| --- | --- | --- |
| Monorepo with separate `frontend/`, `backend/`, `docs/` and root convenience scripts | `package.json` | Done |
| Express 5 app factory, middleware pipeline, error handling | `backend/src/app.js`, `backend/src/middleware/` | Done |
| Environment validation with fail-fast startup | `backend/src/config/env.js` | Done |
| MongoDB connection and graceful shutdown | `backend/src/config/db.js`, `backend/src/server.js` | Done |
| Security middleware (helmet, CORS allow-list, origin guard, operator-key rejection, rate limiters) | `backend/src/middleware/security.js`, `rateLimiters.js` | Done |
| Next.js 16 App Router in JavaScript/JSX, Tailwind CSS 4, Framer Motion, GSAP installed | `frontend/` | Done |
| Design tokens for light (default) and dark themes | `frontend/src/app/globals.css` | Done |
| Same-origin API proxy and security headers | `frontend/next.config.mjs` | Done |

## Phase 2 — Authentication

| Item | Where | Status |
| --- | --- | --- |
| Admin bootstrap from `ADMIN_*` variables, idempotent, never resets a password | `backend/src/services/adminBootstrap.service.js`, `backend/src/scripts/createAdmin.js` | Done |
| Explicit admin password rotation | `backend/src/scripts/setAdminPassword.js` | Done |
| Doctor registration with automatic sign-in and no approval step | `backend/src/controllers/auth.controller.js` | Done |
| Login with email **or** phone | same | Done |
| Server-side sessions, httpOnly cookie, session-bound CSRF token, bearer mode for mobile | `backend/src/services/session.service.js`, `backend/src/middleware/auth.js` | Done |
| Logout, session restoration, password change | `auth.controller.js`, `frontend/src/components/providers/AuthProvider.jsx` | Done |
| Login and registration pages | `frontend/src/components/auth/` | Done |
| Authentication test suite | `backend/tests/auth.test.js` | Done |

## Phase 3 — Doctor profiles

| Item | Where | Status |
| --- | --- | --- |
| Profile and portfolio fields on the shared `User` model | `backend/src/models/User.js` | Done |
| Update own profile, profile photo via Cloudinary, completion calculation | `backend/src/controllers/doctor.controller.js`, `backend/src/services/serializers.js` | Done |
| Member directory with name search, specialization and city filters, pagination | `GET /doctors`, `GET /doctors/filters` | Done |
| Portfolio endpoint honouring visibility preferences | `GET /doctors/:id` | Done |
| Public "featured doctors" endpoint (doctor consent + admin flag) | `GET /doctors/featured` | Done |
| Directory, portfolio and profile-editor pages | `frontend/src/app/doctors/`, `frontend/src/app/dashboard/profile/` | Done |

## Phase 4 — Community features

| Item | Where | Status |
| --- | --- | --- |
| Posts with images | `post.controller.js`, `models/Post.js` | Done |
| Blogs (Markdown source, sanitised HTML, slug, categories, tags) | `blog.controller.js`, `services/markdown.service.js` | Done |
| One shared implementation for likes, comments and reports | `interaction.controller.js`, `services/content.service.js` | Done |
| Memories (photo/video albums, event link, short-lived download links) | `memory.controller.js` | Done |
| Events and visit plans with RSVPs | `event.controller.js`, `models/Rsvp.js` | Done |
| Polls with one ballot per doctor | `poll.controller.js`, `models/Vote.js` | Done |
| In-app notifications with de-duplication | `notification.controller.js`, `services/notification.service.js` | Done |
| Upload pipeline (magic-byte validation → Cloudinary → `Media` record → claimed by content) | `services/media.service.js` | Done |
| Community, memories, events, blog and create/edit pages | `frontend/src/app/community/`, `memories/`, `events/`, `blogs/`, `dashboard/create/` | Done |

## Phase 5 — Admin and moderation

| Item | Where | Status |
| --- | --- | --- |
| Admin statistics from real counts | `GET /admin/stats` | Done |
| Doctor management: list, search, view, suspend/reactivate, visibility/feature, delete with cascade | `admin.controller.js`, `services/doctor.service.js` | Done |
| Review queues for posts, blogs, comments, memories, events, visit plans, polls | `GET/PATCH/DELETE /admin/moderation/:queue` | Done |
| Approve / reject (compare-and-set) with notifications | `services/moderation.service.js` | Done |
| Admin deletion of any content, including approved content | `removeAsAdmin` in `moderation.service.js` | Done |
| Reports queue and audit log | `GET /admin/reports`, `GET /admin/audit-logs` | Done |
| Admin panel pages | `frontend/src/app/admin/` | Done |

## Phase 6 — Design, SEO and responsiveness

| Item | Where | Status |
| --- | --- | --- |
| Homepage (hero, about, benefits, featured doctors, blogs, memories, events, reunion, call to action, footer) | `frontend/src/app/page.js` | Done |
| About and legal pages | `frontend/src/app/about/`, `terms/`, `privacy/`, `community-guidelines/` | Done |
| Light/dark theme toggle persisted in `localStorage` | `frontend/src/components/providers/ThemeProvider.jsx` | Done |
| Purposeful animation that respects reduced-motion | `components/ui/Reveal.jsx`, `MotionConfig reducedMotion="user"`, CSS media query | Done |
| Metadata, Open Graph, canonical URLs, sitemap, robots | `frontend/src/app/layout.js`, `sitemap.js`, `robots.js` | Done |
| Privacy boundary: server rendering reads public endpoints only | `frontend/src/lib/server-api.js` | Done |

## Phase 7 — Testing and delivery

| Item | Where | Status |
| --- | --- | --- |
| Backend automated tests | `backend/tests/` | See [TESTING.md](TESTING.md) |
| Lint and production build | `npm run lint`, `npm run build` | See [TESTING.md](TESTING.md) |
| Documentation set | `README.md`, `docs/` | Done |
| Honest report of what works and what remains | Final delivery report, and the "Remaining limitations" sections | Done |

## Deliberate decisions that differ from a naive reading of the brief

| Decision | Reason |
| --- | --- |
| Uploads are a separate step (`POST /media`), and content refers to them by id | One upload endpoint for web and mobile; the server can verify ownership of every attached asset; abandoned uploads are cleaned up |
| The browser calls the API through a Next.js rewrite (`/api/v1/*`) | The session cookie is first-party, so it works in browsers that block cross-site cookies |
| Sessions are stored in MongoDB in addition to the signed token | Logout and password change invalidate sessions immediately; suspension is enforced on every request |
| Blog bodies are written in Markdown; images inside the body are disabled | A safe content format; the only blog image is the Cloudinary cover |
| No multi-document transactions | Not every MongoDB deployment supports them; unique indexes, atomic updates and idempotent cascades are used instead |
| Admin-authored content is published immediately | The brief requires approval for *doctor-created* content |
| ESLint for the web app is composed from individual plugins | Avoids pulling a TypeScript toolchain into a JavaScript-only project |
