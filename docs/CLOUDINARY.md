# Cloudinary and the upload architecture

All images and videos are stored in Cloudinary. MongoDB stores only metadata (`Media` documents), and the API server
never writes an uploaded file to disk.

Code: `backend/src/config/cloudinary.js`, `backend/src/services/cloudinary.service.js`,
`backend/src/services/media.service.js`, `backend/src/middleware/upload.js`, `backend/src/utils/fileSignature.js`,
`backend/src/controllers/media.controller.js`, `frontend/src/components/content/MediaUploader.jsx`.

## Configuration

Set in `backend/.env` (never in the frontend):

```dotenv
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_FOLDER=mkcgspandan
MAX_IMAGE_MB=8
MAX_VIDEO_MB=60
```

- The SDK is configured lazily, with `secure: true`, the first time it is needed.
- In development the API starts without credentials and uploads return `503 MEDIA_NOT_CONFIGURED`. In production the
  credentials are mandatory.
- The API secret is used only on the server (to upload, delete and sign URLs). It is never sent to a client, and the
  application does not use unsigned upload presets.

## Upload flow

```
Browser / app                API                                   Cloudinary        MongoDB
     │  POST /api/v1/media     │                                        │                │
     │  multipart: purpose,file│                                        │                │
     ├────────────────────────▶│ 1 requireAuth + upload rate limit      │                │
     │                         │ 2 Multer memory storage (1 file)       │                │
     │                         │ 3 magic-byte detection                 │                │
     │                         │ 4 purpose rules + size limit           │                │
     │                         │ 5 upload_stream ──────────────────────▶│                │
     │                         │ 6 Media.create ────────────────────────┼───────────────▶│
     │◀────────────────────────┤ 201 { id, resourceType, url, thumbUrl }│                │
     │  POST /api/v1/posts { mediaIds:[id] }                            │                │
     ├────────────────────────▶│ 7 claimMedia (owner + purpose + free)  │                │
```

1. **Authentication** — only signed-in, active users can upload; 40 uploads per user per 10 minutes by default.
2. **Temporary handling** — Multer with `memoryStorage()` holds the single file in RAM for the duration of the
   request. Multer limits: one file, at most `max(MAX_IMAGE_MB, MAX_VIDEO_MB)`, five small text fields.
3. **Real content check** — `detectFileType()` reads the leading bytes. The filename, extension and client-declared
   MIME type are ignored.

   | Kind | Accepted formats | Signature checked |
   | --- | --- | --- |
   | Image | JPG, PNG, WebP | `FF D8 FF`; PNG 8-byte header; `RIFF….WEBP` |
   | Video | MP4, MOV, WebM | ISO `ftyp` box with a known MP4 brand or `qt  `; EBML header containing `webm` |

   Anything else — including GIF, HEIC/AVIF, SVG, PDF and executables renamed to `.png` — is rejected with
   `400 UNSUPPORTED_MEDIA_TYPE`.
4. **Purpose rules and size** — the `purpose` field decides which kinds are allowed and how the asset is delivered
   (table below). Files over the limit for their kind return `413 FILE_TOO_LARGE`.
5. **Upload** — the buffer is streamed to Cloudinary with `upload_stream`, using a server-chosen folder, a random
   public id (`unique_filename`, the original filename is never used), `overwrite: false`, and `allowed_formats` so
   Cloudinary re-validates the content. A Cloudinary failure returns `502 UPLOAD_FAILED` and **no** database record is
   created.
6. **Metadata** — a `Media` document records owner, purpose, `publicId`, resource type, delivery type, format, bytes,
   dimensions and duration. If this write fails, the Cloudinary asset is destroyed again, so a failed upload never
   leaves an inconsistent record.
7. **Attachment** — the upload is "unattached" until a later request refers to it by id (`mediaIds` for posts and
   memories, `coverId` for blogs and events, `mediaId` for the profile photo). `claimMedia()` atomically attaches it
   only if it **belongs to the caller**, was uploaded **for that purpose**, and is **not attached to anything else**.
   Otherwise the request fails with `400 MEDIA_INVALID`. Clients can never supply a URL or a Cloudinary public id.

On the web, `MediaUploader` performs the same type and size checks first for quick feedback, shows progress, and
keeps the returned media objects until the form is submitted.

## Purposes and delivery types

Defined in `MEDIA_PURPOSES` (`backend/src/config/constants.js`).

| Purpose | Allowed | Max per item | Cloudinary type | Why |
| --- | --- | --- | --- | --- |
| `profile` | Image | 1 | `upload` (public) | Cards can appear on the public homepage with the doctor's consent |
| `blog` | Image | 1 cover | `upload` (public) | Blogs are public |
| `award` | Image | 1 per award | `upload` (public) | Award photos and certificates on the portfolio; attached by `PATCH /doctors/me` (`achievements[].imageId`) and destroyed when the award or its image is removed |
| `post` | Image | 4 | `authenticated` | The feed is members-only |
| `event` | Image | 1 cover | `authenticated` | Event details are members-only |
| `memory` | Image, video | 12 | `authenticated` | Memories are members-only |

## Folder convention

```
<CLOUDINARY_FOLDER>/<profiles | blogs | posts | events | memories>/<userId>/<random public id>
```

