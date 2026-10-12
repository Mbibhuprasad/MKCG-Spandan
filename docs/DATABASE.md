# Database

MongoDB is the primary database, accessed through Mongoose 9. Models live in `backend/src/models/`. Every model has
`createdAt` (and most have `updatedAt`). Image and video binaries are **never** stored in MongoDB — only Cloudinary
metadata.

Indexes are declared in the schemas and built automatically when the API connects (`autoIndex: true`).

## Relationships

```
User ─┬─< Session
      ├─< Media ────────────(attached to)──▶ Post | Blog | Memory | Event | User(photo)
      ├─< Post ──────< Comment, Like
      ├─< Blog ──────< Comment, Like
      ├─< Memory ────< Comment, Like        Memory ──▶ Event (optional)
      ├─< Event ─────< Comment, Rsvp
      ├─< Poll ──────< Vote
      ├─< Notification
      └─< Report ──▶ any content item
AuditLog (stand-alone, append-only)
```

Comments, likes and reports refer to their target with a pair `(targetType, target)` rather than one reference per
content type.

## Shared moderation fields

Added by `plugins/moderation.js` to `Post`, `Blog`, `Comment`, `Memory`, `Event`, `Poll`:

| Field | Type | Notes |
| --- | --- | --- |
| `moderationStatus` | `PENDING` \| `APPROVED` \| `REJECTED` | Default `PENDING`; indexed |
| `submittedAt` | Date | Reset when a doctor edits |
| `reviewedAt`, `reviewedBy` | Date, → User | Set by review |
| `rejectionReason` | String ≤ 500 | |
| `publishedAt` | Date | Set at first approval; used for feed ordering |

## Models

### User (doctors and the administrator)

| Field | Type / rule |
| --- | --- |
| `role` | `ADMIN` \| `DOCTOR`, default `DOCTOR`, **immutable** |
| `status` | `ACTIVE` \| `SUSPENDED`, default `ACTIVE` |
| `name` | 2–80 chars |
| `email` | Lower-cased, **unique** |
| `phone` | Normalised `+<digits>`, **unique** |
| `passwordHash` | bcrypt hash, `select: false` |
| `passwordChangedAt`, `lastLoginAt` | Dates |
| `policyAcceptance` | `{ version, acceptedAt }` |
| `profile` | See [DOCTOR_PORTFOLIO.md](DOCTOR_PORTFOLIO.md): photo `{ media → Media, url, thumbUrl }`, title, specialization, subspecialty, designation, hospital, city, state, batchYear, yearsOfExperience, bio, qualifications[], interests[], languages[], education[], experience[], achievements[], publications[], links[] |
| `profilePromptDismissedAt` | Date |
| `visibility` | `{ directory (default true), publicListing (false), showEmail (false), showPhone (false) }` |
| `featured` | Boolean, set by admins only |
| `suspension` | `{ reason, at, by → User }` |

Indexes: unique `email`; unique `phone`; `{ role, status, visibility.directory, name }`;
`{ role, status, profile.specialization }`; `{ role, status, profile.city }`; `{ featured, role, status }`.

### Session

`user → User`, `client` (`web` \| `mobile`), `userAgent` (≤ 200), `expiresAt`.
Indexes: `user`; **TTL** on `expiresAt` (document removed when it expires).

### Media

One document per Cloudinary asset.

| Field | Notes |
| --- | --- |
| `owner → User` | The uploader |
| `purpose` | `profile`, `blog`, `post`, `event`, `memory` |
| `publicId` | Cloudinary public id, **unique** |
| `resourceType` | `image` \| `video` |
| `deliveryType` | `upload` (public) \| `authenticated` (signed URLs only) |
| `format`, `bytes`, `width`, `height`, `duration` | From Cloudinary |
| `attachedTo` | `{ kind: Post \| Blog \| Memory \| Event \| User, item: ObjectId }` — `null` until claimed |
| `attachedAt` | Date |

Indexes: `owner`; unique `publicId`; `attachedTo.item`; `{ attachedAt, createdAt }` (orphan cleanup).

### Post

`author → User`, `type` (enum), `body` (≤ 5000), `media[] → Media` (≤ 4), `likeCount`, `commentCount`, moderation fields.
Indexes: `{ moderationStatus, publishedAt: -1 }` (feed), `{ moderationStatus, submittedAt }` (queue), `{ author, createdAt: -1 }`.

### Blog

