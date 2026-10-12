# Testing

## Automated backend tests

```bash
npm test                          # from the repository root
# or
cd backend && npm test            # jest --runInBand
npx jest tests/auth.test.js       # a single suite (inside backend/)
```

### How the suite works

| Piece | Detail |
| --- | --- |
| Runner | Jest 30, `testEnvironment: node`, suites in `backend/tests/*.test.js`, run serially |
| HTTP | Supertest against the real Express app created by `createApp()` — the full middleware pipeline, validators, controllers and services run |
| Database | `mongodb-memory-server` starts one real `mongod` process for the run (`tests/helpers/globalSetup.js`). Each test file uses its own randomly named database (`tests/helpers/env.js`), builds every index before the first test, and drops the database afterwards (`tests/helpers/harness.js`). Unique-index behaviour is therefore genuinely tested |
| Cloudinary | The SDK is replaced automatically by the test double in `backend/__mocks__/cloudinary.js`. It records uploads and deletions, can simulate an outage (`failNextUpload`), and returns deterministic URLs. No network access or credentials are used |
| Configuration | `tests/helpers/env.js` sets fixture values: throw-away JWT secret, fake Cloudinary names, `MAX_IMAGE_MB=1`, `MAX_VIDEO_MB=2`, bcrypt cost 4, very high rate limits, background jobs disabled |
| Client helper | `createClient()` behaves like a browser: it keeps cookies, sends the `Origin` header and attaches the CSRF token. `registerDoctor()`, `loginAs()` and `createAdmin()` build signed-in clients |

The first run downloads a MongoDB binary (cached afterwards), so it needs internet access and takes longer.

**No MongoDB installation, no Cloudinary account and no `.env` file are needed to run the tests.**

### Note: the MongoDB driver's `runtimeAdapters` option under Jest

Recent versions of the MongoDB Node driver load their `os` adapter with a dynamic `import()`. Jest's CommonJS sandbox
cannot execute that, the driver then sends empty client metadata, and the server refuses the handshake with
*"Missing required sub-document 'driver' in the client metadata document"*. The test harness therefore connects with

```js
mongoose.connect(uri, { runtimeAdapters: { os: require('os') } });
```

which is a supported driver option. This applies to the tests only; `backend/src/config/db.js` is unaffected.

### What each suite covers

| File | Covers |
| --- | --- |
| `auth.test.js` | Registration with automatic sign-in and no approval; password hash and policy version stored; registration can never create an admin or set status; email/phone normalisation and duplicate rejection; server-side validation; logout and re-login by email or phone; identical error for wrong password and unknown account; server-side session invalidation (bearer flow); forged, unsigned and expired tokens; password change ends other sessions; CSRF token required and bound to the session; foreign-origin requests refused; CORS allow-list; suspended accounts signed out, unable to log in or use protected routes, and restored on reactivation |
| `adminBootstrap.test.js` | Bootstrap fails safely when variables are missing without echoing secrets; weak and placeholder passwords rejected; an existing doctor is never promoted; one admin with a hashed password is created and the command is idempotent; explicit password rotation replaces the hash and signs the admin out |
| `profiles.test.js` | Incomplete profile does not block the dashboard and the prompt can be skipped; completing and editing one's own profile; profile updates cannot change role, status, email, phone or `featured`; invalid data and unsafe links rejected; directory requires authentication; name search and specialization/city filters on real records; pagination limits; directory cards contain no contact details; portfolio contact visibility; directory opt-out exposes only a name card; unknown/malformed ids; public featured doctors need both doctor consent and an admin decision |
| `moderation.test.js` | Posts, blogs, comments, memories, events, visit plans and polls: doctor submissions start `PENDING` regardless of the request; hidden from other doctors, feeds and the public; authors see their own status; doctors cannot approve via the admin API or by editing; admin queues, approval, rejection with reason; editing returns content to review; doctors cannot modify or delete others' content; admins delete any content (audited); admin-authored content publishes immediately; approved blogs are public without internal fields and keep a stable slug; comment counts change exactly once; memory media and downloads are members-only; separate event and visit-plan queues; RSVPs closed until approval; public event summary only; polls locked once published |
| `interactions.test.js` | One like per doctor under repeated and simultaneous requests; idempotent unlike, count never negative; no likes on unpublished or unsupported targets; same API for blogs; one ballot per doctor under simultaneous requests; option and single-choice validation; multi-choice ballots; result visibility rules computed from real ballots; closed and not-yet-open polls; malformed polls; one RSVP per doctor; attendee counts and capacity; invalid RSVP input; one report per member reaching the admin; comment pagination |
| `uploads.test.js` | File-type detection by content; uploads require authentication; images go to Cloudinary with only metadata in MongoDB; member-only media stored as authenticated assets with signed URLs; credentials never exposed; disguised and unsupported files rejected; oversized files rejected; failed Cloudinary upload leaves no record; failed metadata write removes the asset; media ids accepted only from their owner and for the right purpose; arbitrary URLs never accepted; profile photo set/replace/remove; deleting or editing content removes dropped assets; discarding unused uploads; orphan cleanup; download links only for members who may see the memory |
| `admin.test.js` | `401` for visitors and `403` for doctors on every admin route; exactly two roles and no super-admin; a doctor cannot become admin; statistics from real data; doctor list, search and filters; suspension audited, locks the account at once, reversible (old sessions are discarded on reactivation); the admin account cannot be suspended or deleted via doctor management; deleting a doctor removes the account and everything they own and corrects counters; audit log contents and access |
| `security.test.js` | NoSQL operator injection and prototype-pollution keys rejected; blog Markdown rendered to sanitised HTML; plain text returned as JSON text; oversized and malformed JSON; strict phone normalisation; security headers and `no-store`; safe JSON for unknown routes and unexpected errors; no password hashes or session internals in responses; environment validation (defaults, fail-fast naming variables but not values, production requirements); notifications private to their owner with read state; event reminders generated once |
| `rateLimit.test.js` | With real low limits: repeated failed logins for one account are throttled (`429`); registration is throttled per client |

