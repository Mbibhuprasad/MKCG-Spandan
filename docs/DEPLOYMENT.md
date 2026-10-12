# Deployment

MKCGSPANDAN consists of two Node.js processes and two managed services:

| Component | What it is | Typical hosting |
| --- | --- | --- |
| API (`backend/`) | Express app, long-running Node process | A VM/container platform (Render, Railway, Fly.io, a VPS with a process manager) |
| Web (`frontend/`) | Next.js app (`next build` + `next start`) | Vercel, or the same kind of Node hosting as the API |
| Database | MongoDB | MongoDB Atlas |
| Media | Cloudinary | Cloudinary account |

Both apps need Node.js 20.19 or newer. Serve everything over **HTTPS**.

## Recommended topology

```
https://www.example.com  ──▶  Next.js  ──(server-side rewrite /api/v1/*)──▶  API (not necessarily public)  ──▶ Atlas
```

Browsers talk only to the web origin. The API can sit on a private network or a separate hostname; it is reached by
the Next.js server through `BACKEND_URL`. This keeps the session cookie first-party.

## 1. Database (MongoDB Atlas)

1. Create a cluster in a region close to your users.
2. Create a **dedicated database user** with the built-in `readWrite` role on the application database only — not
   `atlasAdmin`, not `readWriteAnyDatabase`.
3. Restrict network access to the API's egress addresses (or use private networking). Avoid `0.0.0.0/0`.
4. Enable backups (continuous or scheduled snapshots) and **perform a test restore** before launch.
5. Put the connection string, including the database name, in `MONGODB_URI`.

Indexes are created by the API on startup. See [DATABASE.md](DATABASE.md) for backup and recovery considerations.

## 2. Cloudinary

1. Create the account and copy cloud name, API key and API secret into the API's environment.
2. Choose `CLOUDINARY_FOLDER` (one folder per environment, e.g. `mkcgspandan-prod`, keeps staging and production apart).
3. In the Cloudinary console, review **Settings → Security**:
   - enable **strict transformations** so only signed or pre-approved transformation URLs are served;
   - make sure delivery of `authenticated` assets requires a signature (the default);
   - restrict unsigned uploads (the application never uses them).
4. Consider enabling Cloudinary backups for uploaded originals.
5. Check the plan's limits for video size and transformations against `MAX_VIDEO_MB`.

Details: [CLOUDINARY.md](CLOUDINARY.md).

## 3. API

Environment (see [ENVIRONMENT.md](ENVIRONMENT.md) for every variable):

```dotenv
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority
JWT_SECRET=<64+ random characters from your secret manager>
FRONTEND_URL=https://www.example.com
TRUST_PROXY=<number of proxy hops in front of the API>
CLOUDINARY_CLOUD_NAME=<…>
CLOUDINARY_API_KEY=<…>
CLOUDINARY_API_SECRET=<…>
CLOUDINARY_FOLDER=mkcgspandan-prod
```

Notes:

- **Secrets** belong in the host's secret manager / environment settings, not in files inside the image or the
  repository.
- **`NODE_ENV=production`** makes the session cookie `Secure` by default and makes Cloudinary credentials mandatory;
  the API refuses to start without them.
- **`FRONTEND_URL`** must be exactly the public web origin (scheme + host, no path). The API rejects state-changing
  requests from any other origin.
- **`TRUST_PROXY`** decides which `X-Forwarded-For` entry is believed for rate limiting. In the recommended topology
  the chain is *client → web host's edge → Next.js → (API host's load balancer) → API*; count the proxies you control
  and trust between the client and the API. Too low and all users share one rate-limit bucket; too high and clients
  can spoof their address. Verify after deployment by checking that different clients are limited independently.
- **Cookies:** with the proxy topology leave `COOKIE_DOMAIN` unset and `COOKIE_SAMESITE=lax`.

Install and start:

```bash
cd backend
npm ci --omit=dev
npm start                      # node src/server.js
```

