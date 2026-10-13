# Doctor profile and professional portfolio

Every doctor has a profile that doubles as a small professional portfolio. It is stored on the shared `User` model
(`backend/src/models/User.js`); there is no separate "Doctor" collection.

Code: `backend/src/controllers/doctor.controller.js`, `backend/src/validators/doctor.validators.js`,
`backend/src/services/serializers.js` (`profileBody`, `memberProfileBody`, `profileCompletion`,
`requiredProfileIssues`, `serializeDoctor*`), `backend/src/services/profileOrder.js` (display order and derived
figures), `backend/src/services/specialty.service.js` and `backend/src/config/specialties.js` (specialization
catalogue).

Pages: `/dashboard/profile` (the profile wizard), `/doctors` (member directory), `/doctors/[id]` (portfolio).

## The profile wizard

`/dashboard/profile` is a step-by-step wizard (`frontend/src/components/dashboard/profile-wizard/`). It is used both to
complete a new profile and to edit a finished one. It has nine steps, in this order:

| #   | Step                 | Fields (`profile.…` unless noted)                                                                                                                                                                                                                              |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Basic profile        | photo, top-level `name`\*, `professionalTitle`, `designation`, `bloodGroup`, `headline`, `address`, `bio`, `languages[]`                                                                                                                                       |
| 2   | Expertise            | `specialization`\*, `subspecialty`, `fieldOfWork`, `expertise[]`, `procedures[]`, `experience[]`                                                                                                                                                               |
| 3   | Education            | `education[]`, `qualifications[]` (letters), `credentials[]` (professional qualifications and certifications)                                                                                                                                                  |
| 4   | Practice & contacts  | `hospital`, `designation` (the same field as in step 1), `practiceArea`, `workAddress`, `city`\*, `state`, `country`, `workPhone`, `workEmail`, top-level `whatsapp`, `practiceLocations[]`, `links[]`; also the `showWorkContact` and `showWhatsapp` switches |
| 5   | Fellowship           | `fellowships[]`                                                                                                                                                                                                                                                |
| 6   | Awards & memberships | `achievements[]` (awards, each with an optional image) and `memberships[]`, as two subsections                                                                                                                                                                 |
| 7   | Publications         | `publications[]`                                                                                                                                                                                                                                               |
| 8   | Gallery & blogs      | not part of the profile document — see "Gallery and blogs" below                                                                                                                                                                                               |
| 9   | Visibility & review  | top-level `visibility`, followed by a summary of steps 1–8, each with an Edit button                                                                                                                                                                           |

\* required before the wizard can be submitted. Everything else is optional. Administrators are never listed in the
directory, so for them only the name is required and the visibility settings do not apply.

The wizard originally had eleven steps in a different order (practice before education, awards and memberships as
separate steps, privacy and review as separate steps). Nothing was removed from the schema when they were
reorganised. A resume position saved under the old order is translated when it is read: `profileWizard.layout`
records which order `profileWizard.step` refers to (`1` = the former eleven steps, `2` = the current nine), and
`PROFILE_WIZARD_LEGACY_STEP_MAP` maps an old position to the step that now covers the same ground.

Fields that are **no longer collected by the wizard**: clinical and professional interests (`interests[]`), total
years of experience (`yearsOfExperience`) and batch year (`batchYear`). They remain in the schema and the API still
accepts and returns them, so values saved earlier are not lost; the wizard never sends them, so saving the form leaves
them untouched. The portfolio shows a saved batch year ("Batch of …", beside the medical college) and saved
professional interests (in the career overview); a profile without them simply shows neither, and nothing is derived
in their place. It shows no total of years: the dated positions in the experience timeline speak for themselves (the
API still returns the derived figure in `summary.experience`).

### Specialization and subspecialization (step 2)

- The options come from `GET /doctors/specialties` — the predefined catalogue in
  `backend/src/config/specialties.js` plus the values listed doctors typed themselves. No component carries its own
  list (`frontend/src/lib/specialties.js` is the only reader).