### What the automated tests do not cover

- The **real Cloudinary service** — only the SDK test double is exercised. Verify uploads, signed delivery, video
  playback and downloads manually with real credentials (checklist below).
- The **web user interface** — there are no browser/end-to-end tests. UI behaviour is verified by lint, the production
  build and the manual checklist.
- Load, concurrency at scale, and multi-instance behaviour.

## Lint and build

```bash
npm --prefix backend run lint     # ESLint (backend/eslint.config.js)
npm --prefix frontend run lint    # ESLint: React, hooks, jsx-a11y and Next.js rules (frontend/eslint.config.mjs)
npm run build                     # next build — must finish without errors
npm --prefix backend run audit:deps
```

The frontend build renders public pages even if the API is not running (they fall back to empty states), so it can
run in CI without a database.

## Manual acceptance checklist

Run the API and the web app (`npm run dev`, or `npm --prefix backend run dev:memory` plus
`npm --prefix frontend run dev`), create the admin, and configure real Cloudinary credentials for the upload items.
"Auto" names the automated suite that also covers the API side of the item.

### Authentication

| # | Check | Auto |
| --- | --- | --- |
| A1 | Register a doctor at `/register`; you land on `/dashboard` already signed in, with no "awaiting approval" message | auth |
| A2 | Refresh the page — you are still signed in | auth |
| A3 | Log out, then log in with the email; log out, then log in with the phone number | auth |
| A4 | Registering again with the same email or phone shows a field error | auth |
| A5 | A wrong password shows a generic error; the button cannot be double-submitted | auth |
| A6 | Suspend the doctor as admin: the doctor is signed out and cannot log in; reactivate restores access | auth, admin |
| A7 | The registration request cannot create an admin (API check with `role: "ADMIN"`) | auth |

### Profiles

| # | Check | Auto |
| --- | --- | --- |
| P1 | New doctor sees "Complete Your Doctor Profile" and can skip it; the dashboard still works | profiles |
| P2 | Fill in the profile, add education and experience entries, upload a photo; values persist after refresh | profiles, uploads |
| P3 | `/doctors` search by name, filter by specialization and by city, and pagination behave correctly | profiles |
| P4 | `/doctors/<id>` shows saved sections and hides empty ones | profiles |
| P5 | Email/phone appear on the portfolio only when the doctor enabled them; a signed-out visitor sees the member gate | profiles |

### Content and moderation

| # | Check | Auto |
| --- | --- | --- |
| C1 | Create a post: you see "Awaiting review"; a second doctor does not see it in `/community` | moderation |
| C2 | Admin approves it in `/admin/moderation`: it appears in the feed and the author is notified | moderation |
| C3 | Repeat for a blog (public at `/blogs/<slug>` only after approval), a comment, a memory, an event, a visit plan and a poll | moderation |
| C4 | Reject an item with a reason: the author sees the reason under My submissions; others never see the item | moderation |
| C5 | Edit an approved post: it returns to "Awaiting review" | moderation |
| C6 | A doctor has no edit/delete controls on another doctor's content (and the API refuses) | moderation |
| C7 | Like twice quickly — the count rises by one; unlike works | interactions |
| C8 | Vote in a poll; a second vote is refused; results follow the visibility rule; a closed poll refuses votes | interactions |
| C9 | RSVP to an event, change it, cancel it; attendee count is right | interactions |
| C10 | Report content; it appears under `/admin/reports` | interactions |

### Uploads (real Cloudinary credentials required)