`author → User`, `title` (≤ 160), `slug` (**unique**, stable), `excerpt` (≤ 320), `bodyMarkdown` (source),
`bodyHtml` (sanitised render), `cover → Media`, `category` (enum), `tags[]` (lower-case), `readingMinutes`, `likeCount`,
`commentCount`, moderation fields.
Indexes: unique `slug`; `{ moderationStatus, publishedAt: -1 }`; `{ moderationStatus, category, publishedAt: -1 }`;
`{ moderationStatus, tags, publishedAt: -1 }`; `{ moderationStatus, submittedAt }`; `{ author, createdAt: -1 }`.

### Comment

`author → User`, `targetType` (`post` \| `blog` \| `memory` \| `event`), `target` (ObjectId), `body` (≤ 2000), moderation fields.
Indexes: `{ targetType, target, moderationStatus, createdAt: -1 }`; `{ moderationStatus, submittedAt }`; `{ author, createdAt: -1 }`.

### Like

`user → User`, `targetType` (`post` \| `blog` \| `memory`), `target`.
Indexes: **unique** `{ user, targetType, target }` — one like per doctor per item; `{ targetType, target }`.

### Memory

`owner → User`, `title` (≤ 140), `caption` (≤ 1500), `event → Event` (optional), `memoryDate`, `media[] → Media` (1–12),
`likeCount`, `commentCount`, moderation fields.
Indexes: `{ moderationStatus, publishedAt: -1 }`; `{ moderationStatus, event, publishedAt: -1 }`;
`{ moderationStatus, submittedAt }`; `{ owner, createdAt: -1 }`.

### Event (events and visit plans)

`organizer → User`, `title`, `description` (≤ 4000), `eventType` (`REUNION`, `GET_TOGETHER`, `DINNER`, `MEETUP`,
`VISIT_PLAN`, `OTHER`), `venue`, `city`, `startsAt`, `endsAt` (defaults to `startsAt`), `budgetNote`, `cover → Media`,
`rsvpEnabled`, `rsvpDeadline`, `capacity`, `showOnPublicSite`, `commentCount`, `reminderSentAt`, moderation fields.
Indexes: `{ moderationStatus, endsAt }`; `{ moderationStatus, startsAt }`; `{ moderationStatus, eventType, submittedAt }`;
`{ organizer, createdAt: -1 }`.

Only a city/venue and dates are stored; there is no location tracking.

### Rsvp

`event → Event`, `user → User`, `status` (`GOING` \| `MAYBE` \| `NOT_GOING`), `guests` (0–5).
Indexes: **unique** `{ event, user }` — one RSVP per doctor per event; `user`.

### Poll

`creator → User`, `question` (≤ 240), `description` (≤ 1000), `options[] { _id, text }` (2–10), `allowMultiple`,
`resultsVisibility` (`ALWAYS` \| `AFTER_VOTE` \| `AFTER_CLOSE`), `startsAt`, `endsAt`, `voteCount` (informational),
moderation fields.
Indexes: `{ moderationStatus, endsAt: -1 }`; `{ moderationStatus, submittedAt }`; `{ creator, createdAt: -1 }`.

A poll is closed when `endsAt` has passed (computed at read time — no job is needed).

### Vote

`poll → Poll`, `user → User`, `options[]` (option ids; several only when `allowMultiple`).
Indexes: **unique** `{ poll, user }` — one ballot per doctor per poll; `user`.

Results are always computed by aggregating `Vote` documents, so they cannot drift from the ballots actually cast.

### Notification

`user → User`, `type`, `title`, `message`, `link`, `dedupeKey` (optional), `readAt`.
Indexes: `{ user, createdAt: -1 }`; `{ user, readAt }`; **unique partial** `{ user, dedupeKey }` (only when
`dedupeKey` is a string); **TTL** on `createdAt` — removed after 180 days.

### Report

`reporter → User`, `targetType` (`post`, `blog`, `comment`, `memory`, `event`, `poll`), `target`, `reason` (enum),
`details` (≤ 1000), `status` (`OPEN` \| `RESOLVED` \| `DISMISSED`), `resolvedBy → User`, `resolvedAt`.
Indexes: **unique** `{ reporter, targetType, target }`; `{ status, createdAt: -1 }`; `{ targetType, target }`.

### AuditLog

`actor → User` (nullable), `actorName`, `action`, `targetType`, `targetId`, `summary` (≤ 400), `metadata` (small object).
Indexes: `{ createdAt: -1 }`; `{ action, createdAt: -1 }`. Append-only; no API modifies or deletes entries.

## Uniqueness and atomicity