- Both fields are searchable comboboxes. A doctor can pick an option or type a value that is missing; an alias finds
  its entry ("orthopedics" finds _Orthopaedics_).
- The subspecialization options depend on the specialization and are refreshed when it changes.
- **Changing the specialization never keeps an old subspecialization silently.** If the current one is also an
  option of the new specialization it stays. Otherwise the form asks the doctor to choose a new one, clear it, or
  confirm that it still applies, and "Next" and "Save progress" are refused until they do. The API applies the same
  rule to a request that changes `specialization` without naming `subspecialty`: the stored subspecialization is
  kept only if it is a predefined option of the new specialization, and cleared otherwise.
- **Display formatting** is done by the API (`normalizeSpecialization`, `normalizeSubspecialty`), also at
  registration. A predefined option keeps its listed spelling whatever capitals were typed. Any other value is tidied
  into Title Case ("spine surgery" → "Spine Surgery", "head AND neck surgery" → "Head and Neck Surgery"), keeping
  capitals that carry meaning: known abbreviations ("ent" → "ENT", from `MEDICAL_ACRONYMS`) and any word typed with
  capitals after its first letter ("MCh", "LASIK", "IgA"). After a save the form shows the value as stored.

### Gallery and blogs (step 8)

This step has two subsections and stores nothing in the profile:

- **Personal gallery** — each item is created, edited and deleted through the existing `/memories` API and stored in
  the `Memory` collection with `showInCommunity: false`, its photos in Cloudinary. Gallery items are shown in the
  Gallery on the doctor's profile only; community memories (shared from the Memories page) are a separate list.
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
  when the awards and memberships step is saved.
- **Expired sessions**: a save answered with `401` signs the interface out and returns to the login page with
  `next=/dashboard/profile`; after signing in the wizard resumes from what was last saved.

Animation: Framer Motion handles the step transitions, the add/remove/expand of repeatable entries, the validation
banner, the active-step highlight and the success tick. GSAP handles the wizard's entrance, the progress fills and
the slow backdrop drift (large screens only). Each element is animated by one library only, GSAP work is reverted in
effect clean-ups, and with `prefers-reduced-motion` the wizard is shown immediately without non-essential movement.

## Profile fields

All profile fields are optional when saving — a doctor can register with only name, email, phone and password and
complete the profile gradually.

