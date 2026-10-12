# MKCGSPANDAN

**Together in Medicine. Connected Beyond Medicine.**

MKCGSPANDAN is a private online community for doctors and medical batchmates. Members reconnect through a doctor
directory and professional portfolios, share posts, blogs and memories (photos and videos), organise reunions and
visit plans, and vote in polls. What a doctor shares is published to the community at once;
administrators can delete content, act on reports and manage doctor accounts.

It is a members' community — not a hospital, patient-management or medical-advice system.

- Two application roles only: `ADMIN` and `DOCTOR`. There is no super-admin.
- Doctor registration needs **no** approval: a doctor is signed in immediately after registering.
- Doctor-created posts, blogs, comments, memories, events, visit plans and polls are **published immediately** —
  there is no approval step. Admins can delete any content and any doctor account.
- All images and videos are stored in Cloudinary; MongoDB stores metadata only; nothing is written to the server's disk.

## Technology

| Layer | Stack |
| --- | --- |
| Web | Next.js 16 (App Router, JavaScript/JSX only), React 19, Tailwind CSS 4, Framer Motion, GSAP, Lucide icons |
| API | Node.js, Express 5, Mongoose 9 (MongoDB), Zod validation, bcryptjs, JSON Web Tokens + server-side sessions |
| Media | Cloudinary (uploads pass through the API using Multer **memory** storage only) |
| Tests | Jest, Supertest, mongodb-memory-server (a real `mongod` binary run locally for tests) |

## Repository layout

```
MKCGSpandan/
├── backend/     Express REST API, Mongoose models, scripts and tests
├── frontend/    Next.js web application
├── docs/        Project documentation (see the index below)
├── package.json Root convenience scripts
└── README.md
```

## Prerequisites

- **Node.js 20.19 or newer** (developed on Node 22) and npm.
- **MongoDB** — a local `mongod`, or a MongoDB Atlas cluster. For a quick trial without either, see
  [`npm run dev:memory`](#development-commands).
- **A Cloudinary account** (cloud name, API key, API secret). Without it the API still starts in development, but every
  upload returns `503 MEDIA_NOT_CONFIGURED`. Cloudinary credentials are **required** when `NODE_ENV=production`.

## Installation

```bash
# from the repository root
npm run install:all        # installs root, backend and frontend dependencies
```

## Environment configuration

Real values live only in local files that are git-ignored. Never commit them.

```bash
# backend
cp backend/.env.example backend/.env
# frontend
cp frontend/.env.example frontend/.env.local
```

Minimum to edit in `backend/.env`:

| Variable | What to put there |
| --- | --- |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/mkcgspandan` or your Atlas `mongodb+srv://…` string |
| `JWT_SECRET` | A random string of at least 32 characters, e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `FRONTEND_URL` | The web origin, `http://localhost:3000` in development |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PHONE`, `ADMIN_PASSWORD` | Details of the first administrator (used only by `npm run admin:create`) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | From the Cloudinary console |

`frontend/.env.local` normally needs only `BACKEND_URL=http://localhost:5000` and
`NEXT_PUBLIC_SITE_URL=http://localhost:3000`.

Every variable is described in [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md). The API validates its configuration at
startup and refuses to boot with a list of the invalid variable **names** (never their values).

### MongoDB setup

- **Local:** install MongoDB Community Server and keep the default URI from `.env.example`.
- **Atlas:** create a cluster, a database user restricted to this application's database (`readWrite` on that database
  only), allow your IP address, and paste the connection string into `MONGODB_URI`.

Indexes (including the unique ones for email, phone, likes, votes and RSVPs) are created automatically by Mongoose
when the API starts. See [docs/DATABASE.md](docs/DATABASE.md).

### Cloudinary setup

Create a Cloudinary account, copy the three credentials into `backend/.env`, and optionally change
`CLOUDINARY_FOLDER` (default `mkcgspandan`). Details and recommended account settings are in
[docs/CLOUDINARY.md](docs/CLOUDINARY.md).

### Create the administrator

```bash
npm run admin:create       # from the root, or inside backend/
```

- Reads `ADMIN_*` from `backend/.env`, hashes the password and creates one user with the `ADMIN` role.
- **Idempotent:** if an administrator already exists nothing is changed — the password is never reset by this command
  or by starting the server.
