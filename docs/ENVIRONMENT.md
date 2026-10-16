# Environment configuration

Configuration is supplied through environment variables. Example files with **placeholder** values are committed;
real values go into local files that are git-ignored (`.gitignore` excludes `.env`, `.env.local` and `.env.*.local`).

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env.local
```

Never commit real credentials, and never put a secret in a variable whose name starts with `NEXT_PUBLIC_` — those are
embedded in the JavaScript sent to browsers.

## Backend — `backend/.env`

Loaded and validated by `backend/src/config/env.js`.

### Core

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development`, `test` or `production`. Production turns on secure cookies by default and requires Cloudinary |
| `PORT` | No | `5000` | Port the API listens on |
| `MONGODB_URI` | **Yes** | — | `mongodb://…` or `mongodb+srv://…` connection string including the database name |
| `JWT_SECRET` | **Yes** | — | At least 32 characters. Signs session tokens and derives CSRF tokens. Changing it signs everyone out |
| `JWT_EXPIRES_IN_DAYS` | No | `7` | Session lifetime in days (1–90) |
| `FRONTEND_URL` | **Yes** | — | Origin of the web app, e.g. `http://localhost:3000`. Several origins may be comma-separated. Used for CORS and the origin guard |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Cookies and proxies

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `COOKIE_NAME` | No | `mkcg_session` | Name of the session cookie |
| `COOKIE_DOMAIN` | No | *(unset — host-only cookie)* | Set only for the direct sub-domain mode, e.g. `.example.com` |
| `COOKIE_SAMESITE` | No | `lax` | `lax`, `strict` or `none`. `none` requires a secure cookie |
| `COOKIE_SECURE` | No | `true` in production, otherwise `false` | Force the `Secure` attribute on or off |
| `TRUST_PROXY` | No | `loopback` | Express `trust proxy` setting: a hop count (`1`, `2`…), `loopback`, or `false`. Determines the client IP used for rate limiting |

### Initial administrator (used only by CLI scripts)

These are **not** read by the running server.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `ADMIN_NAME` | `admin:create` | Display name (2–80 characters) |
| `ADMIN_EMAIL` | `admin:create`, `admin:set-password` | Login email of the administrator |
| `ADMIN_PHONE` | `admin:create` | Phone number (must be unique) |
| `ADMIN_PASSWORD` | `admin:create`, `admin:set-password` | At least 12 characters with letters and numbers; placeholder values are refused. Remove it from the file after use |

### Cloudinary

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME` | In production | — | Cloud name |
| `CLOUDINARY_API_KEY` | In production | — | API key |
| `CLOUDINARY_API_SECRET` | In production | — | API secret — server only |
| `CLOUDINARY_FOLDER` | No | `mkcgspandan` | Root folder for all assets of this installation |
| `MAX_IMAGE_MB` | No | `8` | Largest accepted image (1–50) |
| `MAX_VIDEO_MB` | No | `60` | Largest accepted video (1–500) |

Outside production the API starts without Cloudinary credentials and logs a warning; uploads then return
`503 MEDIA_NOT_CONFIGURED`. If you change the size limits, also update `UPLOAD_LIMITS` in
`frontend/src/lib/constants.js` so the browser-side hints match.

### Behaviour and limits

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DEFAULT_COUNTRY_CODE` | No | `91` | Calling code added to 10-digit phone numbers entered without a prefix |
| `TIME_ZONE` | No | `Asia/Kolkata` | IANA time zone of the community calendar: decides which day "today" is for Today's Birthdays and the latest allowed date of birth. Keep it equal to the website's `NEXT_PUBLIC_TIME_ZONE` |
| `BCRYPT_ROUNDS` | No | `12` | bcrypt cost factor (4–15) |
| `RATE_LIMIT_GLOBAL_MAX` | No | `1500` | Requests per IP per 15 minutes |
| `RATE_LIMIT_LOGIN_MAX` | No | `10` | Login attempts per IP + identifier per 15 minutes (the per-IP cap is five times this) |
| `RATE_LIMIT_REGISTER_MAX` | No | `10` | Registrations per IP per hour |
| `RATE_LIMIT_WRITE_MAX` | No | `90` | Content changes per user per 5 minutes |
| `RATE_LIMIT_UPLOAD_MAX` | No | `40` | Uploads per user per 10 minutes |
| `JOBS_ENABLED` | No | `true` | Set to `false` to disable the in-process background jobs (event reminders, orphan-media cleanup). Not listed in `.env.example` |

### Startup validation

`getEnv()` is the first thing `server.js` and every script call. If anything is missing or malformed the process
exits before connecting to the database, printing something like:

```
Invalid environment configuration:
  - JWT_SECRET: must be at least 32 characters long
  - MONGODB_URI: must be a mongodb:// or mongodb+srv:// URI
See backend/.env.example.
```

Only variable names and reasons are printed — never values. Additional rules: every `FRONTEND_URL` entry must be a
valid `http(s)` URL; Cloudinary credentials are mandatory when `NODE_ENV=production`; `COOKIE_SAMESITE=none` requires
a secure cookie.

## Frontend — `frontend/.env.local`

| Variable | Required | Default | Exposed to the browser | Purpose |
| --- | --- | --- | --- | --- |
| `BACKEND_URL` | No | production: `https://mkcg-spandan.onrender.com`; `next dev`: the development default in `src/lib/api-config.mjs` | No | Origin of the Express API (`/api/v1` is appended; a trailing `/api/v1` or `/` is removed). Used by the `/api/v1/*` rewrite (`next.config.mjs`) and by server-side rendering of public pages (`src/lib/server-api.js`). Resolved in one place, `src/lib/api-config.mjs`; an invalid value fails the build, and a localhost value fails a Vercel build |
| `NEXT_PUBLIC_SITE_URL` | Yes in production | Vercel production domain, else `http://localhost:3000` | Yes | Public address of the site: canonical URLs, sitemap, Open Graph |
| `NEXT_PUBLIC_API_URL` | No | — | No (not read by browser code) | Alias of `BACKEND_URL`; `BACKEND_URL` wins when both are set. The browser always calls the same-origin `/api/v1` proxy |
| `NEXT_PUBLIC_TIME_ZONE` | No | `Asia/Kolkata` | Yes | Time zone used to display dates consistently on server and client. Not listed in `.env.example` |
| `NEXT_PUBLIC_ANDROID_APK_URL` | No | — | Yes | Full https:// address of the Android APK (or its download page) for the homepage "Download App" button (`site.androidApkUrl` in `src/lib/site.js`). Unset: the button shows "coming soon" and is not a link |

`BACKEND_URL` and the `NEXT_PUBLIC_*` values are read at **build time** for rewrites and client bundles — rebuild the
web app after changing them.

## Matching values between the two apps

| Web | API | Must agree |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `FRONTEND_URL` | The API only accepts state-changing requests from this origin |
| `BACKEND_URL` | `PORT` / public API address | The proxy target |
| `site.policyVersion` in `src/lib/site.js` | `POLICY_VERSION` in `src/config/constants.js` | Version of the Terms / Privacy / Guidelines that registrations record |

## Test environment

`backend/tests/helpers/env.js` sets fixture values for tests (a throw-away `JWT_SECRET`, a per-file database on the
in-memory server, fake Cloudinary names, low bcrypt cost, high rate limits, jobs disabled). No real `.env` file is
needed to run the tests. Values the helper sets take precedence over a local `backend/.env`; variables it does not
set (for example `COOKIE_DOMAIN`, `COOKIE_SECURE`, `DEFAULT_COUNTRY_CODE`) are still read from that file if present,
so keep them at their development defaults when running tests.
