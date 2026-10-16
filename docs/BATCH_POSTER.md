# Batch Profile Poster Maker

Doctors design a personal poster for their batchmates from their profile and a personal message, then download it as
PNG or PDF or share it. Posters are private: only their owner can read, change, export or delete them.

## Where it lives

| Part | Files |
| --- | --- |
| Pages | `frontend/src/app/dashboard/posters/` — `/dashboard/posters` (My posters + template gallery), `/new` (`?template=<id>` preselects a template), `/[id]` (editor) |
| Entry points | "Create My Batch Poster" card on `/dashboard/profile`, the dashboard nav ("Batch poster", doctors only) and `/dashboard/create` |
| Editor | `components/posters/PosterEditor.jsx` (6 steps in `steps.jsx`, autosave, live preview) |
| Templates | `components/posters/templates/*.jsx` (+ `*.module.css`, shared base styles in `poster.module.css`) |
| Export | `export.js` (HTML → canvas → PNG / single-page PDF), `usePosterExport.jsx`, `usePosterShare.jsx` |
| API | `backend/src/routes/poster.routes.js`, `controllers/poster.controller.js`, `services/poster.service.js`, `validators/poster.validators.js`, `models/Poster.js` |
| App renderer | `app/poster-renderer/page.js` + `components/posters/PosterRenderer.jsx` — draws posters for the Android app (see below) |
| Android app | Profile → Settings → **Create My Batch Poster**: `mobile/app/(app)/settings/posters/` (dashboard, `[id]` editor, `view/[id]` preview & export), `mobile/features/posters/` |
| Tests | `backend/tests/posters.test.js`; app: `mobile/tests/integration/tests.mjs` (poster API flow + model drift guard) |

## API (all require a signed-in doctor; other roles get 403)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/posters` | The caller's posters (summaries, newest first, max 20) |
| POST | `/api/v1/posters` | Create (a draft may be incomplete) |
| GET | `/api/v1/posters/:id` | Read one |
| PATCH | `/api/v1/posters/:id` | Partial update; `status: 'READY'` only when display name, batch year and college are set |
| DELETE | `/api/v1/posters/:id` | Delete the poster and its uploaded photos |
| POST | `/api/v1/posters/:id/export` | `{ format: 'png' \| 'pdf' }` — authorises a download of a READY poster, records it, returns the saved poster |

Every query is `{ _id, owner: req.user._id }`; someone else's poster answers 404, so ids cannot be probed. Photos are
`purpose: 'poster'` uploads (`POST /api/v1/media`) stored in Cloudinary with **authenticated** delivery and referenced
by id; only the owner ever receives their signed URLs. Saves have their own rate limit (`RATE_LIMIT_POSTER_SAVE_MAX`,
autosave) and downloads another (`RATE_LIMIT_POSTER_EXPORT_MAX`).