- The password must be at least 12 characters with letters and numbers, and must not be a placeholder.
- After it succeeds you can delete `ADMIN_PASSWORD` from `backend/.env`.
- To rotate the password later: sign in and change it, or set a new `ADMIN_PASSWORD` and run
  `npm --prefix backend run admin:set-password -- --confirm` (signs the admin out everywhere).

See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md).

## Development commands

| Where | Command | What it does |
| --- | --- | --- |
| root | `npm run dev` | Starts the API (port 5000) and the web app (port 3000) together |
| root | `npm run dev:backend` / `npm run dev:frontend` | Starts one of them |
| backend | `npm run dev` | API with auto-restart (Node's built-in `--watch`) against `MONGODB_URI` |
| backend | `npm run dev:memory` | **Convenience mode.** Starts a local MongoDB binary managed by `mongodb-memory-server` (data kept in `backend/.data/mongo`), points the API at it, and creates the initial admin if `ADMIN_EMAIL`/`ADMIN_PASSWORD` are set. For trying the app without installing MongoDB — never for production. If `JWT_SECRET` is missing a temporary one is generated (sessions end when the process restarts) and `FRONTEND_URL` defaults to `http://localhost:3000`, so this mode runs with no `.env` at all. Cloudinary variables are still needed for uploads. |
| backend | `npm start` | API without auto-restart |
| backend | `npm run admin:create` | Creates the initial administrator |
| backend | `npm run admin:set-password -- --confirm` | Rotates the administrator password |
| backend | `npm run media:cleanup` | Deletes uploads that were never attached to content (older than 24 h) |
| frontend | `npm run dev` | Next.js development server on http://localhost:3000 |
| frontend | `npm run build` then `npm start` | Production build and server |

Open http://localhost:3000. The browser only talks to the Next.js origin; requests to `/api/v1/*` are proxied to the
API (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).

## Tests, lint and build

```bash
npm test                         # backend test suite (Jest)
npm --prefix backend run lint    # backend ESLint
npm --prefix frontend run lint   # frontend ESLint
npm run build                    # frontend production build
npm --prefix backend run audit:deps   # dependency vulnerability check (production dependencies)
```

The backend tests need no MongoDB installation and no Cloudinary account: they download and run a real `mongod`
binary on first use and replace the Cloudinary SDK with a test double. See [docs/TESTING.md](docs/TESTING.md).

## Documentation

| Document | Contents |
| --- | --- |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | The seven build phases and what each delivered |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Structure of the API and the web app, request lifecycle, mobile compatibility |
| [docs/API.md](docs/API.md) | Every REST endpoint, permissions, parameters and error codes |
| [docs/ROLES_AND_PERMISSIONS.md](docs/ROLES_AND_PERMISSIONS.md) | `ADMIN` / `DOCTOR` permission matrix and what visitors can see |
| [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) | Registration, login, sessions, CSRF, suspension, admin bootstrap |
| [docs/SECURITY.md](docs/SECURITY.md) | Implemented security controls and their limits |
| [docs/CONTENT_MODERATION.md](docs/CONTENT_MODERATION.md) | Publishing without approval, visibility rules, admin deletion, reports |
| [docs/DATABASE.md](docs/DATABASE.md) | Models, relationships, indexes, deletion behaviour, backups |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | Every environment variable |
| [docs/TESTING.md](docs/TESTING.md) | Automated tests and the manual acceptance checklist |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment and pre-launch checklist |
| [docs/DOCTOR_PORTFOLIO.md](docs/DOCTOR_PORTFOLIO.md) | Profile fields, completion, visibility preferences |
| [docs/CLOUDINARY.md](docs/CLOUDINARY.md) | Upload architecture, delivery types, signed URLs, limitations |

## Limitations

This project is a working full-stack application, but it is not finished in every respect and it has not been
independently security-reviewed. In particular: there is no email or SMS delivery (so no "forgot password" flow),
email and phone numbers cannot be changed from the UI, rate limiting and background jobs run in-process (one API
instance), the Cloudinary integration has been exercised against a test double unless you supply real credentials,
and the Terms, Privacy Policy and Community Guidelines pages are drafts that **must be reviewed by a qualified legal
professional** before production use.

The full, honest list is kept in each document's "Remaining limitations" section — start with
[docs/SECURITY.md](docs/SECURITY.md#remaining-limitations) and
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#remaining-limitations).
