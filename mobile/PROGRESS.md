# Mobile app — build checklist

Working notes for resuming the build if a session is interrupted. A stage is ticked only after its check ran.
The documentation is `docs/MOBILE.md` (how to run, structure, chat, what was and was not verified).

- [x] 1. Inspect backend — every API the app needs already existed (bearer-token sessions, doctors, media, posts,
      blogs, memories, events, polls, comments, likes, notifications, chat REST + Socket.IO). **No backend changes.**
- [x] 2. Project config and foundation — `app.config.js`, env files, `eas.json`, brand assets, `theme/`, `services/`,
      `hooks/`, UI kit, contexts, root layout
- [x] 3. Auth + onboarding — intro, login, register, three optional steps
- [x] 4. Main app — five tabs, Home, doctors, blogs & memories, community, events, profile + editor, settings,
      notifications, about, guidelines, profile menu
- [x] 5. Chat — socket service, chat provider, Group / One-to-One tabs, conversation, new chat, WhatsApp action
- [x] 6. Checks — `npm run lint` clean, `npm run doctor` 21/21, `npm run export` bundles, `npm run test:api` 45/45,
      emulator walkthrough in Expo Go (13 Oct 2026)

## Still open

- [ ] Standalone build (`eas build --profile preview` or `npx expo run:android`) — only Expo Go was run
- [ ] Real Cloudinary upload from the app, video upload/playback, date pickers, event and post creation on screen
- [ ] Push notifications (needs FCM + a device-token endpoint on the API) — not started
- [ ] Decision: should one-to-one chat require a WhatsApp number? (current server rule — see docs/MOBILE.md, "WhatsApp")
- [ ] Poll creation in the app (reading and voting work)
