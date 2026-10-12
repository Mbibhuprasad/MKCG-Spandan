# REST API reference

Base path: **`/api/v1`** (served by the Express app in `backend/`). In the web app the browser reaches it through the
Next.js rewrite at the same origin; a mobile client calls the API host directly.

Routes are defined in `backend/src/routes/*.routes.js`, request schemas in `backend/src/validators/`, and response
shapes in `backend/src/services/serializers.js`.

## Conventions

### Authentication

| Client | Credential | Extra requirement for `POST` / `PUT` / `PATCH` / `DELETE` |
| --- | --- | --- |
| Web | httpOnly cookie `mkcg_session` (set by register/login) | Header `X-CSRF-Token: <csrfToken>` — the value returned by `/auth/register`, `/auth/login`, `/auth/session` or `/auth/me`. Not required for `POST /auth/logout` |
| Mobile | `Authorization: Bearer <token>` (obtained by sending `X-Client-Type: mobile` on register/login) | None |

Any state-changing request that carries an `Origin` header must come from an origin listed in `FRONTEND_URL`.

Access levels used below:

| Level | Meaning |
| --- | --- |
| **Public** | No authentication |
| **Member** | Any signed-in, active `DOCTOR` or `ADMIN` |
| **Owner** | The signed-in user who created the item |
| **Admin** | Signed-in user whose role in the database is `ADMIN` |

### Response envelope

```jsonc
// success
{ "success": true, "data": <object | array | null>, "meta": { "page": 1, "limit": 12, "total": 40, "totalPages": 4 } }
// error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Please check the highlighted fields.", "details": { "email": "Enter a valid email address." } } }
```

`meta` is present on paginated lists. `details` is present on validation and duplicate errors and maps field paths
(for example `profile.links.0.url`) to messages. All `/api` responses carry `Cache-Control: no-store`.

### Pagination

List endpoints accept `page` (default 1) and `limit` (default and maximum shown per endpoint). Values outside the
limits are rejected with `400 VALIDATION_ERROR`.

### Request rules

- JSON bodies up to 200 kB. Unknown fields are dropped; fields such as `role`, `status`, `author`, `moderationStatus`
  or `featured` are never read from a doctor's request.
- Keys starting with `$` or containing `.` are rejected (`400 INVALID_INPUT`).
- Identifiers are 24-character hexadecimal MongoDB ids.
- Dates are ISO 8601 strings. Optional dates and ids accept `null` or `""` for "not set".

### Status and error codes

