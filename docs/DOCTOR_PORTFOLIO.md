# Doctor profile and professional portfolio

Every doctor has a profile that doubles as a small professional portfolio. It is stored on the shared `User` model
(`backend/src/models/User.js`); there is no separate "Doctor" collection.

Code: `backend/src/controllers/doctor.controller.js`, `backend/src/validators/doctor.validators.js`,
`backend/src/services/serializers.js` (`profileBody`, `memberProfileBody`, `profileCompletion`,
`requiredProfileIssues`, `serializeDoctor*`).

Pages: `/dashboard/profile` (the profile wizard), `/doctors` (member directory), `/doctors/[id]` (portfolio).

## The profile wizard

`/dashboard/profile` is a step-by-step wizard (`frontend/src/components/dashboard/profile-wizard/`). It is used both to
complete a new profile and to edit a finished one. Nine steps collect the profile, followed by privacy and a review.

| # | Step | Fields (`profile.…` unless noted) |
| --- | --- | --- |
| 1 | Basic profile of doctor | photo, top-level `name`\*, `professionalTitle`, `designation`, `address`, `bio`, `languages[]` |
| 2 | Field of work, expertise & procedures | `specialization`\*, `subspecialty`, `fieldOfWork`, `expertise[]`, `procedures[]`, `interests[]`, `experience[]` |
| 3 | Clinical practice area, address & contact | `practiceArea`, `hospital`, `workAddress`, `city`\*, `state`, `country`, `workEmail`, `workPhone`, `practiceLocations[]`, `links[]` |
| 4 | Education, degree & certification | `education[]` (academic degrees), `qualifications[]` (letters), `credentials[]` (professional qualifications and certifications) |
| 5 | Fellowship & postdoctoral certification | `fellowships[]` |
| 6 | Awards | `achievements[]`, each with an optional image |
| 7 | Membership | `memberships[]` |
| 8 | Publications | `publications[]` |
| 9 | Gallery and blogs | not part of the profile document — see "Gallery and blogs" below |
| 10 | Privacy & profile visibility | top-level `visibility` |
| 11 | Review & submit | — (summary of the steps above, each with an Edit button) |

\* required before the wizard can be submitted. Everything else is optional. Administrators are never listed in the
directory, so for them only the name is required and the privacy step does not apply.

Fields that existed before this structure were kept and given a home rather than dropped: languages (step 1),
positions held (step 2), professional links (step 3) and qualification letters (step 4). Awards are stored in the
existing `achievements` list.

Three fields are **no longer collected or shown**: the professional headline (`headline`), total years of experience
(`yearsOfExperience`) and batch year (`batchYear`). They remain in the schema and the API still accepts and returns
them, so values saved earlier are not lost — the form, the review, the portfolio and the directory card simply no
longer use them, and the completion meter no longer counts years of experience.

### Gallery and blogs (step 9)

This step has two subsections and stores nothing in the profile:

- **Personal gallery** — each item is a **memory**, created, edited and deleted through the existing `/memories` API
  and stored in the `Memory` collection with its photos in Cloudinary. `showInCommunity` decides whether the item is
  also listed in the community Memories section; it is always part of the doctor's gallery.
- **Personal blogs** — each one is a **community blog**, created through the existing `/blogs` API and stored in the
  one `Blog` collection. It is listed on the Blogs page and on the author's portfolio; nothing is duplicated.

Both are published the moment they are saved (they do not wait for "Next" or for the final submission) and need no
approval. The step reuses the ordinary memory and blog forms inside a dialog. A doctor who skips the wizard can add
either later from the dashboard (`/dashboard/create/memory`, `/dashboard/create/blog`) or from the "Add photos" and
"Write a blog" buttons on their own portfolio — the wizard does not have to be reopened.

How it behaves:

