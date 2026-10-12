# Authentication

Code: `backend/src/controllers/auth.controller.js`, `backend/src/services/session.service.js`,
`backend/src/middleware/auth.js`, `backend/src/validators/auth.validators.js`,
`frontend/src/components/providers/AuthProvider.jsx`, `frontend/src/lib/api.js`.

## Strategy in one paragraph

One coherent design is used everywhere: a **server-side session** stored in MongoDB plus a **signed JWT** (HS256)
that names the user and the session. The web app receives the JWT in an **httpOnly cookie** and protects
state-changing requests with a **session-bound CSRF token**. A mobile client asks for the JWT in the response body
and sends it as a **bearer token**. Because every request loads the session and the user from the database, logout,
password change, suspension and deletion take effect immediately.

## Doctor registration — no approval step

`POST /api/v1/auth/register`

1. The registration form validates in the browser (`RegisterForm.jsx`) for quick feedback.
2. The API validates again with Zod: name, email, phone, password (at least 8 characters, at most 72 bytes, at least
   one letter and one number), matching confirmation, and `acceptPolicies: true`.
3. Email and phone are normalised (below).
4. Uniqueness of email and phone is checked; a duplicate returns `409 ACCOUNT_EXISTS` with per-field messages. Unique
   indexes on both fields decide races between simultaneous registrations.
5. The password is hashed with bcrypt (`BCRYPT_ROUNDS`, default 12).
6. The account is created with `status: ACTIVE` and `role: DOCTOR` — both set by the server. Unknown fields such as
   `role` or `status` in the payload are discarded by validation.
7. The accepted policy version (`POLICY_VERSION`) and timestamp are stored in `policyAcceptance`.
8. A session is created and the cookie is set — **the doctor is signed in automatically**.
9. A one-time welcome notification is created.
10. The web app redirects to `/dashboard`, where an incomplete profile shows a "Complete Your Professional Profile" prompt
    that can be skipped.

There is no `PENDING_APPROVAL` account state anywhere in the system. An administrator can later suspend or delete an
account.

### Normalisation

| Value | Rule (`backend/src/utils/text.js`) |
| --- | --- |
| Email | Trimmed and lower-cased |
| Phone | Spaces, dashes, dots and brackets removed. A leading `+` or `00` means an international number. Otherwise leading zeros are dropped and a 10-digit number gets `DEFAULT_COUNTRY_CODE` (default `91`). Result is `+<8–15 digits>`; anything else is rejected |

Example: `098765 43210`, `+91 98765-43210` and `9876543210` all become `+919876543210`.

## Login

`POST /api/v1/auth/login` with `{ identifier, password }`.

- If `identifier` contains `@` it is treated as an email, otherwise as a phone number (normalised the same way as at
  registration).
- Wrong password and unknown account produce the **same** response (`401 INVALID_CREDENTIALS`,
  "The email/phone number or password is incorrect."). When no account matches, the password is still compared
  against a dummy hash so response time does not reveal whether the account exists.
- A suspended account is refused with `403 ACCOUNT_SUSPENDED` — only after the correct password was supplied.
- On success `lastLoginAt` is updated and a new session is started.

The login form disables the submit button while a request is in flight and shows field and form errors.

## Sessions and tokens

| Item | Detail |
| --- | --- |
| Session document | `Session { user, client: web \| mobile, userAgent (≤ 200 chars), expiresAt }`; a TTL index removes expired sessions |
| Token | JWT, HS256, payload `{ sub: userId, sid: sessionId }`, lifetime `JWT_EXPIRES_IN_DAYS` (default 7). Only HS256 is accepted on verification |
| Cookie | Name `COOKIE_NAME` (default `mkcg_session`); `HttpOnly`; `Secure` in production (or `COOKIE_SECURE`); `SameSite` from `COOKIE_SAMESITE` (default `Lax`); optional `Domain`; `Path=/`; `Max-Age` equal to the session lifetime |
| Per request | Verify JWT → load session (`_id`, `user`, not expired) → load user → require `ACTIVE` |

Nothing about the role or status is trusted from the token: both are read from the user document on every request.

### Session restoration

On page load `AuthProvider` calls `GET /auth/session`. This endpoint always answers `200`: with a valid cookie it
returns `{ authenticated: true, user, csrfToken }`, so the signed-in state survives a refresh; otherwise it returns
`{ authenticated: false, reason, message }` (reason `SIGNED_OUT` or `ACCOUNT_SUSPENDED`) and clears a stale cookie.
Answering 200 means a signed-out visitor does not produce a failed request in the browser console on every page.
`GET /auth/me` remains available for API clients and answers `401` when not signed in. Any later response with `401` (or
`ACCOUNT_SUSPENDED`) signs the UI out and shows a message on the login page.