| HTTP | `error.code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Body, query or params failed validation (`details` lists fields) |
| 400 | `BAD_REQUEST` | Other invalid requests (malformed JSON, wrong current password, reporting own content…) |
| 400 | `INVALID_INPUT` | Operator-style keys in the input |
| 400 | `UPLOAD_INVALID` | Missing or malformed upload |
| 400 | `UNSUPPORTED_MEDIA_TYPE` | File content is not an allowed type for this purpose |
| 400 | `MEDIA_INVALID` | A `mediaId` / `coverId` is not an unattached upload owned by the caller for that purpose |
| 401 | `UNAUTHENTICATED` | No credential |
| 401 | `SESSION_EXPIRED` | Invalid, expired or revoked session |
| 401 | `INVALID_CREDENTIALS` | Wrong email/phone or password (identical for unknown accounts) |
| 403 | `FORBIDDEN` | Not allowed (wrong role, or editing someone else's published item) |
| 403 | `ACCOUNT_SUSPENDED` | The account is suspended |
| 403 | `CSRF_INVALID` | Missing or wrong `X-CSRF-Token` on a cookie-authenticated change |
| 403 | `ORIGIN_NOT_ALLOWED` | State-changing request from a foreign origin |
| 404 | `NOT_FOUND` | Missing item — also returned for unpublished content the caller may not see |
| 409 | `ACCOUNT_EXISTS` | Email or phone already registered (`details.email` / `details.phone`) |
| 409 | `CONFLICT` | Generic conflict (duplicate record, concurrent moderation, deleting an attached upload) |
| 409 | `NOT_PUBLISHED` | Like / comment / report / RSVP / vote on content that is not approved |
| 409 | `RSVP_CLOSED`, `EVENT_FULL` | RSVP not possible |
| 409 | `POLL_LOCKED`, `POLL_NOT_OPEN`, `POLL_CLOSED`, `ALREADY_VOTED` | Poll rules |
| 413 | `PAYLOAD_TOO_LARGE`, `FILE_TOO_LARGE` | JSON body or file over the limit |
| 429 | `RATE_LIMITED` | Rate limit reached |
| 500 | `INTERNAL_ERROR` | Unexpected error (details are logged on the server only) |
| 502 | `UPLOAD_FAILED` | Cloudinary rejected or failed the upload |
| 503 | `MEDIA_NOT_CONFIGURED` | Cloudinary credentials are not set on the server |

Success codes: `200` for reads and updates, `201` for created resources (register, uploads, new content, comments,
first report, a vote).

### Rate limits

Configured in `backend/src/middleware/rateLimiters.js`; maxima come from environment variables. Standard
`RateLimit` headers (draft 7) are returned.

| Limiter | Default | Window | Key | Applied to |
| --- | --- | --- | --- | --- |
| Global | 1500 | 15 min | IP | Every request |
| Login | 10 | 15 min | IP + identifier | `POST /auth/login` |
| Login (IP) | 5 × login limit | 15 min | IP | `POST /auth/login` |
| Register | 10 | 60 min | IP | `POST /auth/register` |
| Write | 90 | 5 min | User | Member create / update / delete / like / vote / RSVP routes |
| Upload | 40 | 10 min | User | `POST /media` |

Admin changes (status, visibility, delete, review, report status) also pass through the per-user write limiter; admin reads are covered by the global limiter.

### Common objects

**Author summary** (on posts, blogs, comments, memories, events, polls):
`{ id, name, isAdmin, professionalTitle, specialization, photoUrl }`. A deleted author appears as
`{ id: null, name: "Former member", … }`.

**Media**: `{ id, resourceType: "image" | "video", format, width, height, duration, bytes, url, thumbUrl }`.
`url` / `thumbUrl` are Cloudinary delivery URLs (signed for private assets).

**Moderation** (only on items the caller owns, or for admins): every content object carries `isMine`, and when
permitted `moderation: { status, submittedAt, reviewedAt, rejectionReason }`.

---

## Health

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| GET | `/health` | Public | `{ status: "ok" }` |

## Authentication — `/auth`

| Method | Path | Access | Body | Result |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | Public | `name` (2–80), `email`, `phone`, `password` (≥ 8 chars, ≤ 72 bytes, a letter and a number), `confirmPassword`, `acceptPolicies: true`, optional `specialization`, `city` (≤ 80) | `201` `{ user, csrfToken, expiresAt }` and the session cookie; with `X-Client-Type: mobile` also `token` and no cookie. Role is always `DOCTOR`, status `ACTIVE` |
| POST | `/auth/login` | Public | `identifier` (email or phone), `password` | `200` same shape as register. `401 INVALID_CREDENTIALS`, `403 ACCOUNT_SUSPENDED` |
| POST | `/auth/logout` | Public (acts on the current session if any) | — | `200 { loggedOut: true }`; deletes the server-side session and clears the cookie |
| GET | `/auth/session` | Public | — | Always `200`. `{ authenticated: true, user, csrfToken }` or `{ authenticated: false, reason: "SIGNED_OUT" | "ACCOUNT_SUSPENDED", message }`. Used by the web app to restore the session without a failed request for signed-out visitors |
| GET | `/auth/me` | Member | — | `{ user, csrfToken }` — used to restore the session after a page refresh |
| PATCH | `/auth/password` | Member | `currentPassword`, `newPassword` | `{ changed: true }`; every other session of the user is ended |

`user` is the caller's own account: `id, role, status, name, email, phone, profile{…}, visibility{…}, featured,
profileCompletion{ percent, isComplete, missing[] }, profilePromptDismissed, policyAcceptance{ version, acceptedAt },
createdAt`.

## Doctors — `/doctors`

| Method | Path | Access | Parameters | Result |
| --- | --- | --- | --- | --- |
| GET | `/doctors/featured` | Public | — | Up to 8 cards `{ id, name, photoUrl, professionalTitle, specialization, city }` for active doctors who enabled *public listing* **and** were featured by an admin |
| GET | `/doctors` | Member | `q` (name, ≤ 60), `specialization`, `city`, `page`, `limit` (12, max 48) | Directory cards `{ id, name, photoUrl, professionalTitle, specialization, designation, hospital, city, state, yearsOfExperience, batchYear }`, sorted by name. Only active doctors with directory visibility on |
| GET | `/doctors/filters` | Member | — | `{ specializations[], cities[] }` present in the directory |
| GET | `/doctors/:id` | Member | — | Portfolio `{ id, name, limited, isMine, profile{…}, contact{ email?, phone? }, memberSince, visibility? }`. `contact` follows the doctor's settings; `limited: true` (name, photo, title, specialization only) when the doctor opted out of the directory. `404` for suspended doctors (unless admin/self) |
| GET | `/doctors/me` | Member | — | Own account (same as `user` above) |
| PATCH | `/doctors/me` | Member | Any of: `name`; `profile{ professionalTitle, specialization, subspecialty, designation, hospital, city, state, batchYear, yearsOfExperience, bio, qualifications[], interests[], languages[], education[], experience[], achievements[], publications[], links[] }`; `visibility{ directory, publicListing, showEmail, showPhone }`; `dismissProfilePrompt: true` | Updated own account. Field limits are in [DOCTOR_PORTFOLIO.md](DOCTOR_PORTFOLIO.md) |
| PUT | `/doctors/me/photo` | Member | `mediaId` (an upload with purpose `profile`) | Updated own account; the previous photo is deleted from Cloudinary |
| DELETE | `/doctors/me/photo` | Member | — | Updated own account |

## Media — `/media`

| Method | Path | Access | Body | Result |
| --- | --- | --- | --- | --- |
| POST | `/media` | Member | `multipart/form-data`: `purpose` (`profile` \| `blog` \| `post` \| `event` \| `memory`), then `file` | `201` Media object. The upload is unattached until a content request refers to its `id` |
| DELETE | `/media/:id` | Owner | — | `{ deleted: true }`; only for uploads not yet attached (`409` otherwise) |

Allowed content: JPG/PNG/WebP images for every purpose; MP4/MOV/WebM videos for `memory` only. See
[CLOUDINARY.md](CLOUDINARY.md).

## Posts — `/posts` (members only)

| Method | Path | Access | Parameters / body | Result |
| --- | --- | --- | --- | --- |
| GET | `/posts` | Member | `type`, `page`, `limit` (10, max 30) | Approved posts, newest first |
| GET | `/posts/mine` | Member | `page`, `limit` | The caller's posts in every moderation state |
| POST | `/posts` | Member | `type` (`GENERAL`, `ACHIEVEMENT`, `REUNION_UPDATE`, `ANNOUNCEMENT`, `EXPERIENCE`, `MEMORY`; default `GENERAL`), `body` (1–5000), `mediaIds[]` (≤ 4, purpose `post`) | `201` post; `PENDING` for doctors |
| GET | `/posts/:id` | Member | — | Approved post, or the caller's own / any for admin |
| PATCH | `/posts/:id` | Owner | Any of `type`, `body`, `mediaIds` | Post, back to `PENDING` for doctors |
| DELETE | `/posts/:id` | Owner | — | `{ deleted: true }` |

Post: `{ id, type, body, media[], author, likeCount, commentCount, likedByMe, createdAt, publishedAt, isMine, moderation? }`.

## Blogs — `/blogs`

| Method | Path | Access | Parameters / body | Result |
| --- | --- | --- | --- | --- |
| GET | `/blogs` | Public | `q` (title, ≤ 80), `category`, `tag`, `page`, `limit` (9, max 30) | Approved blog summaries, newest first |
| GET | `/blogs/taxonomy` | Public | — | `{ categories[{ name, count }], tags[{ name, count }] }` (approved blogs, top 30 tags) |
| GET | `/blogs/slug/:slug` | Public when approved | — | Blog detail with `bodyHtml`. An unpublished blog is returned only to its author or an admin; otherwise `404` |
| GET | `/blogs/mine` | Member | `page`, `limit` (10, max 30) | The caller's blogs in every state |
| POST | `/blogs` | Member | `title` (5–160), `excerpt` (20–320), `body` (Markdown, 200–50 000), `category`, `tags[]` (≤ 8, ≤ 30 chars each), `coverId` (purpose `blog`, optional) | `201` blog detail including `bodyMarkdown` |
| GET | `/blogs/:id` | Owner / Admin | — | Blog detail including `bodyMarkdown` (for editing) |
| PATCH | `/blogs/:id` | Owner | Any create field | Blog detail; back to `PENDING` for doctors. The slug never changes |
| DELETE | `/blogs/:id` | Owner | — | `{ deleted: true }` |

Categories: `Clinical Practice`, `Career & Growth`, `Research`, `Medical Education`, `Wellbeing`, `Batch Stories`,
`Travel & Life`, `Technology in Medicine`, `Other`.

Blog summary: `{ id, slug, title, excerpt, category, tags[], cover, author, readingMinutes, likeCount, commentCount,
createdAt, updatedAt, publishedAt, isMine, moderation? }`; detail adds `bodyHtml`, `likedByMe` and (owner/admin)
`bodyMarkdown`.

## Comments — `/comments` (members only)

| Method | Path | Access | Parameters / body | Result |
| --- | --- | --- | --- | --- |
| GET | `/comments` | Member | `targetType` (`post` \| `blog` \| `memory` \| `event`), `targetId`, `page`, `limit` (10, max 50) | Approved comments plus the caller's own pending/rejected ones, newest first |
| GET | `/comments/mine` | Member | `page`, `limit` (10, max 30) | The caller's comments in every state |
| POST | `/comments` | Member | `targetType`, `targetId`, `body` (1–2000) | `201` comment. The target must be approved. `PENDING` for doctors |
| PATCH | `/comments/:id` | Owner | `body` | Comment, back to `PENDING` for doctors |
| DELETE | `/comments/:id` | Owner | — | `{ deleted: true }` |

Comment: `{ id, targetType, targetId, body, author, createdAt, isMine, moderation? }`.

## Likes — `/likes` (members only)

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| PUT | `/likes/:targetType/:targetId` | Member | `{ liked: true, likeCount }` — idempotent; `targetType` is `post`, `blog` or `memory`; the target must be approved |
| DELETE | `/likes/:targetType/:targetId` | Member | `{ liked: false, likeCount }` — idempotent |

## Reports — `/reports`

| Method | Path | Access | Body | Result |
| --- | --- | --- | --- | --- |
| POST | `/reports` | Member | `targetType` (`post` \| `blog` \| `comment` \| `memory` \| `event` \| `poll`), `targetId`, `reason` (`PATIENT_CONFIDENTIALITY`, `HARASSMENT`, `IMPERSONATION`, `EXPLICIT_OR_UNLAWFUL`, `PRIVACY_VIOLATION`, `SPAM`, `OTHER`), `details` (≤ 1000) | `201 { reported: true, alreadyReported: false }`, or `200` with `alreadyReported: true` for a repeat. Own content cannot be reported |

## Memories — `/memories` (members only)

| Method | Path | Access | Parameters / body | Result |
| --- | --- | --- | --- | --- |
| GET | `/memories` | Member | `eventId`, `page`, `limit` (12, max 36) | Approved memories, newest first |
| GET | `/memories/events` | Member | — | `[{ id, title, startsAt }]` — approved events that have approved memories (gallery filter) |
| GET | `/memories/mine` | Member | `page`, `limit` (12, max 36) | The caller's memories in every state |
| POST | `/memories` | Member | `title` (3–140), `caption` (≤ 1500), `eventId` (optional, must be visible to the caller), `memoryDate` (optional, not in the future), `mediaIds[]` (1–12, purpose `memory`) | `201` memory |
| GET | `/memories/:id` | Member | — | Approved memory, or own / admin |
| PATCH | `/memories/:id` | Owner | Any create field | Memory, back to `PENDING` for doctors |
| DELETE | `/memories/:id` | Owner | — | `{ deleted: true }` |
| GET | `/memories/:id/media/:mediaId/download` | Member who can see the memory | — | `{ url, expiresInSeconds: 300 }` — a signed download link for the original file |

Memory: `{ id, title, caption, memoryDate, event{ id, title } | null, media[], owner, likeCount, commentCount,
likedByMe, createdAt, publishedAt, isMine, moderation? }`.

## Events and visit plans — `/events`

A visit plan is an event with `eventType: "VISIT_PLAN"`.

| Method | Path | Access | Parameters / body | Result |
| --- | --- | --- | --- | --- |
| GET | `/events/public` | Public | — | Up to 6 upcoming approved events whose organiser enabled `showOnPublicSite`: `{ id, title, eventType, city, startsAt, endsAt }` only |
| GET | `/events` | Member | `scope` (`upcoming` \| `past`, default `upcoming`), `type`, `page`, `limit` (9, max 30) | Approved events |
| GET | `/events/mine` | Member | `page`, `limit` (10, max 30) | The caller's events in every state |
| POST | `/events` | Member | `title` (5–140), `description` (10–4000), `eventType` (`REUNION`, `GET_TOGETHER`, `DINNER`, `MEETUP`, `VISIT_PLAN`, `OTHER`), `city` (2–80), `startsAt` (future), optional `endsAt`, `venue` (≤ 200), `budgetNote` (≤ 140), `coverId` (purpose `event`), `rsvpEnabled` (default `true`), `rsvpDeadline` (≤ `startsAt`), `capacity`, `showOnPublicSite` (default `false`) | `201` event |
| GET | `/events/:id` | Member | — | Event plus `memoryCount` |
| PATCH | `/events/:id` | Owner | Any create field | Event, back to `PENDING` for doctors |
| DELETE | `/events/:id` | Owner | — | `{ deleted: true }` |
| PUT | `/events/:id/rsvp` | Member | `status` (`GOING` \| `MAYBE` \| `NOT_GOING`), `guests` (0–5, counted only when going) | Updated event. One RSVP per member (upsert) |
| DELETE | `/events/:id/rsvp` | Member | — | Updated event |
| GET | `/events/:id/attendees` | Member | `page`, `limit` (30, max 50) | `[{ status, guests, doctor: <author summary> }]` for Going / Maybe |

Event: `{ id, title, description, eventType, venue, city, startsAt, endsAt, budgetNote, cover, organizer, rsvpEnabled,
rsvpDeadline, capacity, showOnPublicSite, isPast, rsvp{ going, maybe, notGoing, guests, attending, mine }, commentCount,
createdAt, publishedAt, isMine, moderation? }`.

## Polls — `/polls` (members only)

| Method | Path | Access | Parameters / body | Result |
| --- | --- | --- | --- | --- |
| GET | `/polls` | Member | `state` (`open` \| `closed` \| `all`, default `all`), `page`, `limit` (10, max 30) | Approved polls |
| GET | `/polls/mine` | Member | `page`, `limit` | The caller's polls in every state |
| POST | `/polls` | Member | `question` (8–240), `description` (≤ 1000), `options[]` (2–10 distinct strings, ≤ 140), `allowMultiple` (default `false`), `resultsVisibility` (`AFTER_VOTE` default, `ALWAYS`, `AFTER_CLOSE`), optional `startsAt` (default now), `endsAt` (future, after start, within one year) | `201` poll |
| GET | `/polls/:id` | Member | — | Poll |
| PATCH | `/polls/:id` | Owner | Any create field | Only while the poll is not approved and has no votes (`409 POLL_LOCKED` otherwise) |
| DELETE | `/polls/:id` | Owner | — | `{ deleted: true }` |
| POST | `/polls/:id/vote` | Member | `optionIds[]` (exactly one unless `allowMultiple`) | `201` updated poll. One ballot per member; votes are final |

Poll: `{ id, question, description, allowMultiple, resultsVisibility, startsAt, endsAt, state: "UPCOMING" | "OPEN" |
"CLOSED", creator, resultsVisible, totalVoters | null, myVote: [optionId] | null, options[{ id, text, votes?, percent? }],
createdAt, publishedAt, isMine, moderation? }`. `votes` / `percent` appear only when `resultsVisible` is true.

## Notifications — `/notifications` (own notifications only)

| Method | Path | Access | Parameters | Result |
| --- | --- | --- | --- | --- |
| GET | `/notifications` | Member | `unread=true`, `page`, `limit` (15, max 50) | `[{ id, type, title, message, link, read, createdAt }]`; `meta.unreadCount` |
| GET | `/notifications/unread-count` | Member | — | `{ unreadCount }` |
| PATCH | `/notifications/read-all` | Member | — | `{ updated }` |
| PATCH | `/notifications/:id/read` | Member | — | The notification |

Types: `WELCOME`, `CONTENT_APPROVED`, `CONTENT_REJECTED`, `CONTENT_REMOVED`, `EVENT_PUBLISHED`, `POLL_PUBLISHED`,
`EVENT_REMINDER`, `NEW_COMMENT`, `ACCOUNT_STATUS`.

## Dashboard

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| GET | `/dashboard/summary` | Member | `{ profileCompletion, submissions{ post, blog, comment, memory, event, poll → { PENDING, APPROVED, REJECTED, total } }, totals, unreadNotifications, upcomingEvents, myUpcomingRsvps }` |

## Administration — `/admin` (every route requires `ADMIN`)

| Method | Path | Parameters / body | Result |
| --- | --- | --- | --- |
| GET | `/admin/stats` | — | `{ doctors{ active, suspended }, pending{ posts, blogs, comments, memories, events, "visit-plans", polls }, openReports }` |
| GET | `/admin/doctors` | `q` (name, email, phone, specialization, city; ≤ 80), `status` (`ACTIVE` \| `SUSPENDED` \| `ALL`), `page`, `limit` (12, max 50) | Doctor accounts incl. email, phone, status, visibility, `featured`, `profileCompletion`, `suspension`, `lastLoginAt` |
| GET | `/admin/doctors/:id` | — | The same plus `contentCounts` per content type |
| PATCH | `/admin/doctors/:id/status` | `status` (`ACTIVE` \| `SUSPENDED`), `reason` (≤ 500) | Updated doctor. Suspension ends all of the doctor's sessions; the doctor is notified |
| PATCH | `/admin/doctors/:id/visibility` | `directory` and/or `featured` (booleans) | Updated doctor |
| DELETE | `/admin/doctors/:id` | optional `reason` | `{ deleted: true }` — account and everything it owns (see [DATABASE.md](DATABASE.md#deleting-a-doctor)) |
| GET | `/admin/moderation/:queue` | `queue`: `posts`, `blogs`, `comments`, `memories`, `events`, `visit-plans`, `polls`; `status` (`PENDING` default, `APPROVED`, `REJECTED`, `ALL`), `page`, `limit` (10, max 30) | Full items for review (comments include a `target` summary). Pending queues are oldest-first |
| PATCH | `/admin/moderation/:queue/:id` | `action` (`approve` \| `reject`), `reason` (≤ 500) | The reviewed item |
| DELETE | `/admin/moderation/:queue/:id` | optional `reason` | `{ deleted: true }` — works for any state, including approved content |
| GET | `/admin/reports` | `status` (`OPEN` default, `RESOLVED`, `DISMISSED`, `ALL`), `page`, `limit` (10, max 30) | Reports with reporter, reason, details and a `target` summary (`exists`, `title`, `link`, `moderationStatus`, `queue`) |
| PATCH | `/admin/reports/:id` | `status` (`RESOLVED` \| `DISMISSED`) | `{ id, status }` |
| GET | `/admin/audit-logs` | `page`, `limit` (20, max 50) | `[{ id, action, actorName, targetType, targetId, summary, createdAt }]` |

Admins remove other members' content through `DELETE /admin/moderation/:queue/:id`; the member-facing
`DELETE /posts/:id` (and equivalents) act on the caller's own content only.

## Permissions at a glance

See [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) for the full matrix.
