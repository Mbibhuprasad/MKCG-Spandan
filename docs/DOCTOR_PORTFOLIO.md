# Doctor profile and professional portfolio

Every doctor has a profile that doubles as a small professional portfolio. It is stored on the shared `User` model
(`backend/src/models/User.js`); there is no separate "Doctor" collection.

Code: `backend/src/controllers/doctor.controller.js`, `backend/src/validators/doctor.validators.js`,
`backend/src/services/serializers.js` (`profileBody`, `profileCompletion`, `serializeDoctor*`).

Pages: `/dashboard/profile` (edit own profile), `/doctors` (member directory), `/doctors/[id]` (portfolio).

## Profile fields

All profile fields are optional — a doctor can register with only name, email, phone and password, use the community
immediately, and complete the profile gradually.

| Field | API name (`profile.…`) | Limit |
| --- | --- | --- |
| Profile photo | set via `PUT /doctors/me/photo` | JPG / PNG / WebP up to `MAX_IMAGE_MB` |
| Full name | top-level `name` | 2–80 characters |
| Professional title | `professionalTitle` | ≤ 120 |
| Specialization | `specialization` | ≤ 80 |
| Subspecialty | `subspecialty` | ≤ 80 |
| Professional designation | `designation` | ≤ 120 |
| Hospital or clinic | `hospital` | ≤ 160 |
| City, state | `city`, `state` | ≤ 80 each |
| Batch year | `batchYear` | 1940–2100 or `null` |
| Years of experience | `yearsOfExperience` | 0–80 or `null` |
| Short biography | `bio` | ≤ 1200 |
| Qualifications | `qualifications[]` | ≤ 12 entries, ≤ 80 each |
| Professional interests | `interests[]` | ≤ 15 entries, ≤ 60 each |
| Languages | `languages[]` | ≤ 12 entries, ≤ 40 each |
| Medical education | `education[] { degree*, institution, year }` | ≤ 10 entries |
| Professional experience | `experience[] { role*, organization, city, startYear, endYear, current, description }` | ≤ 15 entries; end year not before start year |
| Achievements | `achievements[] { title*, year, description }` | ≤ 20 entries |
| Publications | `publications[] { title*, journal, year, url }` | ≤ 30 entries; `url` empty or `http(s)://…` |
| Professional links | `links[] { label*, url* }` | ≤ 6 entries; `http(s)://…` only |

\* required within an entry.

Not collected: date of birth, home address, identity or registration numbers, and — by policy — any patient
information.

`specialization` and `city` may also be given at registration. Email and phone are account fields: they are set at
registration and cannot be changed through the profile endpoint.

### Updating

`PATCH /api/v1/doctors/me` accepts any subset of `name`, `profile`, `visibility` and `dismissProfilePrompt`. Only the
fields present are changed; list fields (`education`, `links`, …) are replaced as a whole when sent. Unknown keys —
including `role`, `status`, `email`, `phone` and `featured` — are discarded.

## Profile completion

Computed on every read by `profileCompletion()`; nothing is stored.

Ten equally weighted checks:

1. Profile photo
2. Professional title **or** designation
3. Specialization
4. Hospital or clinic
5. City
6. Years of experience
7. Short biography
8. At least one education entry
9. At least one qualification
10. At least one experience entry

Result: `{ percent, isComplete, missing[] }` where `percent = completed / 10 × 100` and `isComplete` is true from
**70 %**. `missing` lists the labels still open and drives the checklist on the dashboard.

An incomplete profile never blocks access. The dashboard shows "Complete Your Doctor Profile" until the profile is
complete or the doctor dismisses the prompt (`dismissProfilePrompt: true` → `profilePromptDismissed`).

## Visibility preferences

Stored in `user.visibility`; changed by the doctor through `PATCH /doctors/me`.

| Preference | Default | Effect |
| --- | --- | --- |
| `directory` | `true` | Listed in the member directory and searchable. When off, other members who open the profile link see only a name card |
| `publicListing` | `false` | **Consent** to appear as a small card on the public homepage |
| `showEmail` | `false` | Email visible to signed-in members on the portfolio |
| `showPhone` | `false` | Phone visible to signed-in members on the portfolio |

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
| Member, portfolio | `GET /doctors/:id` | Full `profile`, `memberSince`, and `contact.email` / `contact.phone` only if the doctor enabled each |
| Member, doctor hidden from the directory | `GET /doctors/:id` | `limited: true` with `name`, photo, professional title and specialization only |
| The doctor themself | `GET /doctors/me`, `GET /doctors/:id` | Everything, including own contact details, visibility settings and completion |
| Administrator | `GET /admin/doctors`, `GET /admin/doctors/:id` | Everything plus status, suspension details, `featured`, last login and content counts |

Suspended doctors are removed from the directory and their portfolio returns `404` to other members. The
administrator account is never listed in the directory.

The portfolio page shows only sections that have content; empty sections are hidden. On the web the directory and
portfolio pages are client-rendered behind the member gate, are marked `noindex`, and are disallowed in `robots.txt`
— and, independently of that, the API refuses unauthenticated requests.

## Directory search and filters

`GET /api/v1/doctors?q=&specialization=&city=&page=&limit=`

- `q` — case-insensitive match anywhere in the name (input is escaped and limited to 60 characters).
- `specialization`, `city` — exact, case-insensitive match (collation strength 2). The available values come from
  `GET /doctors/filters`, which returns the distinct values present among listed doctors.
- Sorted by name; `limit` defaults to 12 (maximum 48).
- Only active doctors with `visibility.directory: true` are returned.

## Profile photo

1. The browser uploads the image to `POST /api/v1/media` with `purpose=profile` (see [CLOUDINARY.md](CLOUDINARY.md)).
2. `PUT /api/v1/doctors/me/photo { mediaId }` claims that upload — it must belong to the caller, have the `profile`
   purpose and be unattached — and stores `{ media, url, thumbUrl }` on the profile.
3. The previous photo, if any, is deleted from Cloudinary.
4. `DELETE /api/v1/doctors/me/photo` removes the photo and its asset.

Profile photos use Cloudinary's public (`upload`) delivery type because cards may appear on the public homepage
(with consent). `url` is a size-limited display image; `thumbUrl` is a 320 px face-aware square used on cards and
author lines. Without a photo the interface shows the doctor's initials.

## Remaining limitations

- Email and phone cannot be changed after registration.
- Specialization and city are free text, so spelling variants ("Bhubaneswar" / "Bhubaneshwar") appear as separate
  filter values.
- Admin "featured" selection is manual; there is no ordering control beyond most recently updated first.
- Credentials are self-declared: the platform does not verify medical registration or qualifications.
- Because profile photos are public-delivery assets, anyone who obtains a photo's URL can open it.
