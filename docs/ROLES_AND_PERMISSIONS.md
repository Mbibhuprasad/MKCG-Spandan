# Roles and permissions

## Roles

There are exactly **two** application roles (`backend/src/config/constants.js`):

| Role | How it is assigned |
| --- | --- |
| `DOCTOR` | Every account created through public registration. The role is set by the server; a `role` field in the request is ignored |
| `ADMIN` | Only the account created by `npm run admin:create` from environment variables |

There is no super-admin role, no super-admin panel and no other elevated role. The `role` field on the `User` model is
`immutable`, so it cannot be changed through any API request, and no endpoint promotes a doctor to admin.

Account **status** (`ACTIVE` / `SUSPENDED`) is separate from the role. Content needs no approval: it is published when its author saves it.

## How permissions are enforced

All checks happen in the API; the web guards (`RequireAuth`, `RequireAdmin`, `MemberGate`) only decide what to show.

| Check | Where |
| --- | --- |
| Authentication, active status, CSRF | `requireAuth` in `backend/src/middleware/auth.js` |
| `ADMIN` role (read from the database on every request) | `requireAdmin`, applied to the whole `/admin` router |
| Visibility of unpublished content | `canView` / `loadVisible` in `backend/src/services/content.service.js` |
| Ownership for edit / delete | `loadManageable` in the same file |
| Ownership of uploads | `claimMedia` in `backend/src/services/media.service.js` |
| Per-user scoping of notifications | Every query filters by `user: req.user._id` |

Ownership (`author`, `owner`, `organizer`, `creator`, `reporter`, `user`) is always taken from the session, never from
the request body.

## Signed-out visitors

| Can see | Cannot see |
| --- | --- |
| Homepage, About, Terms, Privacy Policy, Community Guidelines | The doctor directory and portfolios |
| Blogs (list and detail) and the blog categories/tags | Posts, comments, memories, polls |
| Featured doctor cards — name, photo, title, specialization, city — **only** for doctors who opted in and whom an admin featured | Any contact detail, hospital, biography or other profile field |
| Upcoming event summaries — title, type, city, dates — **only** for events whose organiser opted in | Event descriptions, venues, attendees, covers |
| Login and registration pages | Anything under `/dashboard` or `/admin` |

## Permission matrix

"Own" = created by the signed-in user. Everything is published as soon as it is created; there is no approval step.

### Accounts and profiles

| Action | Visitor | Doctor | Admin |
| --- | --- | --- | --- |
| Register as a doctor | Yes | — | — |
| Log in / log out / change own password | — | Yes | Yes |
| View and edit own profile, photo and visibility preferences | — | Yes | Yes |
| Browse the directory and view portfolios | No | Yes | Yes |
| See another doctor's email / phone | No | Only if that doctor enabled it | Yes |
| See a doctor who opted out of the directory | No | Limited name card only | Yes |
| List all doctors with contact details and status | No | No | Yes |
| Suspend / reactivate a doctor | No | No | Yes |
| Hide a doctor from the directory, feature on the homepage | No | No (own preferences only) | Yes |
| Delete a doctor and their content | No | No | Yes |
| Create an admin | No | No | No (CLI bootstrap only) |

### Content

| Resource | View | Create | Edit | Delete |
| --- | --- | --- | --- | --- |
| Post | Members | Member — published at once | Owner (stays published) | Owner; admin (any) |
| Blog | **Everyone** | Member — published at once, from the Blogs page, the dashboard or the profile (one collection) | Owner (stays published) | Owner; admin (any) |
| Comment | Members | Member — appears at once | Owner | Owner; admin (any) |
| Memory / gallery item | Members (gallery items: see below) | Member — published at once | Owner | Owner; admin (any) |
| Event / visit plan | Members (public summary only if opted in) | Member — published at once | Owner | Owner; admin (any) |
| Poll | Members | Member — open at once | Owner, only before any vote | Owner; admin (any) |

Notes:

- A memory with `showInCommunity` off is a gallery item: members see it in the Gallery on its owner's profile and
  nowhere else, unless the owner hides the gallery section or is not listed in the directory. The owner and admins
  always see it. Only the owner can add to, change or remove from their gallery (admins can delete).
- Admins do **not** edit, approve or reject other members' content; they can delete it. Admin deletion goes through
  `DELETE /admin/moderation/:queue/:id`.
- A doctor requesting someone else's unpublished item receives `404`; trying to edit or delete someone else's
  published item returns `403`.

### Interactions

| Action | Doctor | Admin | Rules |
| --- | --- | --- | --- |
| Like / unlike a post, blog or memory | Yes | Yes | One like per user (unique index) |
| Comment on a post, blog, memory or event | Yes (immediate) | Yes (immediate) | — |
| RSVP to an event | Yes | Yes | RSVP enabled, not past, before the deadline, within capacity; one RSVP per user |
| See attendee names | Yes | Yes | Names and titles only |
| Vote in a poll | Yes | Yes | Open; one ballot per user; final |
| See poll results | Per the poll's rule | Always | The creator always sees results |
| Report content | Yes | Yes | Not own content; once per item |
| Download a memory's original file | Yes | Yes | Only if the member can see that memory; link expires after 5 minutes |
| Upload media | Yes | Yes | The uploader owns the file; only they can attach or discard it |

### Administration

| Action | Doctor | Admin |
| --- | --- | --- |
| View admin statistics | No | Yes |
| View every content item (admin Content page) | No | Yes |
| Delete any content | No | Yes |
| View and resolve reports | No | Yes |
| View the audit log | No | Yes |

## Suspended accounts

A suspended doctor cannot log in (`403 ACCOUNT_SUSPENDED`), and every request made with a session that already
existed is refused with the same code, because status is read from the database on every request — so the doctor
is locked out at once and is told why. When the account is reactivated the old sessions are deleted and the doctor
signs in again. Their directory entry and portfolio disappear for other members. Content they already published stays
visible until an admin deletes it (see [CONTENT_MODERATION.md](CONTENT_MODERATION.md)).