Use a different `CLOUDINARY_FOLDER` per environment so development, staging and production never mix.

## Delivery

The API builds every URL; clients just use the `url` and `thumbUrl` fields of a media object.

| Use | Transformation | Notes |
| --- | --- | --- |
| Image display (`url`) | `c_limit,w_1600,h_1600,q_auto,f_auto` | Never upscaled; modern formats chosen automatically |
| Image thumbnail (`thumbUrl`) | `c_fill,g_auto,w_600,h_600,q_auto,f_auto` | Gallery tiles and previews |
| Avatar (profile `thumbUrl`) | `c_fill,g_face,w_320,h_320,q_auto,f_auto` | |
| Video playback (`url`) | `q_auto`, delivered as `.mp4` | |
| Video poster (`thumbUrl`) | `c_fill,w_600,h_600,so_0`, delivered as `.jpg` | First frame |

### Signed delivery URLs (private assets)

For `authenticated` assets, URLs are generated with `sign_url: true`: Cloudinary refuses to serve them without a
signature derived from the API secret, so they cannot be guessed or constructed. The API returns these URLs only
inside responses the caller is authorised to receive — for example, a portfolio-only memory's media appears only in
responses to its owner and to admins, and nothing is returned to signed-out visitors.

### Short-lived download URLs (original files)

`GET /api/v1/memories/:id/media/:mediaId/download` checks that the caller is a signed-in member who may see that
memory and that the file belongs to it, then returns a Cloudinary **private download URL** that expires after
**5 minutes** and is served as an attachment. The link is generated per request and never stored.

### Eager video transformations

Transcoding a large video on first view can fail or be slow. At upload time the API therefore requests the two video
derivatives it will later deliver (`q_auto` MP4 and the poster JPG) as **eager, asynchronous** transformations. For a
short period right after upload the derived video may not be ready yet.

## Deleting assets

| Situation | Behaviour |
| --- | --- |
| Content is deleted (by owner or admin) | Its assets are destroyed in Cloudinary (`invalidate: true`) and their `Media` documents removed |
| Media removed while editing a post or memory, or a cover/photo replaced | The dropped assets are destroyed after the item is saved |
| A doctor is deleted | Every asset they own is destroyed |
| The uploader discards an unused upload | `DELETE /api/v1/media/:id` (refused with `409` once the file is attached) |
| A form is abandoned after uploading | **Orphan cleanup**: uploads still unattached after 24 hours are destroyed by the background job (every 6 hours) or by `npm run media:cleanup` |

If Cloudinary is unreachable during a delete, the failure is logged and the `Media` document is still removed; the
asset may then remain in Cloudinary until removed manually.

## Recommended Cloudinary account settings

- **Enable strict transformations** so arbitrary, unsigned transformation URLs are not served.
- Keep signature enforcement for `authenticated` assets (default).
- Disable or restrict unsigned uploading.
- Consider enabling backups of originals.
- Check your plan's maximum video size and transformation quota against `MAX_VIDEO_MB` and expected usage.

## Limits at a glance

| Limit | Default | Where |
| --- | --- | --- |
| Image size | 8 MB | `MAX_IMAGE_MB` |
| Video size | 60 MB | `MAX_VIDEO_MB` |
| Images per post | 4 | `LIMITS.postMedia` |
| Files per memory | 12 | `LIMITS.memoryMedia` |
| Uploads per user | 40 / 10 min | `RATE_LIMIT_UPLOAD_MAX` |
| Download link lifetime | 5 minutes | `memory.controller.js` |
| Orphan grace period | 24 hours | `media.service.js` |

The browser-side hints in `frontend/src/lib/constants.js` (`UPLOAD_LIMITS`) should be kept equal to the server values.

## Known limitations

- **Verified against a test double only.** The automated tests replace the Cloudinary SDK with
  `backend/__mocks__/cloudinary.js`. Unless you have run the application with real credentials, the live behaviour —
  signed delivery of transformed `authenticated` assets, eager video derivatives, private download URLs — has not been
  confirmed. Follow the upload items of the manual checklist in [TESTING.md](TESTING.md) before relying on it.
- **Signed delivery URLs do not expire.** Time-limited delivery requires Cloudinary's token-based authentication,
  which is not available on every plan. A member who copies a signed image or video URL can share it, and it keeps
  working until the asset is deleted. Only original-file download links are time-limited.
- **Profile photos and blog covers are public assets**: anyone with the URL can open them.
- **Files are buffered in memory** on the API server (up to `MAX_VIDEO_MB` per upload). Very large or many
  simultaneous videos need more RAM; a direct signed-upload flow from the browser to Cloudinary would avoid this and
  is a sensible future improvement.
- **EXIF metadata is not stripped from originals.** Photos may contain GPS coordinates and device details, which
  remain in the stored original (and therefore in downloads). Delivered, transformed images normally have metadata
  removed by Cloudinary.
- **Uploads pass through the Next.js proxy by default**, so hosting limits on request size and duration apply (see
  [DEPLOYMENT.md](DEPLOYMENT.md)).
- **No virus/malware scanning or automated image moderation.** Content is published without prior review; administrators act on reports.
- **Posts accept images only**; videos are supported for memories only. GIF, HEIC and AVIF are not accepted.
- **Cleanup is best-effort**: a failed Cloudinary delete is logged, not retried.