- **Nothing blocks the dashboard.** A doctor who registers is signed in and can use the community at once. Until the
  wizard has been submitted the dashboard shows "Complete Your Professional Profile" (dismissible with "Skip for
  now").
- **Next** checks the current step and saves what changed with `PATCH /doctors/me`. Only the fields of the steps
  that changed are sent, together with `wizardStep` (the furthest step reached).
- **Back** and the step navigation keep everything that was typed. Moving forward through the navigation validates
  the steps in between first.
- **Save progress** saves without requiring the mandatory fields, so a doctor can stop at any step. After signing
  out and in again — on any device — the wizard resumes at the saved step with the saved data
  (`profileCompletion.resumeStep`). Nothing about the profile is kept in browser storage.
- **Submit** sends every step again with `submit: true`. The API re-validates the whole request, checks the required
  fields against the profile as it would be stored and, only if everything is in order, saves it and records
  `profileWizard.completedAt`. The success screen is shown after that response — never before — and then redirects
  to the portfolio. A failed request leaves the form exactly as it was.
- **Unsaved changes** trigger a confirmation before a link leaves the page, and the browser's own warning before
  the tab is closed or reloaded.
- **Validation** runs in the browser for quick feedback (required fields, years, year ranges, email, phone, links)
  and again on the server. A failed check shows the message next to the field, flags the step in the navigation and
  moves focus to the first field concerned.
- **Photo** uploads are saved immediately through the photo endpoints (see below); they are not part of a step's
  save. An **award image** is uploaded immediately too (`POST /media`, purpose `award`) and attached to the profile
  when the awards step is saved.
- **Expired sessions**: a save answered with `401` signs the interface out and returns to the login page with
  `next=/dashboard/profile`; after signing in the wizard resumes from what was last saved.

Animation: Framer Motion handles the step transitions, the add/remove/expand of repeatable entries, the validation
banner, the active-step highlight and the success tick. GSAP handles the wizard's entrance, the progress fills and
the slow backdrop drift (large screens only). Each element is animated by one library only, GSAP work is reverted in
effect clean-ups, and with `prefers-reduced-motion` the wizard is shown immediately without non-essential movement.

## Profile fields

All profile fields are optional when saving — a doctor can register with only name, email, phone and password and
complete the profile gradually.

| Field | API name (`profile.…`) | Limit |
| --- | --- | --- |
| Profile photo | set via `PUT /doctors/me/photo` | JPG / PNG / WebP up to `MAX_IMAGE_MB` |
| Full name | top-level `name` | 2–80 characters |
| Professional title | `professionalTitle` | ≤ 120 |
| Address | `address` | ≤ 240. Entered in the basic profile step; shown to signed-in members on the portfolio, never on directory or public cards |
| Professional headline | `headline` | ≤ 160 — no longer collected by the form |
| Specialization | `specialization` | ≤ 80 |
| Subspecialization | `subspecialty` | ≤ 80 |
| Field of work | `fieldOfWork` | ≤ 120 |
| Areas of expertise | `expertise[]` | ≤ 20 entries, ≤ 80 each |
| Procedures performed | `procedures[]` | ≤ 30 entries, ≤ 100 each |
| Clinical practice area | `practiceArea` | ≤ 160 |
| Current designation | `designation` | ≤ 120 |
| Hospital or clinic | `hospital` | ≤ 160 |
| City, state, country | `city`, `state`, `country` | ≤ 80 each |
| Workplace address | `workAddress` | ≤ 240 |
| Workplace email | `workEmail` | empty or a valid email address (stored lower-case) |
| Workplace phone | `workPhone` | empty or a valid phone number (stored as `+<digits>`) |
| Other practice locations | `practiceLocations[] { hospital*, area, address, city, state, country, phone }` | ≤ 5 entries; `phone` empty or a valid phone number, shown to members only with `showWorkContact` |
| Batch year | `batchYear` | 1940–2100 or `null` — no longer collected by the form |
| Years of experience | `yearsOfExperience` | 0–80 or `null` — no longer collected by the form |
| Biography | `bio` | ≤ 1200 |
| Qualification letters | `qualifications[]` | ≤ 12 entries, ≤ 80 each |
| Professional interests | `interests[]` | ≤ 15 entries, ≤ 60 each |
| Languages | `languages[]` | ≤ 12 entries, ≤ 40 each |
| Academic degrees | `education[] { degree*, level, institution, fieldOfStudy, startYear, year, certification, details }` | ≤ 10 entries; `degree` is the degree title; `level` is empty or one of `UNDERGRADUATE`, `POSTGRADUATE`, `SUPER_SPECIALITY`, `DOCTORATE`, `DIPLOMA`, `OTHER`; `year` is the completion year and may not precede `startYear` |
| Professional qualifications and certifications | `credentials[] { title*, type, institution, year, registration, details }` | ≤ 15 entries; `type` is empty or one of `DEGREE`, `DIPLOMA`, `BOARD_CERTIFICATION`, `MEMBERSHIP`, `LICENCE`, `OTHER` |
| Professional experience | `experience[] { role*, organization, employmentType, city, state, startYear, endYear, current, description }` | ≤ 15 entries; end year not before start year; `employmentType` is empty or one of `FULL_TIME`, `PART_TIME`, `VISITING`, `HONORARY`, `PRIVATE_PRACTICE`, `TRAINING`, `ACADEMIC`, `OTHER` |
| Fellowships and postdoctoral certifications | `fellowships[] { title*, institution, specialty, startYear, endYear, certificate, description }` | ≤ 10 entries; `certificate` holds the postdoctoral qualification or certification; completion year not before start year |
| Awards | `achievements[] { title*, issuer, year, description, imageId }` | ≤ 20 entries. `imageId` is `null` or the id of the caller's own unattached upload with purpose `award`; the API stores `{ media, url, thumbUrl }` and returns `imageUrl` / `imageThumbUrl`. A URL can never be supplied. Dropping an award or its image destroys the Cloudinary asset |
| Memberships | `memberships[] { organization*, type, number, startYear, endYear, current }` | ≤ 15 entries; end year not before start year; `number` is private unless `showRegistration` |
| Publications | `publications[] { title*, journal, authors, year, description, url }` | ≤ 30 entries; `url` (a DOI link or publication page) empty or `http(s)://…` |
| Professional links | `links[] { label*, url* }` | ≤ 6 entries; `http(s)://…` only |

\* required within an entry.

`professionalTitle` keeps its original meaning (for example "Consultant Cardiologist") because it is what cards and
author lines show under a name; honorifics such as "Dr" remain part of the name.

`credentials[].registration` is free text for a registration or licence reference. It is **self-declared and not
verified** — the platform has no medical-registration check — and it is private unless the doctor turns on
`visibility.showRegistration`.

Not collected: date of birth, home address, identity documents and — by policy — any patient information. There is
no GPS or location tracking; location is whatever the doctor types.

`specialization` and `city` may also be given at registration and are carried into the wizard. Email and phone are
account fields: they are set at registration and cannot be changed through the profile endpoint.

### Updating

`PATCH /api/v1/doctors/me` accepts any subset of `name`, `profile`, `visibility`, `dismissProfilePrompt`,
`wizardStep` (0–10) and `submit`. Only the fields present are changed; list fields (`education`, `links`, …) are
replaced as a whole when sent; `visibility.sections` is merged key by key. Unknown keys — including `role`,
`status`, `email`, `phone`, `featured`, `profileWizard` and `profileCompletion` — are discarded, so a profile request
can never change a role, an account status or the completion timestamp.

With `submit: true` the request is refused with `400 VALIDATION_ERROR` (and nothing is saved) when a required field
would be missing; `details` names each field, for example `{ "profile.city": "City is required." }`.

There is no endpoint for writing to another doctor's profile: every write goes to `/doctors/me` and acts on the
authenticated account only.

## Profile completion

Computed on every read by `profileCompletion()`:

`{ percent, isComplete, missing[], requiredMissing[], completedAt, resumeStep }`

- `isComplete` — the wizard status. True once the doctor has submitted the wizard (`profileWizard.completedAt` is
  set by the API after a successful save) **and** the required fields are still present. Filling fields in without
  submitting does not complete a profile, and a profile that later loses a required field stops counting as
  complete.
- `requiredMissing` — labels of the required fields still empty (`Full name`, `Primary specialization`, `City`).
- `completedAt` — when the wizard was first submitted, or `null`.
- `resumeStep` — the step (0-based) the wizard reopens on for an unfinished profile.
- `percent` and `missing` — how much of the portfolio is filled in, from nine equally weighted checks: profile photo;
  professional title or designation; specialization; hospital or clinic; city; biography; at
  least one education entry; at least one qualification (letters or a detailed entry); at least one experience
  entry. These drive the completion bar and the "still to add" hints, not the status.

Accounts created before the wizard existed have no completion timestamp, so their owners are invited once to review
and submit; all their saved data is prefilled.

## Visibility preferences

Stored in `user.visibility`; changed by the doctor in step 9 (`PATCH /doctors/me`).

| Preference | Default | Effect |
| --- | --- | --- |
| `directory` | `true` | Listed in the member directory and searchable. When off, other members who open the profile link see only a name card |
| `publicListing` | `false` | **Consent** to appear as a small card on the public homepage |
| `showEmail` | `false` | Account email visible to signed-in members on the portfolio |
| `showPhone` | `false` | Account phone visible to signed-in members on the portfolio |
| `showWorkContact` | `true` | Workplace email and phone (if entered) visible to signed-in members on the portfolio |
| `showRegistration` | `false` | Registration details of qualifications **and membership numbers** visible to signed-in members |
| `sections.{education, qualifications, experience, fellowships, achievements, memberships, publications, gallery, links}` | `true` each | Whether that portfolio section is shown to other members. `gallery` governs the items kept for the portfolio only; memories shared with the community stay in the Memories section, and blogs are public |

These settings are enforced in the API, not in the browser: for another member, `memberProfileBody()` empties the
hidden sections, blanks `registration` and membership `number`, removes the phone numbers of extra practice
locations, and leaves workplace contact out of `contact` before the response is sent,
so hidden data never reaches their device. The doctor and administrators always receive the full profile; on their
own portfolio the doctor sees "Hidden from other members" and "Only you can see this" markers instead.

An administrator can additionally:

- set `directory` to `false` for a doctor (hide from the directory), and
- set the `featured` flag (`PATCH /admin/doctors/:id/visibility`).

A doctor appears on the public homepage only when **both** `visibility.publicListing` (the doctor's consent) and
`featured` (the admin's decision) are true, and the account is active and directory-visible. A doctor cannot set
`featured` themselves.

## What each audience sees

| Audience | Endpoint | Fields |
| --- | --- | --- |
| Signed-out visitor | `GET /doctors/featured` | `id, name, photoUrl, professionalTitle, specialization, city` — opted-in **and** featured doctors only, at most 8. No contact details, hospital or biography |
| Member, directory card | `GET /doctors` | `id, name, photoUrl, professionalTitle, specialization, designation, hospital, city, state, yearsOfExperience, batchYear`. Never email or phone |
| Member, portfolio | `GET /doctors/:id` | `profile` with the doctor's visibility choices applied, `memberSince`, and in `contact`: `email` / `phone` / `workEmail` + `workPhone` only if the doctor enabled each |
| Member, doctor hidden from the directory | `GET /doctors/:id` | `limited: true` with `name`, photo, professional title and specialization only |
| The doctor themself | `GET /doctors/me`, `GET /doctors/:id` | Everything, including own contact details, visibility settings and completion |
| Administrator | `GET /admin/doctors`, `GET /admin/doctors/:id` | Everything plus status, suspension details, `featured`, last login and content counts |

Suspended doctors are removed from the directory and their portfolio returns `404` to other members. The
administrator account is never listed in the directory.

## Portfolio page

`/doctors/[id]` is built entirely from the saved profile — there is no per-doctor page. It is laid out like a
personal portfolio site rather than a stack of cards:

- **Hero** — the photo (or initials), the name as the page heading, specialization, professional title and
  designation, hospital, location, address and "member since"; "Get in touch" / "Call" buttons when the doctor shows
  contact details; and a strip of real figures (areas of expertise, procedures, awards, publications) when there are
  at least two to show.
- **Chapter bar** — links to each section, pinned below the site header while scrolling.
- **Chapters** — open sections separated by rules, each with its number and title in a side column, **in the order of
  the profile form**. Each is shown only when it has content, and fades in as it scrolls into view (not with reduced
  motion):

1. About — biography and languages
2. Field of work, expertise and procedures — specialization, subspecialization, field of work, areas of expertise,
   procedures performed, interests, and work experience as a timeline with the current position marked
3. Clinical practice, address and contact — main practice, the contact details the doctor chose to show,
   professional links, and other practice locations
4. Education, degrees and certification — qualification letters, academic degrees, professional qualifications
5. Fellowship and postdoctoral certification
6. Awards — with the award image where one was uploaded
7. Membership
8. Publications — authors, journal, description and a safe link
9. Gallery and blogs — the doctor's memories (`GET /memories?owner=`) as a photo grid and their blogs
   (`GET /blogs?author=`) as a list

On their own portfolio a doctor also sees "Hidden from other members" on sections they switched off, "Only you can
see this" on private numbers, and "Edit profile", "Add photos" and "Write a blog" buttons.

On the web the directory and portfolio pages are client-rendered behind the member gate, are marked `noindex`, and
are disallowed in `robots.txt` — and, independently of that, the API refuses unauthenticated requests. The wizard
lives under `/dashboard`, which is `noindex` and requires a session.

## Directory search and filters

`GET /api/v1/doctors?q=&specialization=&city=&page=&limit=`

- `q` — case-insensitive match anywhere in the name (input is escaped and limited to 60 characters).
- `specialization`, `city` — exact, case-insensitive match (collation strength 2). The available values come from
  `GET /doctors/filters`, which returns the distinct values present among listed doctors. The wizard offers the same
  values as suggestions (together with a list of common specialties) to keep spellings consistent, while still
  accepting anything a doctor types.
- Sorted by name; `limit` defaults to 12 (maximum 48).
- Only active doctors with `visibility.directory: true` are returned.

## Profile photo

1. The browser uploads the image to `POST /api/v1/media` with `purpose=profile` (see [CLOUDINARY.md](CLOUDINARY.md)).
2. `PUT /api/v1/doctors/me/photo { mediaId }` claims that upload — it must belong to the caller, have the `profile`
   purpose and be unattached — and stores `{ media, url, thumbUrl }` on the profile.
3. The previous photo, if any, is deleted from Cloudinary.
4. `DELETE /api/v1/doctors/me/photo` removes the photo and its asset.

Only URLs and the media reference are stored in MongoDB; the image itself lives in Cloudinary. Profile photos use
Cloudinary's public (`upload`) delivery type because cards may appear on the public homepage (with consent). `url`
is a size-limited display image; `thumbUrl` is a 320 px face-aware square used on cards and author lines. Without a
photo the interface shows the doctor's initials.

## Remaining limitations

- Email and phone cannot be changed after registration.
- Specialization and city are free text, so spelling variants ("Bhubaneswar" / "Bhubaneshwar") can still appear as
  separate filter values; the wizard's suggestions reduce this but do not prevent it.
- Admin "featured" selection is manual; there is no ordering control beyond most recently updated first.
- Credentials and registration details are self-declared: the platform does not verify them.
- Because profile photos are public-delivery assets, anyone who obtains a photo's URL can open it.
- The wizard does not intercept the browser's Back button: unsaved changes on the current step are lost if the
  doctor leaves that way (everything saved by an earlier "Next" or "Save progress" is kept).
- The admin doctor detail view lists the original profile sections; expertise, procedures, practice locations,
  fellowships, memberships and detailed qualifications are visible to administrators on the doctor's portfolio page.
- Award images, like profile photos, are public-delivery Cloudinary assets: anyone who obtains the URL can open it.
- Gallery items and blogs are saved by their own modules, so they are not covered by the wizard's "unsaved changes"
  warning or its final submission — each is complete as soon as its own form is saved.