Poster content is a copy: editing it never changes the doctor's profile. Contact details are printed only when their
own `include` switch is on; nothing is copied from the account unless the doctor asks ("Fill values from my
account"), and the switches always start off.

## Templates

All six are original HTML/CSS layouts on a fixed 1240 × 1754 px canvas (A4 proportions), each with three colour variations.

| Id | Name | Layout | Portrait placement |
| --- | --- | --- | --- |
| `classic-tribute` | Classic Personal Tribute | Watercolour wash, double gold frame, corner flourishes; round gold portrait beside the name; two-column messages with quote card; polaroid strip | Left / Centre / Right |
| `silver-jubilee` | Silver Jubilee / Batch Celebration | Dark gradient with sparkles and a college façade; laurel badge with the entered years; identity card; photo column; contact strip | Left / Centre / Right |
| `modern-professional` | Modern Professional Doctor | Editorial: dark credentials column (full-bleed portrait, batch, qualifications, personal facts, contacts) beside a white page (name, specialization, biography, achievements, quote, messages) | Left / Right (column side) |
| `college-memories` | Nostalgic College Memories | Ivory paper, batch "postmark", taped polaroid portrait, the doctor's story as a timeline (only the real batch and event years are printed), lined note card, photo collage | Left / Right |
| `friends-forever` | Friends Forever / Inspirational Message | Colour bands with an arched portrait, large script greeting, full-width quotation band, framed photos, contact strip | Left / Centre / Right |
| `medical-blue` | Medical Blue Professional | Clean white and clinical blue: light header with a framed portrait, specialization pill and role; full-width batch strip; profile column (anniversary badge, qualifications, personal facts, contacts) beside the doctor's own words; photo row | Left / Centre / Right |

Rules shared by all templates (`templates/shared.jsx → derive`):

- only the doctor's own entered values are printed; empty fields and switched-off sections are simply absent;
- the anniversary number and event year are never computed — only what the doctor typed (presets fill the title and
  years only when clicked);
- every variable-length region has `data-fit`; `fit.js` lowers its font scale (down to `data-fit-min`, usually 0.6)
  until nothing overflows. If the text still does not fit, the editor names the region and disables download — a
  poster is never exported with clipped text.

Switching template keeps every value. The colour falls back to the new template's default if the old colour does not
exist there; a placement the template does not offer is drawn as Left (the stored value is kept).

To add a template: add it to `POSTER_TEMPLATES` (backend `config/constants.js`) and `TEMPLATES`
(`components/posters/model.js`) with the same palette ids, write the component, and register it in `PosterCanvas.jsx`.
Then copy `model.js` to `mobile/features/posters/model.js` (verbatim section), add a thumbnail in `mobile/assets/posters/`
and to `mobile/features/posters/thumbnails.js`, and deploy the website before shipping the app.

## Export

Exports run in the doctor's browser from the **saved** poster (unsaved edits are saved first):

1. `POST /posters/:id/export` checks ownership and READY status.
2. Photos are fetched (Cloudinary sends `Access-Control-Allow-Origin: *`; the CSP allows `https://res.cloudinary.com`
   in `connect-src`) and inlined as data URLs; a missing photo is reported, not left blank.
3. The poster is rendered off-screen at full size with the same component as the preview, fonts are loaded, the
   fit check runs again, and `html-to-image` paints it at 2× → **2480 × 3508 px** (A4 at 300 dpi).
4. PNG: the canvas as PNG. PDF: a hand-written single-page PDF 1.4 (595.28 × 842 pt) holding the canvas as a JPEG.
5. Share: the PNG is handed to the Web Share API where the browser supports sharing files (the button is hidden
   otherwise); if the browser needs a fresh tap, a "Share now" dialog appears.

Nothing is uploaded or stored; no server binaries (Chromium, canvas) are needed, so the website stays deployable on
Vercel as a normal Next.js app.

## Android app

The app uses the same API, records and template ids, so a poster started on one continues on the other. Posters are
**drawn by the website's own templates**: the app opens `/poster-renderer` in a WebView (`react-native-webview`,
`mobile/features/posters/PosterRenderer.js`) and sends it the poster it loaded with the doctor's bearer token. The page
renders the preview with `PosterPreview` / `fit.js` and, for a download, runs the export steps above (fonts, inlined
photos, fit check, 2480 × 3508 canvas, PNG or PDF) and streams the file back as base64 pieces, which the app appends to
a file in its cache. The page never calls the API and stores nothing. Every file is drawn from the saved poster returned
by `POST /posters/:id/export` (ownership + READY), exactly like the website.

- Saving: the doctor picks a folder in Android's file picker (no media permission); sharing uses the native share
  sheet (`expo-sharing`).
- The editor mirrors the website's: six steps, prefill from `/doctors/me`, autosave (POST once, then PATCH, queued),
  "Save finished poster" → READY, an unsaved-changes prompt on leaving.
- `mobile/features/posters/model.js` is a verbatim copy of `components/posters/model.js` plus a few editor helpers;
  `npm run test:api` fails when the two differ — copy the file again after changing the website model.
- Gallery thumbnails (`mobile/assets/posters/*.jpg`) are the website templates drawn with `sampleForm`'s placeholder
  text; regenerate them when a template's look changes.
- The renderer address is the app's `WEB_URL` (`EXPO_PUBLIC_WEB_URL` overrides it) + `/poster-renderer`. The website must
  be deployed with that page before the app's preview and downloads work; until then the app reports that the poster
  designer is unavailable. A renderer that does not know one of the app's template ids is refused (bridge version check).
