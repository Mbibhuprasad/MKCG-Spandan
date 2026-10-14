# Android app (`mobile/`)

A React Native app for doctors, built with Expo (SDK 57), Expo Router and JavaScript/JSX only. It is a second client
of the **existing** API in `backend/` — the same MongoDB database, the same Cloudinary uploads, the same rules. The app
adds no backend, no database and no endpoints: everything it needs was already there, including bearer-token sessions
for mobile clients (see [AUTHENTICATION.md](AUTHENTICATION.md)) and the chat service.

The website in `frontend/` is not touched by the app.

## Running it

```bash
# 1. API (from the repository root) — the app talks to this
npm run dev:backend                 # http://localhost:5000, uses backend/.env

# 2. App
cd mobile
npm install                         # first time only
npx expo start                      # then press "a" for the Android emulator, or scan the QR code with Expo Go
npx expo start --android            # start and open the emulator in one step
```

The app runs in **Expo Go** during development (every native module it uses ships with Expo Go). An installable build
is made with EAS (`eas.json` has `development`, `preview` and `production` profiles) or locally with
`npx expo run:android`, which needs the Android SDK, NDK and a few gigabytes of free memory.

| Command (inside `mobile/`) | What it does                                                   |
| -------------------------- | -------------------------------------------------------------- |
| `npm run lint`             | ESLint (`eslint-config-expo`)                                  |
| `npm run doctor`           | `expo-doctor` — dependency and configuration checks            |
| `npm run export`           | Bundles every route for Android; fails on a wrong import       |
| `npm run test:api-server`  | Starts an **isolated** API for tests (see [Testing](#testing)) |
| `npm run test:api`         | Runs the integration tests against that isolated API           |

### Where the API is — `EXPO_PUBLIC_API_URL`

The address is configuration, never code (`mobile/services/config.js`, examples in `mobile/.env.example`):

| Situation                 | Value                                                                                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android emulator          | `http://10.0.2.2:5000` — `10.0.2.2` is the computer running the emulator; the emulator's own `localhost` is the emulator itself                                                  |
| Physical phone            | `http://<computer's LAN address>:5000`, or an https tunnel. Phone and computer must be on the same network and the firewall must allow the port                                  |
| Left empty in development | The app uses the computer that serves the JavaScript bundle (the Expo dev server) on port 5000 — works for the emulator and a phone on the same network without editing anything |
| Production build          | The public `https://` address of the API. A production build with no address shows "Server address not set" instead of guessing; it never falls back to `localhost`              |

Put a personal override in `mobile/.env.development.local` (git-ignored). `EXPO_PUBLIC_*` values are compiled into the
bundle, so nothing secret may go there — and nothing secret is needed: the app holds no database, JWT, Cloudinary or
admin credentials.

Plain `http://` is permitted by Android only when the configured address is not `https://` (`app.config.js`). The API
listens on all interfaces by default, so a phone can reach it once the firewall allows it.

## Structure

```
mobile/
├── app/                    Expo Router screens
│   ├── _layout.js          providers, session gate (signed out → (auth), signed in → (app))
│   ├── (auth)/             welcome (intro), login, register, policies
│   └── (app)/
│       ├── (tabs)/         the five tabs: index (Home), chat, library (Blogs & Memories), community, profile
│       ├── onboarding/     the three optional steps after registration
│       ├── chat/           [id] conversation, new (find a doctor)
│       ├── doctors/ blogs/ memories/ posts/ events/    lists and detail screens
│       ├── create/         blog, memory, event, post
│       ├── profile/        edit (hub) and section/[key]
│       └── menu, settings, notifications, about, guidelines
├── components/             shared UI: ui/ kit, AppHeader, TabBar, MediaPicker, MediaGallery, HtmlContent, FormScreen…
├── features/               one folder per area: api.js plus its cards, forms and logic
│   └── auth/ profile/ doctors/ blogs/ memories/ community/ events/ chat/ notifications/
├── contexts/               AuthContext (session), ToastContext
├── services/               api.js (REST client), socket.js (Socket.IO), config.js, storage.js
├── hooks/                  useResource, usePagedList, useDebounced
├── theme/                  tokens.js (light + dark palettes), ThemeProvider.js
├── utils/                  format, phone, events, constants
├── tests/integration/      Node tests of the app's modules against an isolated API
└── assets/                 icon, adaptive icon, splash, in-app logo
```

Styling is a small token-based system on React Native `StyleSheet` (`theme/tokens.js`); the light palette repeats the
website's colours, the dark palette adds purple/blue accents. Animations use React Native Reanimated. Framer Motion
and GSAP are web libraries and are not used in the app.

## What each screen uses

| Screen                           | API                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Register / login                 | `POST /auth/register`, `POST /auth/login` with `X-Client-Type: mobile` → `token`                                             |
| Session restore, sign-out        | `GET /auth/me`, `POST /auth/logout`                                                                                          |
| Onboarding step A, Edit profile  | `PATCH /doctors/me`, `PUT`/`DELETE /doctors/me/photo`, `GET /doctors/specialties`                                            |
| Onboarding step B, Create memory | `POST /media` (purpose `memory`), `POST /memories`                                                                           |
| Onboarding step C, Create blog   | `POST /media` (purpose `blog`), `POST /blogs`                                                                                |
| Home                             | `GET /doctors`, `/blogs?limit=10`, `/memories`, `/posts`, `/events?scope=upcoming`; completion from `user.profileCompletion` |
| Doctors, portfolio               | `GET /doctors`, `/doctors/filters`, `/doctors/:id`, `/blogs?author=`, `/memories?owner=`                                     |
| Blogs & Memories                 | `GET /blogs`, `/blogs/slug/:slug`, `/memories`, `/memories/:id`                                                              |
| Community                        | `GET /posts`, `/events`, `/polls`; `POST /posts`, `/events`, `/polls/:id/vote`; RSVP                                         |
| Likes, comments, reports         | `PUT`/`DELETE /likes/…`, `/comments`, `POST /reports`                                                                        |
| Notifications                    | `GET /notifications`, `/notifications/unread-count`, `PATCH …/read`, `…/read-all`                                            |
| Chat                             | `/chat/*` and the Socket.IO gateway — see below                                                                              |
| Settings                         | `PATCH /doctors/me` (visibility), `PATCH /auth/password`                                                                     |

Content is published as soon as it is saved, exactly as on the website; the app has no approval step and never sends
`role`, `status` or similar fields. A blog, memory or event created in the app is the same record the website shows.

### Profile editing

`features/profile/sections.js` describes the profile as data. Each section mirrors one step of the website's profile
wizard and owns the same request keys, so saving a section sends only those keys and stores the wizard's resume
position (`wizardStep`). "Submit profile" is the wizard's final step (`submit: true`). Award images added on the
website are carried through untouched when awards are edited on the phone.

The completion percentage shown on Home, Profile and the menu is `profileCompletion.percent` from the API — it is
never computed on the phone.

### Onboarding

After registration the doctor is signed in immediately and offered three optional steps (profile essentials, a memory,
a blog). Each has **Skip for Now**; skipping everything goes straight to Home. All three remain available later from
Profile and the profile menu. Whether onboarding is still pending is remembered on the device per account.

## Launch screen, logo and developer credit

- **Native splash** — configured by the `expo-splash-screen` plugin in `app.config.js` (`assets/splash-icon.png`,
  shown 144 dp wide on white, or on near-black in dark mode). Replace that file with the final logo: a square PNG,
  1024 × 1024 px, transparent background, with the artwork inside the central two-thirds (Android 12+ crops the launch
  icon to a circle). A new native splash needs a new build; Expo Go always shows its own.
- **Animated launch screen** — `LaunchScreen` in `components/BootScreens.js`, mounted above the navigator by
  `app/_layout.js`. It takes over when the native splash is hidden, zooms the logo in while the stored session is
  checked (`GET /auth/me`), and fades out when that check ends — into the app, the sign-in screens, or the
  "cannot reach the server" screen. The three dots only mean "working"; no progress is simulated. It is shown at
  launch and when the session is re-checked, never when moving between tabs.
- **Logo** — the official `assets/MKCGSPANDAN LOGO.png` (the same artwork as the website), loaded in one place
  (`components/Logo.js`, `LOGO`) and shown on a white rounded tile so it is legible in both themes: header, Home,
  About, sign-in, onboarding and the launch screen. The native splash (`app.config.js`, expo-splash-screen) uses the
  same file; changing it there needs a new native build. The file must exist at build time.
- **Website link** — `EXPO_PUBLIC_WEB_URL` (see `.env.example`, read in `services/config.js` as `WEB_URL`): the
  "Explore MKCGSPANDAN on the Web" card in the Home "More to Explore" section opens it. While it is empty the card
  shows "Coming soon" and opens nothing.
- **Developer credit** — `site.developer` in `utils/constants.js` (`name`, optional `url`), rendered by
  `components/DeveloperCredit.js` at the end of Home and About.

## Chat

The backend already had chat: `Conversation`, `ConversationMember` and `Message` models, `chat.service.js`, REST
routes under `/chat` and a Socket.IO gateway on the API's own port (path `/socket.io`). The app is a client of it.

| Requirement                | How it is met                                                                                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Group chat                 | One community group (`key: "community"`) that every active member belongs to; created once on first use, never duplicated                                                                                                          |
| One-to-one chat            | `POST /chat/direct { doctorId }` returns the single conversation for the pair (unique key `direct:<idA>:<idB>`), from either side                                                                                                  |
| Authenticated sockets      | The session token is sent in the handshake; no token, no connection                                                                                                                                                                |
| Membership checks          | Every read and write goes through `chat.service`, which checks `ConversationMember`; a conversation that is not yours answers `404`, whatever id the client sends. The server assigns socket rooms — there is no "subscribe" event |
| Persistence, order, paging | Messages are stored in MongoDB and read newest-page-first with a cursor (`before`)                                                                                                                                                 |
| Duplicate prevention       | The app gives each message a `clientId`; a retry (socket or REST) returns the stored message                                                                                                                                       |
| Reconnection               | Socket.IO reconnects by itself; on `ready` the app reloads the conversation list and the newest page of the open conversation and merges by id                                                                                     |
| Unread counts              | From the server per conversation; cleared with `conversation:read`                                                                                                                                                                 |
| Rate limiting              | `RATE_LIMIT_CHAT_MAX` messages per member per minute, shared by REST and sockets                                                                                                                                                   |
| Offline / errors           | A banner shows when the live connection is down; sending falls back to REST with the same `clientId`; a message that could not be sent stays in the list marked "Tap to retry"                                                     |

`features/chat/ChatContext.js` owns the one socket and the conversation list; screens only render. Voice and video
calls are not implemented and no camera or microphone permission is requested (both are blocked in `app.config.js`).
Call signalling would be added to the same authenticated connection without changing the message screens.

### WhatsApp

In-app chat and WhatsApp are separate. The WhatsApp number lives on the account (`whatsapp { sameAsPhone, number }`);
"same as my registered number" reuses the phone number rather than storing it twice. Numbers are validated and
normalised to `+<country code><number>` on the phone and again by the API. The number reaches another member only
while the doctor's **Show my WhatsApp number** switch is on — otherwise the API does not send it at all. The WhatsApp
button appears only when a number was received, opens WhatsApp with an empty message box and never sends anything.

**Current server rule:** a doctor needs a WhatsApp number on their own profile before starting or sending in a
one-to-one chat (`403 WHATSAPP_REQUIRED`, `assertDirectEligible` in `chat.service.js`). Group chat has no such
requirement. The app explains this and links to the field. If one-to-one chat should be open to doctors without a
WhatsApp number, remove the two `assertDirectEligible(user)` calls and the tests that expect `WHATSAPP_REQUIRED`.

## Security and privacy on the device

- The session token is kept in Android's Keystore-backed storage (`expo-secure-store`); the password is never stored.
- A `401`/suspension from any request, or from the socket handshake, signs the app out in one place.
- Sign-out deletes the server-side session (which also closes that device's socket) and removes the token.
- Photos are chosen with Android's photo picker, so the app sees only the selected files and asks for no storage
  permission. Uploads go to the API, which checks the real file type and forwards them to Cloudinary.
- Blog HTML from the API is rendered to native text by a small allow-list renderer (`components/HtmlContent.js`); no
  web view, nothing executed.
- Hidden buttons are not a security boundary: every rule is enforced by the API.

## Notifications

In-app notifications come from `GET /notifications`; the bell shows the unread count (re-read when the app returns to
the foreground and once a minute). **Push notifications are not implemented**: the API has no device-token storage and
sends nothing to Expo/FCM. Settings → _Message alerts_ raises a local notification on the phone when a chat message
arrives over the live connection while the app is running; nothing is delivered while the app is closed. Adding real
push needs an FCM project, a device-token endpoint and a sender on the API.

## Testing

### Integration tests of the app's own modules

`mobile/tests/integration/` loads the app's real modules in Node — `services/api.js`, `services/socket.js`, every
`features/*/api.js`, the profile model, validation and utils — and runs them against an isolated API. Only what is
native to a phone is replaced (`expo-constants`, `expo-secure-store`, `react-native`'s `Linking`, and
`XMLHttpRequest`/`FormData`, which are adapted to Node's `fetch`).

```bash
cd mobile
npm run test:api-server     # terminal 1 — isolated API on :5100 (in-memory MongoDB, stand-in for Cloudinary)
npm run test:api            # terminal 2 — 45 checks
```

`isolated-api.js` pins every environment variable before loading the backend, so it never reads the database or the
Cloudinary account in `backend/.env`. **Never point `test:api` at a real deployment** — it registers accounts and
posts content.

What the 45 checks cover: API address resolution and error reporting; registration with immediate sign-in and a
`DOCTOR` role that cannot be overridden; duplicate accounts; login by email and phone; session restore, expired
sessions and logout; profile sections, completion percentage, photo upload and server-side validation messages;
WhatsApp normalisation and visibility; contact privacy; the directory with search and filters; blogs, memories, events
and posts published immediately and listed once; ownership rules; polls; notifications and their links; and chat —
rejected unauthenticated sockets, the single community group, real-time delivery, persistence, duplicate prevention,
one conversation per pair, unread counts, a third doctor locked out of a one-to-one conversation over REST and
sockets, forged and malformed events, pagination, reconnection, the WhatsApp rule, rate limiting and logout closing
the socket.

### On an emulator (manual)

Verified on 13 October 2026 in Expo Go on an Android 14 emulator against the isolated API: intro → registration with
validation → automatic sign-in → onboarding (save a step, skip the others) → Home with real doctors, blogs, memories
and the server's completion percentage → the five tabs → directory search → another doctor's portfolio → blog reader,
like and comment → photo upload from the gallery and a published memory → group chat (history, send, live receive,
unread badges) → one-to-one chat (search, preview with the shared WhatsApp number, send, live reply) → message box
above the keyboard → dark theme and its persistence → session restore after restarting the app → sign-out and sign-in
as another doctor.

### Not verified

- A standalone build (`eas build` / `expo run:android`) — only Expo Go was run. Edge-to-edge system bars, the native
  splash screen and the launcher icon are therefore untested on a device.
- Real Cloudinary uploads from the app (the tests use a stand-in), video upload and playback, and the date pickers.
- Creating an event or a post, RSVP, polls and the settings switches **on screen** (their API calls are covered by the
  integration tests).
- Opening WhatsApp itself (the emulator has no WhatsApp; the URL the app opens is checked).
- Message alerts (local notifications) and behaviour on a physical phone or on slow or lost mobile data.

## Known limits

- No push notifications (above). No voice or video calls.
- Polls can be read and voted on in the app; creating a poll is on the website.
- Email and phone number cannot be changed, and there is no "forgot password" — the API has neither.
- Administration (accounts, reports, removing other members' content) stays on the website. An admin can sign in to
  the app and use it as a member.