| Field                                          | API name (`profile.…`)                                                                                        | Limit                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile photo                                  | set via `PUT /doctors/me/photo`                                                                               | JPG / PNG / WebP up to `MAX_IMAGE_MB`                                                                                                                                                                                                                                                 |
| Full name                                      | top-level `name`                                                                                              | 2–80 characters                                                                                                                                                                                                                                                                       |
| Professional title                             | `professionalTitle`                                                                                           | ≤ 120                                                                                                                                                                                                                                                                                 |
| Blood group                                    | `bloodGroup`                                                                                                  | empty or one of `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`. Optional and **private**: other members receive it only with `visibility.showBloodGroup`; it never appears on directory or public cards. It is a profile detail, not a medical record                               |
| Address                                        | `address`                                                                                                     | ≤ 240. An area or locality, entered in the basic profile step (the form asks doctors not to enter a home address). `GET /doctors/:id` returns it to signed-in members, but the web portfolio does not display it; it is never on directory or public cards                            |
| Professional headline                          | `headline`                                                                                                    | ≤ 160. One line shown below the name on the portfolio                                                                                                                                                                                                                                 |
| Specialization                                 | `specialization`                                                                                              | ≤ 80. A catalogue option or a typed value; stored in display form (see above)                                                                                                                                                                                                         |
| Subspecialization                              | `subspecialty`                                                                                                | ≤ 80. Belongs to the specialization; a catalogue option or a typed value, stored in display form                                                                                                                                                                                      |
| Field of work                                  | `fieldOfWork`                                                                                                 | ≤ 120                                                                                                                                                                                                                                                                                 |
| Areas of expertise                             | `expertise[]`                                                                                                 | ≤ 20 entries, ≤ 80 each                                                                                                                                                                                                                                                               |
| Procedures performed                           | `procedures[]`                                                                                                | ≤ 30 entries, ≤ 100 each                                                                                                                                                                                                                                                              |
| Clinical practice area                         | `practiceArea`                                                                                                | ≤ 160                                                                                                                                                                                                                                                                                 |
| Current designation                            | `designation`                                                                                                 | ≤ 120                                                                                                                                                                                                                                                                                 |
| Hospital or clinic                             | `hospital`                                                                                                    | ≤ 160                                                                                                                                                                                                                                                                                 |
| City, state, country                           | `city`, `state`, `country`                                                                                    | ≤ 80 each                                                                                                                                                                                                                                                                             |
| Workplace address                              | `workAddress`                                                                                                 | ≤ 240                                                                                                                                                                                                                                                                                 |
| Workplace email                                | `workEmail`                                                                                                   | empty or a valid email address (stored lower-case)                                                                                                                                                                                                                                    |
| Workplace phone                                | `workPhone`                                                                                                   | empty or a valid phone number (stored as `+<digits>`)                                                                                                                                                                                                                                 |
| Other practice locations                       | `practiceLocations[] { hospital*, designation, area, address, city, state, country, phone }`                  | ≤ 5 entries; `phone` empty or a valid phone number, shown to members only with `showWorkContact`                                                                                                                                                                                      |
| Batch year                                     | `batchYear`                                                                                                   | 1940–2100 or `null` — no longer collected by the form                                                                                                                                                                                                                                 |
| Years of experience                            | `yearsOfExperience`                                                                                           | 0–80 or `null` — no longer collected by the form                                                                                                                                                                                                                                      |
| Biography                                      | `bio`                                                                                                         | ≤ 1200                                                                                                                                                                                                                                                                                |
| Qualification letters                          | `qualifications[]`                                                                                            | ≤ 12 entries, ≤ 80 each                                                                                                                                                                                                                                                               |
| Professional interests                         | `interests[]`                                                                                                 | ≤ 15 entries, ≤ 60 each — no longer collected by the form                                                                                                                                                                                                                             |
| Languages                                      | `languages[]`                                                                                                 | ≤ 12 entries, ≤ 40 each                                                                                                                                                                                                                                                               |
| Academic degrees                               | `education[] { degree*, level, institution, fieldOfStudy, startYear, year, certification, details }`          | ≤ 10 entries; `degree` is the degree title; `level` is empty or one of `SUPER_SPECIALITY`, `DOCTORATE`, `POSTGRADUATE`, `DIPLOMA`, `UNDERGRADUATE`, `HIGHER_SECONDARY`, `SECONDARY`, `OTHER`; `year` is the completion year and may not precede `startYear`                           |
| Professional qualifications and certifications | `credentials[] { title*, type, institution, year, registration, details }`                                    | ≤ 15 entries; `type` is empty or one of `DEGREE`, `DIPLOMA`, `BOARD_CERTIFICATION`, `MEMBERSHIP`, `LICENCE`, `OTHER`                                                                                                                                                                  |
| Professional experience                        | `experience[] { role*, organization, employmentType, city, state, startYear, endYear, current, description }` | ≤ 15 entries; end year not before start year; `employmentType` is empty or one of `FULL_TIME`, `PART_TIME`, `VISITING`, `HONORARY`, `PRIVATE_PRACTICE`, `TRAINING`, `ACADEMIC`, `OTHER`                                                                                               |
| Fellowships and postdoctoral certifications    | `fellowships[] { title*, institution, specialty, startYear, endYear, certificate, description }`              | ≤ 10 entries; `certificate` holds the postdoctoral qualification or certification; completion year not before start year                                                                                                                                                              |
| Awards                                         | `achievements[] { title*, issuer, year, description, imageId }`                                               | ≤ 20 entries. `imageId` is `null` or the id of the caller's own unattached upload with purpose `award`; the API stores `{ media, url, thumbUrl }` and returns `imageUrl` / `imageThumbUrl`. A URL can never be supplied. Dropping an award or its image destroys the Cloudinary asset |
| Memberships                                    | `memberships[] { organization*, type, number, startYear, endYear, current }`                                  | ≤ 15 entries; end year not before start year; `number` is private unless `showRegistration`                                                                                                                                                                                           |
| Publications                                   | `publications[] { title*, journal, authors, year, description, url }`                                         | ≤ 30 entries; `url` (a DOI link or publication page) empty or `http(s)://…`                                                                                                                                                                                                           |
| Professional links                             | `links[] { label*, url* }`                                                                                    | ≤ 6 entries; `http(s)://…` only                                                                                                                                                                                                                                                       |

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