| # | Check | Auto |
| --- | --- | --- |
| U1 | Upload JPG/PNG/WebP images and an MP4 video in a memory; they appear in your Cloudinary media library under `CLOUDINARY_FOLDER` | uploads (test double) |
| U2 | A renamed non-image file and an oversized file are rejected with a clear message | uploads |
| U3 | After approval, members can view the gallery, play the video and download an original; the download link stops working after about five minutes | — |
| U4 | Signed out, the memory API and download endpoint return `401`; an unsigned Cloudinary URL for an authenticated asset is refused by Cloudinary | uploads (API part) |
| U5 | Deleting the memory removes the assets from Cloudinary | uploads (test double) |
| U6 | No Cloudinary key or secret appears in page source, network responses or the browser bundle | uploads |

### Administration

| # | Check | Auto |
| --- | --- | --- |
| D1 | `/admin` as a doctor shows "Administrators only"; admin API calls return `403` | admin |
| D2 | Dashboard counts match the real numbers of doctors and pending items | admin |
| D3 | Search, suspend, reactivate, feature and delete a doctor (confirmation dialog on destructive actions) | admin |
| D4 | Delete an approved post, blog, comment, memory, event, visit plan and poll | moderation |
| D5 | The audit log lists these actions | admin |
| D6 | There is no super-admin role, page or menu | admin |

### Quality

| # | Check |
| --- | --- |
| Q1 | `npm test`, both lint commands and `npm run build` succeed |
| Q2 | The API starts, connects to MongoDB and refuses to start with an invalid `.env` |
| Q3 | No errors in the browser console while using every page, in light and dark mode |
| Q4 | No unhandled errors in the API log |
| Q5 | Layouts work at 360 px, 768 px and 1280 px+; the mobile menu opens, closes and is keyboard-accessible |
| Q6 | With "reduce motion" enabled in the OS, animations are removed |
| Q7 | View source on `/`, `/blogs` and a blog page: no member-only data; `/robots.txt` and `/sitemap.xml` list only public pages |

## Latest results

Recorded on 11 October 2026 on Windows 11 with Node.js 22.18. These are the results of runs that were actually
executed; re-run the commands to confirm them on your machine.

| Check | Command | Result |
| --- | --- | --- |
| Backend tests | `npm test` in `backend/` | **9 suites, 121 tests — all passed** |
| Backend lint | `npm run lint` in `backend/` | 0 errors, 0 warnings |
| Frontend lint | `npm run lint` in `frontend/` | 0 errors, 0 warnings |
| Frontend production build | `npm run build` in `frontend/` | Succeeded — 33 routes generated, no `.ts`/`.tsx` files |
| Dependency audit (production) | `npm audit --omit=dev` in `backend/` and `frontend/` | 0 vulnerabilities in both |
| Dependency audit (incl. dev tools) | `npm audit` | Advisories remain in **development-only** tooling (transitive dependencies of Jest and of the Next.js ESLint plugin); none ship to production. No non-breaking fix was available |

### One-off end-to-end runs

In addition to the automated suites, the real stack was started (`npm run dev:memory` for the API with a real
`mongod` binary, and `next start` on the production build) and exercised twice. The scripts used for these runs
were throwaway verification scripts and are **not** part of the repository.

| Run | What it did | Result |
| --- | --- | --- |
| HTTP flow through the Next.js proxy | Register a doctor → automatic sign-in → dashboard summary → profile update → post created as `PENDING` and absent from the feed → admin (created by the bootstrap) logs in → approves → post appears → approval notification → blog pending is absent from public HTML → approved blog is server-rendered with canonical URL and JSON-LD → sitemap/robots → 16 pages return 200 → no member data in public HTML → security headers → logout/login → admin deletes the doctor (cascade) | 44 of 44 checks passed |
| Real browser (headless Microsoft Edge, driven over the DevTools protocol) | Homepage (light default, dark toggle persisted across navigation), public pages, members-only gates and redirects when signed out, registration through the form with client validation, automatic redirect to the dashboard with the "Complete Your Doctor Profile" prompt, session restoration on reload, every dashboard/create/member page, a post submitted through the form and shown as awaiting review, admin login through the form (including a wrong-password attempt), admin pages, approving the post from the moderation queue, event detail with an RSVP click, polls tab, portfolio page, and no horizontal overflow at 1440 px and 390 px | 121 of 121 checks passed; **0 console errors or uncaught exceptions** |

### Not verified

- **Cloudinary with real credentials.** No Cloudinary account was available, so uploads, signed delivery URLs, eager
  video transformations and the short-lived download link were exercised only against the SDK test double
  (`backend/__mocks__/cloudinary.js`). In the end-to-end runs Cloudinary was not configured, so the upload endpoint
  correctly answered `503 MEDIA_NOT_CONFIGURED`. Upload a photo and a video with real credentials before launch
  (checklist items in the sections above).
- **Media-dependent UI** (image grids, the memory lightbox, video playback, profile photos) was therefore not seen
  with real media in a browser.
- **Browsers other than Chromium-based Edge**, real mobile devices, and assistive technology (screen readers).
- **Load, penetration and accessibility audits.** The security controls are covered by tests, but no independent
  security review has been carried out.