| Rule | Mechanism |
| --- | --- |
| One account per email / phone | Unique indexes; a lost race returns `409 ACCOUNT_EXISTS` |
| One like per doctor per item | Unique index; the counter is incremented only when the insert succeeds |
| One vote per doctor per poll | Unique index; duplicate → `409 ALREADY_VOTED` |
| One RSVP per doctor per event | Unique index + `findOneAndUpdate` upsert (retried once on a duplicate-key race) |
| One report per doctor per item | Unique index |
| No duplicate notifications | Unique partial index on the dedupe key + upsert |
| An upload is attached to one item only | Atomic `findOneAndUpdate` that matches only unattached uploads owned by the caller |
| Moderation decisions | Compare-and-set on the previous status |

**Transactions are not used.** Stand-alone MongoDB servers (and some hosted tiers) do not support multi-document
transactions, so the application does not depend on them. Multi-step operations are ordered so that an interruption
leaves the data safe, and can be repeated.

## Deletion behaviour

Implemented in `deleteContent()` (`backend/src/services/content.service.js`). Cloudinary assets are destroyed together
with their `Media` documents.

| Deleting a… | Also removes |
| --- | --- |
| Post | Its comments (and reports on them), likes, reports, and its images |
| Blog | Its comments (and reports on them), likes, reports, and its cover image |
| Memory | Its comments (and reports on them), likes, reports, and all its photos/videos |
| Event / visit plan | Its comments (and reports on them), RSVPs, reports, cover image; memories linked to it are kept and unlinked (`event: null`) |
| Poll | Its votes and reports |
| Comment | Reports on it; the target's `commentCount` is decremented if the comment was approved |

The same routine runs whether the owner or an admin deletes the item.

### Deleting a doctor

`DELETE /admin/doctors/:id` → `deleteDoctorCascade()` in `backend/src/services/doctor.service.js`. The chosen policy
is **full removal**: the community keeps no content from a deleted account.

Order of operations:

1. **Lock the account** — status set to `SUSPENDED` and all sessions deleted, so the user cannot act while the
   cascade runs.
2. **Owned content** — every post, blog, memory, event and poll of the doctor is deleted through `deleteContent()`
   (with the dependants listed above).
3. **Comments** written by the doctor on other people's content — deleted, with counters corrected.
4. **Likes** — each is deleted and the target's `likeCount` decremented.
5. **Votes** — each is deleted and the poll's `voteCount` decremented (results are recomputed from remaining ballots).
6. **RSVPs, reports filed by the doctor, notifications** — deleted.
7. **Media** — every remaining upload owned by the doctor (profile photo, unattached uploads) is destroyed in
   Cloudinary and removed.
8. **The user document** is deleted.

Afterwards an audit entry `DOCTOR_DELETED` keeps a minimal record: the former id, the name and the optional reason.
Nothing else about the person is retained by the application.

Each step is idempotent. If the process stops part-way (for example a network failure), run the deletion again; it
continues from wherever the data stands. If your organisation has legal retention duties for specific records, adapt
this routine before production use.

### Automatic expiry

| Data | Removed |
| --- | --- |
| Sessions | When `expiresAt` passes (TTL index) |
| Notifications | 180 days after creation (TTL index) |
| Unattached uploads | 24 hours after upload (background job / `npm run media:cleanup`) |

MongoDB's TTL monitor runs about once a minute, so removal is not instantaneous; the API also checks `expiresAt` on
every request.

## Backup and recovery considerations

- **Database:** use MongoDB Atlas continuous backup / scheduled snapshots, or `mongodump` on a schedule for
  self-hosted deployments. Decide and document a recovery point objective, keep backups encrypted and access-limited,
  and **test a restore** before launch and periodically afterwards.
- **Media:** the files live in Cloudinary, not in the database backup. Enable Cloudinary's backup feature or
  replicate to your own storage if media loss is unacceptable. A restored database refers to assets by `publicId`;
  assets deleted from Cloudinary after the backup was taken will be missing after a restore.
- **Consistency after restore:** counters (`likeCount`, `commentCount`, `voteCount`) are derived data and can be
  recomputed from `Like`, `Comment` and `Vote` if needed. Sessions can simply be dropped (users log in again).
- **Deletion and backups:** content and accounts deleted in the application remain in older backups until those
  expire. Reflect your backup retention period in the Privacy Policy.
- **Secrets:** `JWT_SECRET` and Cloudinary credentials are not in the database; back them up in your secret manager.
  Rotating `JWT_SECRET` invalidates all sessions and CSRF tokens.

## Remaining limitations

- No migration framework is included; schema changes are handled by Mongoose defaults and manual scripts.
- Name search uses a case-insensitive regular expression (not a text or Atlas Search index) — fine for a batch
  community, not for very large directories.
- Counters are maintained by separate atomic updates rather than transactions; an interruption between two writes can
  leave a counter off by one until recomputed.