`PATCH /api/v1/doctors/me` accepts any subset of `name`, `whatsapp`, `profile`, `visibility`, `dismissProfilePrompt`,
`wizardStep` (0–8) and `submit`. Only the fields present are changed; list fields (`education`, `links`, …) are
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
- `resumeStep` — the step (0-based, 0–8) the wizard reopens on for an unfinished profile. A position saved by the
  former eleven-step wizard is translated to the matching step of the current one.
- `percent` and `missing` — how much of the portfolio is filled in, from nine equally weighted checks: profile photo;
  professional title or designation; specialization; hospital or clinic; city; biography; at
  least one education entry; at least one qualification (letters or a detailed entry); at least one experience
  entry. These drive the completion bar and the "still to add" hints, not the status.

Accounts created before the wizard existed have no completion timestamp, so their owners are invited once to review
and submit; all their saved data is prefilled.

## Visibility preferences

Stored in `user.visibility`; changed by the doctor in the last step (`PATCH /doctors/me`). The two switches for
professional contact details and WhatsApp are also offered next to those fields in step 4 — they are the same settings.

| Preference                                                                                                               | Default     | Effect                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `directory`                                                                                                              | `true`      | Listed in the member directory and searchable. When off, other members who open the profile link see only a name card                                                                                    |
| `portfolio`                                                                                                              | `true`      | The full portfolio is open to members. When off, the doctor can stay in the directory while other members who open the profile see only a name card                                                      |
| `publicListing`                                                                                                          | `false`     | **Consent** to appear as a small card on the public homepage                                                                                                                                             |
| `showEmail`                                                                                                              | `false`     | Account email visible to signed-in members on the portfolio                                                                                                                                              |
| `showPhone`                                                                                                              | `false`     | Account phone visible to signed-in members on the portfolio                                                                                                                                              |
| `showWorkContact`                                                                                                        | `true`      | Workplace email and phone (if entered) visible to signed-in members on the portfolio                                                                                                                     |
| `showWhatsapp`                                                                                                           | `true`      | The WhatsApp number (if entered) visible to signed-in members                                                                                                                                            |
| `showRegistration`                                                                                                       | `false`     | Registration details of qualifications **and membership numbers** visible to signed-in members                                                                                                           |
| `showBloodGroup`                                                                                                         | `false`     | Blood group visible to signed-in members on the portfolio. No other setting reveals it                                                                                                                   |
| `sections.{education, qualifications, experience, fellowships, achievements, memberships, publications, gallery, links}` | `true` each | Whether that portfolio section is shown to other members. `gallery` governs the items kept for the portfolio only; memories shared with the community stay in the Memories section, and blogs are public |

These settings are enforced in the API, not in the browser: for another member, `memberProfileBody()` empties the
hidden sections, blanks `registration`, membership `number` and `bloodGroup`, removes the phone numbers of extra
practice locations, and leaves workplace contact and WhatsApp out of `contact` before the response is sent,
so hidden data never reaches their device. The doctor and administrators always receive the full profile; on their
own portfolio the doctor sees "Hidden from other members" and "Only you can see this" markers instead.

An administrator can additionally:

- set `directory` to `false` for a doctor (hide from the directory), and
- set the `featured` flag (`PATCH /admin/doctors/:id/visibility`).

