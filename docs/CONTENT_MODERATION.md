# Content publishing and moderation

Code: `backend/src/models/plugins/moderation.js`, `backend/src/services/content.service.js`,
`backend/src/services/moderation.service.js`, `backend/src/services/legacyContent.service.js`,
`backend/src/controllers/admin.controller.js`.

**There is no approval step.** Whatever a doctor creates is published as soon as it has been validated and saved.
Administrators do not release content; they can delete it afterwards, act on reports, and suspend or delete accounts.
Account status remains entirely separate from content: registering and logging in never required approval either.

## Content types

| Type | Model | Owner field | Likes | Comments |
| --- | --- | --- | --- | --- |
| Post | `Post` | `author` | Yes | Yes |
| Blog | `Blog` | `author` | Yes | Yes |
| Comment | `Comment` | `author` | — | — |
| Memory / gallery item (photos, videos) | `Memory` | `owner` | Yes | Yes |
| Event and visit plan | `Event` (`eventType: VISIT_PLAN` for visit plans) | `organizer` | — | Yes |
| Poll | `Poll` | `creator` | — | — |

## Lifecycle

```
doctor or admin creates ──▶ published (moderationStatus: APPROVED, publishedAt: now)
owner edits             ──▶ stays published
owner deletes, or admin deletes ──▶ removed with its dependants
```

1. **Create.** The handler authenticates the caller, validates text and media, sets the owner from the session and
   stores the item with `content.publishedState()`. No request field can influence the owner or the status — a body
   containing `author`, `userId`, `role`, `moderationStatus` or `publishedAt` is ignored.
2. **Visible at once.** The item appears in its feed, list or gallery for the audience that may see that type
   (members; for blogs, the public), and on its author's portfolio where applicable.
3. **Announcements.** Publishing an event, visit plan or poll notifies all active doctors once; a comment notifies the
   owner of the item it was written on (`moderation.announce()`). Editing does not announce again.
4. **Editing.** `content.publishAfterEdit()` keeps the item published. Edits are visible immediately.
5. **Deletion.** The owner can delete their own item at any time. An admin can delete **any** item through
   `DELETE /admin/moderation/:queue/:id`; the author is notified and the action is audited.

### Polls

A poll can be edited until someone has voted (`409 POLL_LOCKED` afterwards), so the options people voted on can never
change. To change a poll that has votes, delete it and create a new one.

## One record, several places

Nothing is copied to make it appear in more than one place.

- **Blogs.** There is one `Blog` collection. A blog written from the profile wizard, from the dashboard or from the
  Blogs page is created by the same `POST /blogs`. It is listed on the Blogs page (`GET /blogs`), on its author's
  portfolio (`GET /blogs?author=<id>`) and in the author's own list (`GET /blogs/mine`) — the same document each time.
- **Gallery and memories.** There is one `Memory` collection. A doctor's personal gallery is simply their memories
  (`GET /memories?owner=<id>`). `showInCommunity` (default `true`) decides whether an item is also listed in the
  community Memories section (`GET /memories`). Media files live in Cloudinary; MongoDB stores their metadata.

## Visibility rules (enforced by the API)

| Request | Result |
| --- | --- |
| Feed / list endpoints (`GET /posts`, `/blogs`, `/memories`, `/events`, `/polls`) | Published items. `/memories` lists only items with `showInCommunity` on |
| `GET /memories?owner=<id>` | That doctor's gallery. Items kept for the portfolio only are included for the owner and admins, and for other members only while the doctor is listed in the directory and has not hidden the gallery section; otherwise only the items that are in the community section anyway |
| `GET /memories/:id` and its download link | Refused with `404` for a portfolio-only item the caller may not see in the gallery |
| `GET /<type>/mine` | Everything the caller owns |
| Like, comment, report, RSVP, vote | On published items |
| Edit / delete of someone else's item | `403` (`404` for an item the caller cannot see at all) |
| Public pages | Blogs, opted-in featured doctors and opted-in event summaries only. Memories, posts, events, polls and comments stay members-only |