### Logout and expiry

`POST /auth/logout` deletes the session document and clears the cookie, so a copied token stops working at once.
Logout is the one state-changing request that does not require the CSRF token: it must always be able to clear the
cookie, the Origin check still blocks cross-site attempts, and a forged logout could do no more than sign someone
out. The web app then performs a full page load of the homepage, which discards all member data held in memory.
Expired tokens and tokens whose session no longer exists return `401 SESSION_EXPIRED`.

### Password change

`PATCH /auth/password` requires the current password, stores a new bcrypt hash, sets `passwordChangedAt`, and deletes
every **other** session of that user.

## CSRF and origin protection

Cookies are sent automatically by browsers, so two independent checks protect state-changing requests:

1. **Origin guard** (`middleware/security.js`) — for `POST`, `PUT`, `PATCH`, `DELETE`, an `Origin` header that is not
   in `FRONTEND_URL` is rejected (`403 ORIGIN_NOT_ALLOWED`). This also covers login and registration.
2. **Session-bound CSRF token** — `csrfToken = HMAC-SHA256(JWT_SECRET, "csrf:" + sessionId)`. It is returned in the
   body of register, login and `/auth/me`, kept in JavaScript memory only, and must be sent as `X-CSRF-Token` on every
   cookie-authenticated non-GET request. The comparison is constant-time. A token from another session is useless.

Bearer-token requests skip the CSRF token check because a bearer token is not an ambient credential.
`SameSite=Lax` on the cookie is an additional layer.

## Suspended accounts

- `PATCH /admin/doctors/:id/status` with `SUSPENDED` stores the reason, deletes all of the doctor's sessions and
  notifies the doctor.
- Existing sessions therefore fail with `401`; a new login fails with `403 ACCOUNT_SUSPENDED`; any credential that
  somehow remains valid is refused because `requireAuth` checks the status.
- Reactivation restores normal login.

## Rate limiting

| Endpoint | Limit (default) |
| --- | --- |
| `POST /auth/login` | 10 attempts / 15 min per IP + identifier, and 50 / 15 min per IP |
| `POST /auth/register` | 10 / hour per IP |
| Everything | 1500 / 15 min per IP |

Client IPs come from `X-Forwarded-For` only when `TRUST_PROXY` says the proxy is trusted — configure it correctly in
production (see [DEPLOYMENT.md](DEPLOYMENT.md)).

## Administrator account

The first administrator is created from environment variables by a CLI command — never by the registration endpoint
and never hard-coded.

```bash
# backend/.env
ADMIN_NAME=Community Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PHONE=+910000000000
ADMIN_PASSWORD=<a strong password, 12+ characters with letters and numbers>

npm --prefix backend run admin:create
```

Behaviour (`backend/src/services/adminBootstrap.service.js`):

- If **any** administrator already exists, nothing is changed and the command exits successfully (idempotent). An
  existing password is never reset — not by this command and not by starting the server.
- Missing or weak values stop the command with a list of variable names and reasons. Values, including the password,
  are never printed.
- If the email or phone already belongs to a doctor account the command fails; accounts are never promoted.
- The password is hashed with bcrypt before it is stored, and an audit entry `ADMIN_BOOTSTRAPPED` is written.

### Rotating the admin password

- **Preferred:** sign in as the admin and change the password (`PATCH /auth/password`).
- **Recovery / scripted:** put the new value in `ADMIN_PASSWORD`, then run
  `npm --prefix backend run admin:set-password -- --confirm`. This updates the hash for the admin whose email is
  `ADMIN_EMAIL`, signs that admin out everywhere and writes an audit entry. Without `--confirm` nothing happens.

After either command succeeds, remove `ADMIN_PASSWORD` from `backend/.env`; it is not needed at runtime.

## Mobile (bearer) flow

```http
POST /api/v1/auth/login
X-Client-Type: mobile
Content-Type: application/json

{ "identifier": "doctor@example.com", "password": "…" }
```

The response contains `data.token` and no cookie is set. Send `Authorization: Bearer <token>` afterwards. The same
session rules apply (logout deletes the session; suspension blocks it).

## Remaining limitations

- No email or SMS is sent, so there is no "forgot password" flow and no email/phone verification. A doctor who
  forgets their password needs an administrator-assisted reset, which is not implemented in the UI.
- Email and phone cannot be changed after registration through the API.
- There is no "log out of all devices" button; changing the password does this for other devices.
- No multi-factor authentication.
- Rate-limit counters are in memory per API process.