A doctor appears on the public homepage only when **both** `visibility.publicListing` (the doctor's consent) and
`featured` (the admin's decision) are true, and the account is active and directory-visible. A doctor cannot set
`featured` themselves.

## What each audience sees

| Audience                                                              | Endpoint                                       | Fields                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signed-out visitor                                                    | `GET /doctors/featured`                        | `id, name, photoUrl, professionalTitle, specialization, city` — opted-in **and** featured doctors only, at most 8. No contact details, hospital or biography                                                                              |
| Member, directory card                                                | `GET /doctors`                                 | `id, name, photoUrl, professionalTitle, specialization, designation, hospital, city, state, yearsOfExperience, batchYear`. Never email or phone                                                                                           |
| Member, portfolio                                                     | `GET /doctors/:id`                             | `profile` with the doctor's visibility choices applied and its repeated sections in display order, `summary`, `memberSince`, and in `contact`: `email` / `phone` / `workEmail` + `workPhone` / `whatsapp` only if the doctor enabled each |
| Member, doctor hidden from the directory or with the portfolio closed | `GET /doctors/:id`                             | `limited: true` with `name`, photo, professional title and specialization only                                                                                                                                                            |
| The doctor themself                                                   | `GET /doctors/me`, `GET /doctors/:id`          | Everything, including own contact details, visibility settings and completion                                                                                                                                                             |
| Administrator                                                         | `GET /admin/doctors`, `GET /admin/doctors/:id` | Everything plus status, suspension details, `featured`, last login and content counts                                                                                                                                                     |

Suspended doctors are removed from the directory and their portfolio returns `404` to other members. The
administrator account is never listed in the directory.

## Portfolio page

`/doctors/[id]` is built entirely from the saved profile — there is no per-doctor page. Sections and cards without
data are not rendered, and no rating, verification badge, fee or other figure is invented.

Code: `frontend/src/components/doctors/DoctorPortfolio.jsx` (data and sections) with
`frontend/src/components/doctors/portfolio/` — `PortfolioHero.jsx`, `HeroParticles.jsx`, `PortfolioNav.jsx` (the
section bar) and `parts.jsx` (the section, panel, info-box and timeline building blocks).

The page is read by members only — doctors looking at a colleague — so it is written as a professional record, not
as a page for patients: the hero has no call, WhatsApp, email or booking buttons, the contact details the doctor
shares sit in their own section after the affiliations, and there is no "Message" button because the web app has no
chat screen. The medical college shown in the hero and the career overview is the institution of the saved MBBS (or
BDS / BAMS / BHMS) degree; the batch is `batchYear`. Neither is guessed when it is not saved.

The hero is clean and light: the page's own background (white in the light theme, the dark ground in the dark theme)
under two faint blue washes, with soft blue shapes and blue particles drifting behind the content and the name in
blue. Below it are sections of bordered, rounded cards. Headings use the body typeface at its heaviest weight; the
page is drawn with the site's colour tokens, so the dark theme works without extra rules. No global style was changed
for it.

- **Profile navigation** — back to the directory, the doctor's name, a link to each section that exists, and a
  "Contact" button (it scrolls to the contact section) when the doctor shares contact details or links. The section
  being read is marked. It is a dark pill pinned under the site header whose links scroll sideways (`PortfolioNav`).
- **Hero** — specialization and subspecialization, the name as the page heading (an honorific such as "Dr" is set
  apart in the text colour), professional title and designation, the headline as a quotation, the opening of the
  biography, and up to four facts: the highest qualification, the medical college and batch (when saved), the current
  affiliation (the main hospital or clinic, otherwise the organisation of a position marked current) and the location.
  The photograph — or the initials — sits in a square frame with rounded corners, a hairline blue border and a blue
  glow, on the right, below the text on small screens. With a mouse it leans and turns towards the pointer while the
  pointer is over the hero. The buttons are "View career" (it scrolls to the experience timeline) and, for the owner,
  "Edit profile"; there are no contact buttons here.
- **Summary bar** — one card overlapping the foot of the hero with up to three facts, each only when the data exists:
  specialization, current affiliation (the main hospital or clinic, otherwise the organisation of a position marked
  current) and qualifications.
- **Sections**, in this order. Each fades in as it scrolls into view (not with reduced motion):

1. About — the biography, languages, (when shared) blood group, and a compact career overview: current role, medical
   college and batch, and professional interests. Left out when none of them is saved
2. Education and qualifications — the qualification letters, a timeline of academic degrees (highest level first)
   and one box per detailed qualification or certification. On wide screens it stands beside the experience timeline
3. Professional experience — a timeline with current positions first, then the most recently held; an ongoing
   position shows "Present" and a "Current" badge
4. Expertise and procedures — one ruled sheet of up to three bands, each with its title on the left: scope of
   practice (field of work and clinical practice area), areas of expertise as a ruled list with a count, and
   procedures performed as a numbered ruled list with a count
5. Fellowships and postdoctoral qualifications — one card each, most recent completion first
6. Awards and memberships — two separate panels
7. Publications — cards, most recent first, each with a safe external link when one was entered
8. Current professional affiliations — one card per hospital, clinic or organisation: the main one (when a hospital,
   practice area or workplace address is saved) and each other saved location, with designation, practice area,
   address and the contact details the doctor allows. A city on its own is not shown as an affiliation
9. Contact — the contact details the doctor shares (account email and phone, WhatsApp, and the workplace contact
   when there is no main affiliation card to carry it) and the professional links
10. Gallery — the doctor's own gallery photos (`GET /memories?owner=`, never the community memories) as a grid of
    equal tiles; a tile opens the item in the lightbox used on the Memories page
11. Blogs — the doctor's community blogs (`GET /blogs?author=`) as cards linking to `/blogs/[slug]`

The platform stores no opening hours, consultation fees, ratings or appointment slots, so none are shown, and there is
no booking action. Affiliations carry no map link or embedded map.

The browser tab is titled "name · specialization" once the profile has loaded. It is set in the browser from what the
signed-in member was allowed to load; the server-rendered HTML and its metadata carry no profile data.

Animation: the hero's text and photograph use the site's CSS `rise-in` entrance. Sixteen small glowing blue particles
(nine on small screens) sit behind the hero's content: Framer Motion fades each one in, GSAP lets it drift and dim
slowly and — with a mouse on a large screen — shifts the two particle layers slightly with the pointer. The layer
ignores the pointer, is hidden from assistive technology and pauses while the hero is off screen. GSAP also drifts
the blue backdrop shapes, makes the glow behind the photograph breathe and — on devices with a mouse — moves and
tilts the photograph towards the pointer (up to 18 px and 9°), enlarging it slightly while the pointer is on it and
returning it to rest when the pointer leaves the hero. Framer Motion (`Reveal`) fades each section in once. Every GSAP animation is created in a context that is reverted when the component unmounts, and
with `prefers-reduced-motion` nothing moves.

### Display order

The profile is stored, and edited in the wizard, in the order the doctor entered it. For the portfolio the API
(`orderProfile` in `services/profileOrder.js`, applied by `serializeDoctorProfile`) returns copies in display order;
ties always keep the saved order, and undated entries go last. Nothing stored is rewritten.

| Section                                       | Order                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `education`                                   | By level — super-speciality and doctorate, postgraduate, diploma, other, undergraduate, higher secondary (+2 / 12th), secondary (10th) — then by completion year, latest first. When `level` is empty the level is read from a well-known degree title (MBBS, MD, MS, DNB, DM, MCh, PhD, "+2", "10th" …); an unrecognised title ranks as "other" |
| `experience`                                  | Positions marked current first, then by end year (start year when there is none), latest first                                                                                                                                                                                                                                                   |
| `fellowships`                                 | By completion year (start year when there is none), latest first                                                                                                                                                                                                                                                                                 |
| `achievements`, `credentials`, `publications` | By year, latest first                                                                                                                                                                                                                                                                                                                            |
| `memberships`                                 | Current memberships first, then by end or start year, latest first                                                                                                                                                                                                                                                                               |

`summary.experience` is `{ years, since }`: the years covered by positions that have a start year and either an end
year or the current flag. Overlapping positions are counted once and gaps are left out; with no such position both
values are `null` and the card is not shown. It is computed from what the viewer may see, so hiding the experience
section hides the figure as well.

On their own portfolio a doctor also sees "Hidden from other members" on sections they switched off, "Only you can
see this" on private details (blood group, registration and membership numbers), and "Edit profile", "Add photos"
and "Write a blog" buttons.

On the web the directory and portfolio pages are client-rendered behind the member gate, are marked `noindex`, and
are disallowed in `robots.txt` — and, independently of that, the API refuses unauthenticated requests. The wizard
lives under `/dashboard`, which is `noindex` and requires a session.

## Directory search and filters

`GET /api/v1/doctors?q=&specialization=&city=&page=&limit=`

- `q` — case-insensitive match anywhere in the name (input is escaped and limited to 60 characters).
- `specialization`, `city` — exact, case-insensitive match (collation strength 2). The available values come from
  `GET /doctors/filters`, which returns the distinct values present among listed doctors. The wizard's specialization
  options come from `GET /doctors/specialties` (see below) and its city suggestions from the filters, which keeps
  spellings consistent while still accepting anything a doctor types.
- Sorted by name; `limit` defaults to 12 (maximum 48).
- Only active doctors with `visibility.directory: true` are returned.

## Specialization catalogue

`GET /api/v1/doctors/specialties?q=` (members only) returns
`{ specializations: [{ name, aliases[], subspecializations[], custom }] }`, sorted by name:

- the predefined entries of `backend/src/config/specialties.js` (`custom: false`) — fifty specializations, each with
  its subspecializations and alternative names. That file is the only place the options are defined: edit it to
  add, rename or regroup an option. Stored profiles keep whatever text they hold;
- plus what listed, active doctors have saved: a typed specialization becomes its own entry (`custom: true`), and a
  typed subspecialization is added under the specialization it was saved with — also when that specialization was
  entered through an alias. Doctors who are not listed in the directory do not feed the suggestions.

`q` (≤ 60 characters) keeps the entries whose name, an alias or a subspecialization contains the text, ignoring
capitals.

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
- City is free text, so spelling variants ("Bhubaneswar" / "Bhubaneshwar") can still appear as separate filter
  values. A typed specialization is stored as typed (in display form): an alias such as "Orthopedics" finds the
  options of _Orthopaedics_ but remains a separate value in the directory filter.
- Display formatting cannot know every abbreviation. An unknown one typed in lower case becomes an ordinary word
  ("tmj" → "Tmj"); typed in capitals within a mixed-case entry it is kept. Add recurring ones to `MEDICAL_ACRONYMS`.
- A typed specialization or subspecialization is offered to other doctors as soon as its author is listed in the
  directory; there is no review of typed values.
- Publications carry a year, not a full date, so two publications of the same year keep the order of entry.
- `designation` is one field: the "Designation" input in step 4 and "Current designation" in step 1 edit the same
  value. Each additional practice location has its own designation.
- The blood group has no verification and must not be relied on for any medical purpose.
- Admin "featured" selection is manual; there is no ordering control beyond most recently updated first.
- Credentials and registration details are self-declared: the platform does not verify them.
- Because profile photos are public-delivery assets, anyone who obtains a photo's URL can open it.
- The wizard does not intercept the browser's Back button: unsaved changes on the current step are lost if the
  doctor leaves that way (everything saved by an earlier "Next" or "Save progress" is kept).
- The admin doctor detail view lists the original profile sections; expertise, procedures, practice locations,
  fellowships, memberships, detailed qualifications, headline and blood group are visible to administrators on the
  doctor's portfolio page.
- Award images, like profile photos, are public-delivery Cloudinary assets: anyone who obtains the URL can open it.
- Gallery items and blogs are saved by their own modules, so they are not covered by the wizard's "unsaved changes"
  warning or its final submission — each is complete as soon as its own form is saved.