Removing approval did not widen any audience: members-only content is still members-only, private media is still
delivered through signed URLs, and suspended accounts cannot create anything because every request they make is
refused.

## Comments

A comment joins its thread immediately. Each commentable item keeps `commentCount` = number of published comments; it
is incremented when a comment is created and decremented when one is deleted.

## Notifications

| Event | Recipient | Type |
| --- | --- | --- |
| Event or visit plan published | All active doctors except the organiser | `EVENT_PUBLISHED` |
| Poll published | All active doctors except the creator | `POLL_PUBLISHED` |
| Comment posted | Owner of the item that was commented on (if different from the commenter) | `NEW_COMMENT` |
| Item deleted by an admin | Owner | `CONTENT_REMOVED` |

Fan-out and comment notifications carry a dedupe key. `CONTENT_APPROVED` and `CONTENT_REJECTED` are no longer
generated (old notifications of those types are still displayed).

## What administrators can do

`GET /admin/moderation/:queue` lists every item of a type, newest first; `DELETE /admin/moderation/:queue/:id`
removes one. (The path keeps its historical name; in the interface this page is called **Content**.)

| List | Contents |
| --- | --- |
| `posts` | Posts |
| `blogs` | Blogs (with the rendered body) |
| `comments` | Comments, each with a summary and link of the item it belongs to |
| `memories` | Memories / gallery items with their media |
| `events` | Events except visit plans |
| `visit-plans` | Events with `eventType: VISIT_PLAN` |
| `polls` | Polls |

An item can only be deleted through the list it belongs to. The admin dashboard (`GET /admin/stats`) shows how many
items of each type exist and how many reports are open. There is no approve or reject action, and no route for one.

Administrators also manage doctors: view the directory and any profile, suspend or reactivate an account, and delete
an account together with everything it owns (see [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) and the
deletion policy in [DATABASE.md](DATABASE.md)). There are exactly two roles, `ADMIN` and `DOCTOR`.

## Reports

Members can report a post, blog, comment, memory, event or poll (`POST /reports`) with a reason and optional details —
once per item, and not their own content. Admins see reports at `GET /admin/reports` with a link to the item and to
the content list where it can be deleted, then mark each report `RESOLVED` or `DISMISSED`. Reports about an item are
deleted with the item.

## Audit trail

Admin deletions of content (`CONTENT_DELETED`) and account actions are written to the audit log with the admin, the
item id, its owner and the reason.

## Records from the former approval workflow

Until this change, doctor-created content started as `PENDING` and needed an administrator's approval. The stored
fields were kept — `moderationStatus` (`PENDING` / `APPROVED` / `REJECTED`), `submittedAt`, `reviewedAt`,
`reviewedBy`, `rejectionReason`, `publishedAt` — so existing records load unchanged, and "published" is still stored
as `APPROVED`. New documents default to `APPROVED`.

Items that were still `PENDING` or `REJECTED` stay hidden from everyone but their owner and admins until one of these
happens:

- **The one-off clean-up is run.** `npm run content:publish-pending` (in `backend/`) reports what it would do;
  `npm run content:publish-pending -- --apply` does it. It publishes items that were only waiting for review, using
  their original submission time as the publication time and sending no notifications. It leaves alone: `REJECTED`
  items (an administrator explicitly refused them), items whose owner is suspended or no longer exists, and comments
  on something that is itself not published. It is idempotent.
- **The owner edits the item.** Saving it publishes it.
- **An admin deletes it.** The Content page offers a "Hidden (old approval system)" filter while any such items exist.

## Remaining limitations

- Moderation happens after publication: something inappropriate can be visible until it is reported and removed.
  There is no automated screening of text, images or videos.
- Suspending a doctor does not remove content they already published — delete it separately.
- Admins cannot edit or temporarily hide content; they can delete it.
- Notifications are in-app only (no email or SMS).
- Previous versions of edited content are not kept.
- The public homepage is cached for up to a minute, so a new blog can take that long to appear in its "recent blogs"
  section. The Blogs page and each blog page are not cached.