Run it under a process manager that restarts on failure (systemd, PM2, or the platform's own supervisor). The process
handles `SIGTERM`/`SIGINT` by closing the HTTP server and the database connection. Health check: `GET /api/v1/health`.

### Create the administrator (once)

Set `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PHONE` and a strong `ADMIN_PASSWORD` in the environment of a one-off shell or
job, then:

```bash
npm run admin:create
```

It is safe to run again (it never changes an existing admin). Afterwards **remove `ADMIN_PASSWORD`** from the
environment. To rotate the password later, either change it in the application while signed in, or set a new
`ADMIN_PASSWORD` and run:

```bash
npm run admin:set-password -- --confirm
```

This signs the admin out everywhere. Remove the variable again afterwards.

### One instance or several

- **Background jobs** (event reminders, orphan-upload cleanup) run inside the API process. They are idempotent, so
  several instances do not cause duplicates, but for a clean setup run them in one place: set `JOBS_ENABLED=false` on
  all but one instance.
- **Rate limiting** uses in-memory counters per process. With several instances each keeps its own counters, so the
  effective limits multiply. For a multi-instance deployment add a shared store (for example Redis) to
  `backend/src/middleware/rateLimiters.js`.
- For a batch community, **a single API instance** is the simplest correct deployment.

### Memory and uploads

Uploads are held in memory while they are forwarded to Cloudinary: a request can use up to `MAX_VIDEO_MB` (default
60 MB) of RAM, and several may run at once (the upload limiter allows 40 per user per 10 minutes). Give the API at
least 512 MB–1 GB, or lower `MAX_VIDEO_MB`.

## 4. Web

Environment:

```dotenv
BACKEND_URL=https://api.internal.example.com     # where the Next.js server can reach the API
NEXT_PUBLIC_SITE_URL=https://www.example.com
```

Both are read at build time, so set them **before** building:

```bash
cd frontend
npm ci
npm run build
npm start                      # next start (port 3000 by default; use -p or PORT to change)
```

### Uploads through the proxy

Media uploads travel browser → Next.js → API → Cloudinary.

- `next.config.mjs` raises the proxy timeout to 5 minutes (`experimental.proxyTimeout`).
- Any reverse proxy or platform in front of Next.js must allow request bodies at least as large as `MAX_VIDEO_MB` and
  a matching timeout (for nginx: `client_max_body_size` and `proxy_read_timeout`).
- **Serverless platforms often cap request bodies at a few megabytes and limit execution time.** If your web host has
  such limits, either host the web app on a regular Node server, or use the direct mode below so uploads bypass it,
  or lower the limits and accept images only.

### Alternative: direct sub-domain mode

If the API is public at a sibling sub-domain (for example `api.example.com` next to `www.example.com`), the browser
can call it directly:

| Setting | Value |
| --- | --- |
| Web `NEXT_PUBLIC_API_URL` | `https://api.example.com/api/v1` |
| API `FRONTEND_URL` | `https://www.example.com` |
| API `COOKIE_DOMAIN` | `.example.com` |
| API `COOKIE_SAMESITE` | `lax` (same site, different sub-domain) |
| Web CSP | Add the API origin to `connect-src` in `frontend/next.config.mjs` |

Hosting the two on unrelated domains without the proxy would need `SameSite=None` cookies, which several browsers
block; the proxy topology avoids that and is the supported default.

## 5. Monitoring and operations

- **Logs:** the API writes request logs (`morgan`, combined format in production) and timestamped application logs to
  stdout/stderr. Ship them to your log platform. Unexpected errors are logged with stack traces on the server only.
- **Uptime:** monitor `GET /api/v1/health` and the homepage.
- **Alerts:** watch for 5xx rates, repeated `429`s (possible abuse or a wrong `TRUST_PROXY`), MongoDB connection
  errors, Cloudinary upload failures (`502 UPLOAD_FAILED`), and memory usage.
- **Audit:** review `/admin/audit-log` periodically.
- **Dependencies:** run `npm audit --omit=dev` in both apps on a schedule and apply security updates.
- **Backups:** verify that Atlas backups are running; rehearse a restore.
- **Secret rotation:** rotating `JWT_SECRET` signs everyone out (sessions and CSRF tokens become invalid). Rotate the
  Cloudinary secret in the Cloudinary console and update the API environment together.

## Pre-launch checklist

- [ ] HTTPS on the public origin; HTTP redirects to HTTPS.
- [ ] `NODE_ENV=production` on the API; a unique, random `JWT_SECRET` of 64+ characters.
- [ ] `FRONTEND_URL` and `NEXT_PUBLIC_SITE_URL` are the real public origin.
- [ ] `TRUST_PROXY` verified (different clients are rate-limited independently).
- [ ] Session cookie shows `HttpOnly`, `Secure`, `SameSite=Lax` in the browser.
- [ ] MongoDB user limited to `readWrite` on one database; network access restricted; backups enabled and a restore tested.
- [ ] Cloudinary credentials set; strict transformations enabled; a real upload, private view, video playback and download verified end to end.
- [ ] Admin created with `npm run admin:create`; `ADMIN_PASSWORD` removed from the environment afterwards.
- [ ] `npm test`, lint and `npm run build` pass on the commit being deployed.
- [ ] Manual acceptance checklist in [TESTING.md](TESTING.md) completed on the production-like environment.
- [ ] `/robots.txt` and `/sitemap.xml` show the real domain and only public pages.
- [ ] **Terms & Conditions, Privacy Policy and Community Guidelines reviewed by a qualified legal professional**, with
      real contact details and your backup-retention period filled in. If they change, bump `POLICY_VERSION`
      (`backend/src/config/constants.js`) and `site.policyVersion` (`frontend/src/lib/site.js`).
- [ ] An independent security review / penetration test has been carried out.
- [ ] Logo and hero imagery replaced with your own assets (`frontend/public/brand/`, `frontend/src/lib/site.js`).
- [ ] Log shipping, uptime monitoring and alerting in place.

## Remaining limitations

- No email/SMS provider is integrated: no password reset, verification or email notifications.
- Rate limiting and background jobs are per process (see above).
- Uploads are memory-buffered and pass through the web proxy by default; very large videos need the hosting
  adjustments described above.
- The Cloudinary integration has been verified against the SDK test double; confirm it with your own account before
  launch (checklist items above).
- There is no built-in migration tooling, CI configuration, Dockerfile or infrastructure-as-code; add what your
  platform requires.
- The application does not claim compliance with any specific data-protection or health-information regulation.
