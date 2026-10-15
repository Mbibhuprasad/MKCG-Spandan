/* eslint-disable no-console */
// Integration tests of the mobile app's own modules (API client, socket
// service, feature APIs, profile model, utils) against the isolated test API.
// Run with `npm run test:api` — see run.cjs.
import assert from "node:assert/strict";
import path from "node:path";
import {
  ApiError,
  api,
  onAuthFailure,
  setToken,
  uploadMedia,
} from "@/services/api";
import { API_URL, isApiConfigured } from "@/services/config";
import { createChatSocket, emitWithAck } from "@/services/socket";
import { blogsApi } from "@/features/blogs/api";
import { chatApi } from "@/features/chat/api";
import {
  commentsApi,
  likesApi,
  pollsApi,
  postsApi,
} from "@/features/community/api";
import { doctorsApi } from "@/features/doctors/api";
import { eventsApi } from "@/features/events/api";
import { travelPayload, validateTravel } from "@/features/events/travel";
import { memoriesApi } from "@/features/memories/api";
import { notificationsApi } from "@/features/notifications/api";
import { routeForLink } from "@/features/notifications/links";
import { profileApi } from "@/features/profile/api";
import {
  placeServerErrors,
  sectionToForm,
  sectionToPayload,
  validateSection,
} from "@/features/profile/model";
import { ESSENTIALS, sectionByKey } from "@/features/profile/sections";
import { validateRegistration } from "@/features/auth/validation";
import { newClientId } from "@/utils/format";
import { normalizePhone, openWhatsApp } from "@/utils/phone";
import { opened } from "react-native";

const MOBILE = { auth: false, headers: { "X-Client-Type": "mobile" } };
const PASSWORD = "Reunion2026pass";
const stamp = Date.now().toString().slice(-7);
const MOBILE_DIR = process.env.MKCG_MOBILE_DIR;
const IMAGE = path.resolve(MOBILE_DIR, "assets/logo-mark.png");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push([true, name]);
    console.log(`  ok   ${name}`);
  } catch (err) {
    results.push([false, name, err]);
    console.log(
      `  FAIL ${name}\n       ${String(err && err.message)
        .split("\n")
        .join("\n       ")}`,
    );
  }
}
const rejects = async (promise, code, status) => {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${err}`);
    assert.equal(err.code, code);
    if (status) assert.equal(err.status, status);
    return err;
  }
  throw new Error(`expected rejection with ${code}, but the call succeeded`);
};

let n = 0;
async function newDoctor(label, extra = {}) {
  n += 1;
  const body = {
    name: `Dr. ${label} Test${stamp}`,
    email: `${label.toLowerCase()}${stamp}${n}@test.invalid`,
    phone: `98${stamp}${n}`.slice(0, 10).padEnd(10, "0"),
    password: PASSWORD,
    confirmPassword: PASSWORD,
    acceptPolicies: true,
    ...extra,
  };
  const { data } = await api.post("/auth/register", body, MOBILE);
  return { ...data.user, token: data.token, body };
}
// Runs REST calls as one doctor (the client keeps a single token, like the app).
const as = async (doctor, fn) => {
  setToken(doctor.token);
  try {
    return await fn();
  } finally {
    setToken(null);
  }
};
const connect = (doctor) =>
  new Promise((resolve, reject) => {
    const socket = createChatSocket(doctor.token);
    socket.once("ready", () => resolve(socket));
    socket.once("connect_error", (err) => reject(err));
    socket.connect();
  });
const nextEvent = (socket, event, ms = 4000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no "${event}" event within ${ms} ms`)),
      ms,
    );
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

console.log(`API: ${API_URL}\n`);

/* ───────────── Configuration and client ───────────── */
console.log("Configuration and API client");
await test("the API address comes from EXPO_PUBLIC_API_URL", async () => {
  assert.equal(isApiConfigured, true);
  assert.equal(API_URL, `${process.env.EXPO_PUBLIC_API_URL}/api/v1`);
});
await test("health check reaches the server", async () => {
  const { data } = await api.get("/health", null, { auth: false });
  assert.equal(data.status, "ok");
});
await test("a request that cannot complete is reported as TIMEOUT/NETWORK, not as empty data", async () => {
  const err = await api
    .get("/health", null, { auth: false, timeout: 1, retries: 0 })
    .then(
      () => null,
      (e) => e,
    );
  assert.ok(err instanceof ApiError && err.isNetwork, `got ${err && err.code}`);
});
await test("member-only data without a session is refused (401 UNAUTHENTICATED)", async () => {
  await rejects(doctorsApi.list({ limit: 1 }), "UNAUTHENTICATED", 401);
});

/* ───────────── Registration, login, session ───────────── */
console.log("\nRegistration, login and session");
let alice;
let bob;
let carol;
let dave; // has no WhatsApp number
await test("registration returns a mobile token and signs the doctor in at once (no approval)", async () => {
  alice = await newDoctor("Alice");
  assert.ok(
    alice.token && alice.token.split(".").length === 3,
    "token missing",
  );
  assert.equal(alice.role, "DOCTOR");
  assert.equal(alice.status, "ACTIVE");
  const me = await as(alice, () => api.get("/auth/me"));
  assert.equal(me.data.user.id, alice.id);
});
await test("a client cannot register itself as ADMIN", async () => {
  const sneaky = await newDoctor("Sneaky", {
    role: "ADMIN",
    status: "ACTIVE",
    featured: true,
  });
  assert.equal(sneaky.role, "DOCTOR");
  assert.equal(sneaky.featured, false);
});
await test("registering the same email again is refused with field details", async () => {
  const err = await rejects(
    api.post("/auth/register", alice.body, MOBILE),
    "ACCOUNT_EXISTS",
    409,
  );
  assert.ok(err.details && err.details.email);
});
await test("the app-side registration checks match the server rules", async () => {
  assert.deepEqual(validateRegistration({ ...alice.body }), {});
  const bad = validateRegistration({
    name: "A",
    email: "x",
    phone: "12",
    password: "short",
    confirmPassword: "other",
    acceptPolicies: false,
  });
  assert.deepEqual(Object.keys(bad).sort(), [
    "acceptPolicies",
    "confirmPassword",
    "email",
    "name",
    "password",
    "phone",
  ]);
});
await test("login works with the email and with the phone number", async () => {
  const byEmail = await api.post(
    "/auth/login",
    { identifier: alice.body.email, password: PASSWORD },
    MOBILE,
  );
  assert.ok(byEmail.data.token);
  const byPhone = await api.post(
    "/auth/login",
    { identifier: alice.body.phone, password: PASSWORD },
    MOBILE,
  );
  assert.equal(byPhone.data.user.id, alice.id);
});
await test("a wrong password is INVALID_CREDENTIALS", async () => {
  await rejects(
    api.post(
      "/auth/login",
      { identifier: alice.body.email, password: "Wrong2026pass" },
      MOBILE,
    ),
    "INVALID_CREDENTIALS",
    401,
  );
});
await test("session restoration: a stored token still identifies the doctor", async () => {
  const stored = alice.token; // what the app keeps in secure storage
  setToken(stored);
  const { data } = await api.get("/auth/me");
  setToken(null);
  assert.equal(data.user.email, alice.body.email);
});
await test("an invalid token triggers the sign-out handler (expired session handling)", async () => {
  let seen = null;
  onAuthFailure((error) => {
    seen = error;
  });
  setToken("not.a.token");
  await rejects(api.get("/auth/me"), "SESSION_EXPIRED", 401);
  setToken(null);
  onAuthFailure(null);
  assert.ok(seen && seen.code === "SESSION_EXPIRED");
});
await test("logout ends the session on the server", async () => {
  const { data } = await api.post(
    "/auth/login",
    { identifier: alice.body.email, password: PASSWORD },
    MOBILE,
  );
  setToken(data.token);
  await api.post("/auth/logout", {});
  await rejects(api.get("/auth/me"), "SESSION_EXPIRED", 401);
  setToken(null);
});

/* ───────────── Profile, WhatsApp, privacy ───────────── */
console.log("\nProfile completion, WhatsApp and contact privacy");
await test("profile completion is computed by the server from saved data and rises after saving", async () => {
  const before = alice.profileCompletion.percent;
  const form = sectionToForm(ESSENTIALS, alice);
  form.fields = {
    ...form.fields,
    professionalTitle: "Consultant Physician",
    specialization: "General Medicine",
    hospital: "Test Hospital",
    city: "Berhampur",
    bio: "Trained with the batch.",
  };
  form.whatsapp = { sameAsPhone: true, number: "" };
  assert.deepEqual(validateSection(ESSENTIALS, form), {});
  const { data } = await as(alice, () =>
    profileApi.update(sectionToPayload(ESSENTIALS, form)),
  );
  assert.ok(
    data.profileCompletion.percent > before,
    `${before} → ${data.profileCompletion.percent}`,
  );
  assert.equal(data.whatsapp.sameAsPhone, true);
  assert.equal(data.whatsapp.number, data.phone); // the registered number is reused, not stored twice
  alice = { ...alice, ...data };
});
await test("profile photo: upload through the API, then attach (PUT /doctors/me/photo)", async () => {
  let progress = 0;
  const media = await as(alice, () =>
    uploadMedia(
      { uri: IMAGE, mimeType: "image/png", fileName: "me.png", type: "image" },
      "profile",
      { onProgress: (p) => (progress = p) },
    ),
  );
  assert.ok(media.id && media.url, "no media record");
  assert.equal(progress, 1);
  const { data } = await as(alice, () => profileApi.setPhoto(media.id));
  assert.ok(data.profile.photoUrl);
  assert.ok(data.profileCompletion.percent > alice.profileCompletion.percent);
  alice = { ...alice, ...data };
});
await test("a file that is not an image is refused by the server", async () => {
  await rejects(
    as(alice, () =>
      uploadMedia(
        {
          uri: path.resolve(MOBILE_DIR, "package.json"),
          mimeType: "image/png",
          fileName: "fake.png",
          type: "image",
        },
        "profile",
      ),
    ),
    "UNSUPPORTED_MEDIA_TYPE",
    400,
  );
});
await test("every section of the profile editor produces a body the server accepts", async () => {
  const user = alice;
  for (const key of [
    "basic",
    "expertise",
    "education",
    "practice",
    "fellowships",
    "awards",
    "publications",
  ]) {
    const section = sectionByKey(key);
    const form = sectionToForm(section, user);
    if (key === "education")
      form.lists.education.push({
        key: "x",
        degree: "MBBS",
        level: "UNDERGRADUATE",
        institution: "Test Medical College",
        fieldOfStudy: "",
        startYear: "2001",
        year: "2006",
        certification: "",
        details: "",
      });
    if (key === "expertise")
      form.lists.experience.push({
        key: "y",
        role: "Consultant",
        organization: "Test Hospital",
        employmentType: "FULL_TIME",
        city: "Berhampur",
        state: "Odisha",
        startYear: "2012",
        endYear: "",
        current: true,
        description: "",
      });
    if (key === "awards")
      form.lists.achievements.push({
        key: "z",
        title: "Best Teacher",
        issuer: "Test College",
        year: "2019",
        description: "",
        imageId: null,
      });
    if (key === "publications")
      form.lists.links.push({
        key: "l",
        label: "Scholar",
        url: "https://example.org/profile",
      });
    assert.deepEqual(
      validateSection(section, form),
      {},
      `client validation for ${key}`,
    );
    const { data } = await as(alice, () =>
      profileApi.update(sectionToPayload(section, form)),
    );
    assert.equal(
      data.profileCompletion.resumeStep,
      section.step,
      `wizard step for ${key}`,
    );
    alice = { ...alice, ...data };
  }
  assert.equal(alice.profile.education[0].degree, "MBBS");
  assert.equal(alice.profile.experience[0].current, true);
  assert.equal(alice.profile.achievements[0].title, "Best Teacher");
});
await test("server validation errors are placed on the right field", async () => {
  const section = sectionByKey("practice");
  const err = await as(alice, () =>
    profileApi.update({
      profile: { workEmail: "not-an-email" },
      whatsapp: { sameAsPhone: false, number: "12" },
    }),
  ).then(
    () => null,
    (e) => e,
  );
  assert.equal(err.code, "VALIDATION_ERROR");
  const placed = placeServerErrors(section, err.details);
  assert.ok(placed.fields.workEmail, "workEmail message");
  assert.ok(placed.fields.whatsapp, "whatsapp message");
});
await test("submitting the profile marks it complete once name, specialization and city are saved", async () => {
  const { data } = await as(alice, () => profileApi.update({ submit: true }));
  assert.equal(data.profileCompletion.isComplete, true);
  // 'Submitted' and 'how much is filled in' are separate: one optional item is still missing here.
  assert.deepEqual(data.profileCompletion.missing, ["Qualifications"]);
  assert.equal(data.profileCompletion.percent, 89);
  alice = { ...alice, ...data };
});
await test("WhatsApp numbers are normalised with a country code", async () => {
  assert.equal(normalizePhone("98765 43210"), "+919876543210");
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
  assert.equal(normalizePhone("0098765"), null);
  assert.equal(normalizePhone("call me"), null);
  bob = await newDoctor("Bob");
  const { data } = await as(bob, () =>
    profileApi.update({
      whatsapp: { sameAsPhone: false, number: "+44 20 7946 0958" },
      profile: { specialization: "Surgery", city: "Cuttack" },
    }),
  );
  assert.equal(data.whatsapp.number, "+442079460958");
  bob = { ...bob, ...data };
});
await test('contact privacy: phone and email hidden by default; WhatsApp only while "show WhatsApp" is on', async () => {
  const seen = await as(alice, () => doctorsApi.get(bob.id));
  assert.equal(seen.data.contact.whatsapp, "+442079460958");
  assert.equal(seen.data.contact.phone, undefined);
  assert.equal(seen.data.contact.email, undefined);
  await as(bob, () =>
    profileApi.update({ visibility: { showWhatsapp: false } }),
  );
  const hidden = await as(alice, () => doctorsApi.get(bob.id));
  assert.equal(
    hidden.data.contact.whatsapp,
    undefined,
    "hidden number must not be sent at all",
  );
  await as(bob, () =>
    profileApi.update({ visibility: { showWhatsapp: true } }),
  );
});
await test("the WhatsApp action opens WhatsApp for that number and sends nothing", async () => {
  opened.length = 0;
  assert.equal(await openWhatsApp("+442079460958"), true);
  assert.deepEqual(opened, ["whatsapp://send?phone=442079460958"]);
  assert.equal(await openWhatsApp(""), false);
});
await test("a doctor cannot change another doctor’s profile (there is no such endpoint; PATCH /doctors/me is always self)", async () => {
  await as(alice, () =>
    profileApi.update({ profile: { headline: "Alice headline" } }),
  );
  const seen = await as(alice, () => doctorsApi.get(bob.id));
  assert.notEqual(seen.data.profile.headline, "Alice headline");
  await rejects(
    as(alice, () =>
      api.patch(`/doctors/${bob.id}`, { profile: { headline: "hacked" } }),
    ),
    "NOT_FOUND",
    404,
  );
});
await test("directory: real doctors, with search and filters", async () => {
  const all = await as(alice, () => doctorsApi.list({ limit: 48 }));
  assert.ok(all.data.some((d) => d.id === bob.id));
  const found = await as(alice, () =>
    doctorsApi.list({ q: `Bob Test${stamp}` }),
  );
  assert.deepEqual(
    found.data.map((d) => d.id),
    [bob.id],
  );
  const byCity = await as(alice, () =>
    doctorsApi.list({ city: "Cuttack", specialization: "Surgery", limit: 48 }),
  );
  assert.ok(
    byCity.data.some((d) => d.id === bob.id) &&
      !byCity.data.some((d) => d.id === alice.id),
  );
  const filters = await as(alice, () => doctorsApi.filters());
  assert.ok(filters.data.cities.includes("Cuttack"));
});

/* ───────────── Content ───────────── */
console.log("\nBlogs, memories, events, posts");
let blog;
let memory;
let event;
let post;
await test("a blog is published immediately and is ONE record in the list, on Home and on the author’s portfolio", async () => {
  const cover = await as(alice, () =>
    uploadMedia(
      {
        uri: IMAGE,
        mimeType: "image/png",
        fileName: "cover.png",
        type: "image",
      },
      "blog",
    ),
  );
  const body = `## Notes\n\n${"A sentence about practice that is long enough to count. ".repeat(6)}\n\n- one\n- two`;
  blog = (
    await as(alice, () =>
      blogsApi.create({
        title: `Harness blog ${stamp}`,
        excerpt: "An excerpt long enough for the server rule.",
        body,
        category: "Research",
        tags: ["Audit", "#audit"],
        coverId: cover.id,
      }),
    )
  ).data;
  assert.equal(blog.moderation.status, "APPROVED");
  assert.deepEqual(blog.tags, ["audit"]);
  const recent = await as(bob, () => blogsApi.list({ limit: 10 }));
  const mine = await as(bob, () =>
    blogsApi.list({ author: alice.id, limit: 5 }),
  );
  assert.ok(
    recent.data.some((b) => b.id === blog.id),
    "in recent blogs",
  );
  assert.deepEqual(
    mine.data.filter((b) => b.title === blog.title).map((b) => b.id),
    [blog.id],
    "exactly one record for the author",
  );
  const detail = await as(bob, () => blogsApi.bySlug(blog.slug));
  assert.ok(
    detail.data.bodyHtml.includes("<h2>Notes</h2>") &&
      detail.data.bodyHtml.includes("<li>one</li>"),
  );
  assert.ok(detail.data.cover && detail.data.cover.url);
});
await test("a memory with an uploaded photo is published immediately; community Memories and the profile Gallery stay separate", async () => {
  const photo = await as(alice, () =>
    uploadMedia(
      { uri: IMAGE, mimeType: "image/png", fileName: "m.png", type: "image" },
      "memory",
    ),
  );
  memory = (
    await as(alice, () =>
      memoriesApi.create({
        title: `Harness memory ${stamp}`,
        caption: "Caption",
        mediaIds: [photo.id],
        memoryDate: "2004-02-01T00:00:00.000Z",
        eventId: null,
        showInCommunity: true,
      }),
    )
  ).data;
  assert.equal(memory.media.length, 1);
  const galleryOf = (viewer, owner) =>
    as(viewer, () => memoriesApi.list({ owner: owner.id, limit: 12 }));
  const community = await as(bob, () => memoriesApi.list({ limit: 12 }));
  assert.ok(community.data.some((m) => m.id === memory.id));
  // A community memory is not put in its owner's profile gallery…
  assert.ok(
    !(await galleryOf(bob, alice)).data.some((m) => m.id === memory.id),
  );

  // …and a gallery photo is shown on its owner's profile only.
  const own = await as(alice, () =>
    uploadMedia(
      { uri: IMAGE, mimeType: "image/png", fileName: "g.png", type: "image" },
      "memory",
    ),
  );
  const item = (
    await as(alice, () =>
      memoriesApi.create({
        title: `Harness gallery ${stamp}`,
        caption: "",
        mediaIds: [own.id],
        memoryDate: null,
        eventId: null,
        showInCommunity: false,
      }),
    )
  ).data;
  assert.equal(item.showInCommunity, false);
  assert.deepEqual(
    (await galleryOf(bob, alice)).data.map((m) => m.id),
    [item.id],
  );
  assert.ok(!(await galleryOf(alice, bob)).data.some((m) => m.id === item.id));
  const after = await as(bob, () => memoriesApi.list({ limit: 36 }));
  assert.ok(!after.data.some((m) => m.id === item.id));
});
await test("a memory without media is refused", async () => {
  const err = await rejects(
    as(alice, () =>
      memoriesApi.create({ title: "No media", caption: "", mediaIds: [] }),
    ),
    "VALIDATION_ERROR",
    400,
  );
  assert.ok(err.details.mediaIds);
});
await test("an event is published immediately; RSVP is one answer per member; only the organiser can delete it", async () => {
  event = (
    await as(alice, () =>
      eventsApi.create({
        title: `Harness reunion ${stamp}`,
        description: "A get-together for the batch.",
        eventType: "REUNION",
        city: "Berhampur",
        venue: "Hall",
        startsAt: new Date(Date.now() + 5 * 86400000).toISOString(),
        endsAt: null,
        budgetNote: "",
        coverId: null,
        rsvpEnabled: true,
        rsvpDeadline: null,
        capacity: null,
      }),
    )
  ).data;
  const upcoming = await as(bob, () =>
    eventsApi.list({ scope: "upcoming", limit: 30 }),
  );
  assert.ok(upcoming.data.some((e) => e.id === event.id));
  const going = await as(bob, () => eventsApi.rsvp(event.id, "GOING", 0));
  assert.equal(going.data.rsvp.mine.status, "GOING");
  const maybe = await as(bob, () => eventsApi.rsvp(event.id, "MAYBE", 0));
  assert.equal(maybe.data.rsvp.going, 0);
  assert.equal(maybe.data.rsvp.maybe, 1);
  await rejects(
    as(bob, () => eventsApi.remove(event.id)),
    "FORBIDDEN",
    403,
  );
});
await test("event schedule: each doctor saves their own travel plan; the schedule lists them by arrival", async () => {
  const viewer = await newDoctor("Viewer");
  const day = 86400000;
  const start = new Date(event.startsAt).getTime();
  const plan = (from, offsetHours) => ({
    travelFrom: from,
    arrivalAt: new Date(start - offsetHours * 3600000),
    departureAt: new Date(start + day),
    note: "",
  });
  // The app checks what the server checks.
  const blank = validateTravel({ ...plan("", 2), arrivalAt: null }, event);
  assert.ok(blank.travelFrom && blank.arrivalAt);
  const backwards = validateTravel({ ...plan("Puri", 2), departureAt: new Date(start - 3 * 3600000) }, event);
  assert.ok(backwards.departureAt);
  const late = validateTravel({ ...plan("Puri", 2), arrivalAt: new Date(start + 2 * day), departureAt: new Date(start + 3 * day) }, event);
  assert.ok(late.arrivalAt);
  assert.deepEqual(validateTravel(plan("Puri", 2), event), {});

  const err = await rejects(
    as(bob, () => eventsApi.saveTravel(event.id, { ...travelPayload(plan("Puri", 2)), travelFrom: "" })),
    "VALIDATION_ERROR",
    400,
  );
  assert.ok(err.details.travelFrom);

  const own = await as(alice, () => eventsApi.saveTravel(event.id, travelPayload(plan("Bhubaneswar", 20))));
  assert.equal(own.data.rsvp.mine.status, "GOING");
  assert.equal(own.data.rsvp.mine.travel.from, "Bhubaneswar");
  const bobs = await as(bob, () => eventsApi.saveTravel(event.id, travelPayload(plan("Cuttack", 4))));
  assert.equal(bobs.data.rsvp.mine.status, "MAYBE"); // an existing answer is kept
  const again = await as(bob, () => eventsApi.saveTravel(event.id, travelPayload(plan("Cuttack Cantonment", 4))));
  assert.equal(again.data.rsvp.mine.travel.from, "Cuttack Cantonment");

  const list = await as(viewer, () => eventsApi.schedule(event.id, { limit: 100 }));
  assert.deepEqual(
    list.data.map((row) => [row.doctor.id, row.travel.from]),
    [
      [alice.id, "Bhubaneswar"],
      [bob.id, "Cuttack Cantonment"],
    ],
  );
  assert.ok(list.data.every((row) => !row.isMine));
  assert.ok(!JSON.stringify(list.data).includes(bob.body.email));

  // Only administrators may take down someone else's plan.
  await rejects(as(bob, () => api.delete(`/events/${event.id}/schedule/${alice.id}`)), "FORBIDDEN", 403);
  const removed = await as(bob, () => eventsApi.removeTravel(event.id));
  assert.equal(removed.data.rsvp.mine.travel, null);
  const after = await as(viewer, () => eventsApi.schedule(event.id, { limit: 100 }));
  assert.deepEqual(after.data.map((row) => row.doctor.id), [alice.id]);
});
await test("date of birth: the profile editor saves a calendar date, refuses future dates, and keeps it private", async () => {
  const section = sectionByKey("basic");
  const form = sectionToForm(section, alice);
  form.fields.dateOfBirth = "2999-01-01";
  assert.ok(validateSection(section, form).dateOfBirth);
  form.fields.dateOfBirth = "1985-02-30";
  assert.ok(validateSection(section, form).dateOfBirth);
  form.fields.dateOfBirth = "1984-02-29";
  assert.deepEqual(validateSection(section, form), {});
  const { data } = await as(alice, () => profileApi.update(sectionToPayload(section, form)));
  assert.equal(data.profile.dateOfBirth, "1984-02-29");
  alice = { ...alice, ...data };
  const seen = await as(bob, () => doctorsApi.get(alice.id));
  assert.equal(seen.data.profile.dateOfBirth, null);
  const birthdays = await as(bob, () => api.get("/doctors/birthdays"));
  assert.ok(Array.isArray(birthdays.data.doctors));
});
await test("Friends cards carry a contact number only when the doctor allows it", async () => {
  const cardOf = async () =>
    (await as(bob, () => doctorsApi.list({ limit: 48, q: "Alice" }))).data.find((d) => d.id === alice.id);
  assert.deepEqual((await cardOf()).contact, {});
  await as(alice, () => profileApi.update({ visibility: { showPhone: true } }));
  assert.equal((await cardOf()).contact.phone, alice.phone);
  await as(alice, () => profileApi.update({ visibility: { showPhone: false } }));
  assert.equal((await cardOf()).contact.phone, undefined);
});
await test("community post: publish, like (idempotent), comment, and only the author can delete", async () => {
  post = (
    await as(alice, () =>
      postsApi.create({
        type: "ACHIEVEMENT",
        body: `Harness post ${stamp}`,
        mediaIds: [],
      }),
    )
  ).data;
  const feed = await as(bob, () => postsApi.list({ limit: 10 }));
  assert.ok(feed.data.some((p) => p.id === post.id));
  await as(bob, () => likesApi.like("post", post.id));
  const again = await as(bob, () => likesApi.like("post", post.id));
  assert.equal(again.data.likeCount, 1);
  const comment = await as(bob, () =>
    commentsApi.create("post", post.id, "Well done!"),
  );
  assert.equal(comment.data.body, "Well done!");
  const thread = await as(alice, () =>
    commentsApi.list("post", post.id, { limit: 10 }),
  );
  assert.equal(thread.data.length, 1);
  await rejects(
    as(bob, () => postsApi.remove(post.id)),
    "FORBIDDEN",
    403,
  );
});
await test("polls list and vote once", async () => {
  const polls = await as(bob, () =>
    pollsApi.list({ state: "open", limit: 10 }),
  );
  if (!polls.data.length) return; // nothing seeded
  const poll = polls.data[0];
  const voted = await as(bob, () =>
    pollsApi.vote(poll.id, [poll.options[0].id]),
  );
  assert.deepEqual(voted.data.myVote, [poll.options[0].id]);
  await rejects(
    as(bob, () => pollsApi.vote(poll.id, [poll.options[1].id])),
    "ALREADY_VOTED",
    409,
  );
});
await test("notifications: welcome notification, unread count, mark read, and its link maps to an app screen", async () => {
  const list = await as(bob, () => notificationsApi.list({ limit: 15 }));
  const welcome = list.data.find((x) => x.type === "WELCOME");
  assert.ok(welcome && !welcome.read);
  assert.equal(routeForLink(welcome.link), "/profile/edit");
  const before = (await as(bob, () => notificationsApi.unreadCount())).data
    .unreadCount;
  await as(bob, () => notificationsApi.markRead(welcome.id));
  const after = (await as(bob, () => notificationsApi.unreadCount())).data
    .unreadCount;
  assert.equal(after, before - 1);
  assert.equal(routeForLink(`/events/${event.id}`), `/events/${event.id}`);
  assert.equal(
    routeForLink(`/community/posts/${post.id}`),
    `/posts/${post.id}`,
  );
  assert.equal(routeForLink(`/blogs/${blog.slug}`), `/blogs/${blog.slug}`);
  assert.equal(
    routeForLink(`/memories?memory=${memory.id}`),
    `/memories/${memory.id}`,
  );
  assert.equal(routeForLink("https://evil.example"), null);
});

/* ───────────── Chat ───────────── */
console.log("\nChat: group, one-to-one, real time");
let sa;
let sb;
let group;
let direct;
await test("a socket without a valid session token is refused", async () => {
  const bad = createChatSocket("not.a.token");
  const err = await new Promise((resolve) => {
    bad.once("connect_error", resolve);
    bad.once("ready", () => resolve(null));
    bad.connect();
  });
  bad.disconnect();
  assert.ok(
    err && err.data && err.data.code === "SESSION_EXPIRED",
    `got ${err && JSON.stringify(err.data)}`,
  );
});
await test("two doctors connect with their tokens and both belong to the single community group", async () => {
  [sa, sb] = await Promise.all([connect(alice), connect(bob)]);
  const a = await as(alice, () => chatApi.conversations("GROUP"));
  const b = await as(bob, () => chatApi.conversations("GROUP"));
  assert.equal(a.data.length, 1);
  assert.equal(a.data[0].isCommunity, true);
  assert.equal(
    b.data[0].id,
    a.data[0].id,
    "same group for everyone, no duplicates",
  );
  group = a.data[0];
});
await test("group message: sent over the socket, received by the other doctor in real time, and persisted", async () => {
  const incoming = nextEvent(sb, "message:new");
  const clientId = newClientId();
  const reply = await emitWithAck(sa, "message:send", {
    conversationId: group.id,
    body: `Hello batch ${stamp}`,
    clientId,
  });
  const event2 = await incoming;
  assert.equal(event2.conversationId, group.id);
  assert.equal(event2.message.id, reply.message.id);
  assert.equal(event2.message.sender.id, alice.id);
  assert.equal(event2.message.sender.name, alice.name);
  assert.ok(event2.message.createdAt);
  const history = await as(bob, () =>
    chatApi.messages(group.id, { limit: 30 }),
  );
  assert.ok(
    history.data.some((m) => m.id === reply.message.id),
    "stored on the server",
  );
});
await test("a retry with the same clientId (socket, then REST) stores the message once", async () => {
  const clientId = newClientId();
  const first = await emitWithAck(sa, "message:send", {
    conversationId: group.id,
    body: "Only once",
    clientId,
  });
  const viaSocket = await emitWithAck(sa, "message:send", {
    conversationId: group.id,
    body: "Only once",
    clientId,
  });
  const viaRest = await as(alice, () =>
    chatApi.send(group.id, "Only once", clientId),
  );
  assert.equal(viaSocket.duplicate, true);
  assert.equal(viaSocket.message.id, first.message.id);
  assert.equal(viaRest.data.id, first.message.id);
  const history = await as(alice, () =>
    chatApi.messages(group.id, { limit: 50 }),
  );
  assert.equal(history.data.filter((m) => m.clientId === clientId).length, 1);
});
await test("one-to-one: opening the chat from either side returns the same single conversation", async () => {
  const fromAlice = await as(alice, () => chatApi.openDirect(bob.id));
  const fromBob = await as(bob, () => chatApi.openDirect(alice.id));
  const again = await as(alice, () => chatApi.openDirect(bob.id));
  assert.equal(fromBob.data.id, fromAlice.data.id);
  assert.equal(again.data.id, fromAlice.data.id);
  direct = fromAlice.data;
  assert.equal(direct.type, "DIRECT");
  assert.equal(direct.peer.id, bob.id);
  assert.equal(
    direct.peer.whatsapp,
    "+442079460958",
    "permitted WhatsApp number comes with the conversation",
  );
  const list = await as(alice, () => chatApi.conversations("DIRECT"));
  assert.equal(list.data.filter((c) => c.peer.id === bob.id).length, 1);
});
await test("one-to-one messages travel both ways in real time and are kept", async () => {
  let incoming = nextEvent(sb, "message:new");
  const one = await emitWithAck(sa, "message:send", {
    conversationId: direct.id,
    body: "Hi Bob",
    clientId: newClientId(),
  });
  assert.equal((await incoming).message.id, one.message.id);
  incoming = nextEvent(sa, "message:new");
  const two = await emitWithAck(sb, "message:send", {
    conversationId: direct.id,
    body: "Hi Alice",
    clientId: newClientId(),
  });
  assert.equal((await incoming).message.id, two.message.id);
  const history = await as(bob, () =>
    chatApi.messages(direct.id, { limit: 30 }),
  );
  assert.deepEqual(
    history.data.map((m) => m.body),
    ["Hi Bob", "Hi Alice"],
    "oldest first, in order",
  );
});
await test('unread count rises for the receiver and is cleared by "read"', async () => {
  await emitWithAck(sa, "message:send", {
    conversationId: direct.id,
    body: "Are you coming to the reunion?",
    clientId: newClientId(),
  });
  const before = (await as(bob, () => chatApi.conversation(direct.id))).data;
  assert.ok(before.unreadCount >= 1, `unread ${before.unreadCount}`);
  assert.equal(before.lastMessage.preview, "Are you coming to the reunion?");
  await emitWithAck(sb, "conversation:read", { conversationId: direct.id });
  const after = (await as(bob, () => chatApi.conversation(direct.id))).data;
  assert.equal(after.unreadCount, 0);
  assert.equal(
    (await as(alice, () => chatApi.conversation(direct.id))).data.unreadCount,
    0,
    "the sender has nothing unread",
  );
});
await test("reactions: one per doctor, changed or removed, delivered live to the other side", async () => {
  const sent = await emitWithAck(sa, "message:send", {
    conversationId: direct.id,
    body: "React to this",
    clientId: newClientId(),
  });
  const messageId = sent.message.id;
  let incoming = nextEvent(sa, "message:reaction");
  const liked = await as(bob, () =>
    chatApi.react(direct.id, messageId, "👍"),
  );
  assert.deepEqual(liked.data.reactions, [
    { emoji: "👍", userIds: [bob.id] },
  ]);
  assert.deepEqual((await incoming).reactions, liked.data.reactions);

  incoming = nextEvent(sa, "message:reaction");
  const changed = await emitWithAck(sb, "message:react", {
    conversationId: direct.id,
    messageId,
    emoji: "❤️",
  });
  assert.deepEqual(changed.reactions, [{ emoji: "❤️", userIds: [bob.id] }]);
  assert.deepEqual((await incoming).reactions, changed.reactions);

  const removed = await as(bob, () => chatApi.react(direct.id, messageId, ""));
  assert.deepEqual(removed.data.reactions, []);
  await rejects(
    as(bob, () => chatApi.react(direct.id, messageId, "🔥")),
    "VALIDATION_ERROR",
    400,
  );
});
let sc;
await test("privacy: a third doctor cannot read, list, or send into the one-to-one conversation, and receives none of its messages", async () => {
  carol = await newDoctor("Carol");
  await as(carol, () =>
    profileApi.update({ whatsapp: { sameAsPhone: true, number: "" } }),
  );
  sc = await connect(carol);
  let leaked = false;
  sc.on("message:new", (payload) => {
    if (payload.conversationId === direct.id) leaked = true;
  });
  await rejects(
    as(carol, () => chatApi.conversation(direct.id)),
    "NOT_FOUND",
    404,
  );
  await rejects(
    as(carol, () => chatApi.messages(direct.id, { limit: 30 })),
    "NOT_FOUND",
    404,
  );
  await rejects(
    as(carol, () => chatApi.send(direct.id, "let me in", newClientId())),
    "NOT_FOUND",
    404,
  );
  await rejects(
    emitWithAck(sc, "message:send", {
      conversationId: direct.id,
      body: "let me in",
      clientId: newClientId(),
    }),
    "NOT_FOUND",
  );
  await rejects(
    as(carol, () => chatApi.markRead(direct.id)),
    "NOT_FOUND",
    404,
  );
  await emitWithAck(sa, "message:send", {
    conversationId: direct.id,
    body: "Private line",
    clientId: newClientId(),
  });
  await wait(600);
  assert.equal(
    leaked,
    false,
    "a private message reached a socket outside the conversation",
  );
  const hers = await as(carol, () => chatApi.conversations());
  assert.ok(!hers.data.some((c) => c.id === direct.id));
});
await test("malformed and forged socket events are answered with errors, not acted on", async () => {
  await rejects(
    emitWithAck(sc, "message:send", { conversationId: "nope", body: "x" }),
    "VALIDATION_ERROR",
  );
  await rejects(
    emitWithAck(sc, "message:send", { conversationId: group.id, body: "   " }),
    "VALIDATION_ERROR",
  );
  // A forged sender id is simply ignored: the server uses the session's doctor.
  const forged = await emitWithAck(sc, "message:send", {
    conversationId: group.id,
    body: "I am Carol",
    clientId: newClientId(),
    sender: alice.id,
    senderId: alice.id,
  });
  assert.equal(forged.message.sender.id, carol.id);
});
await test("history is paginated: newest page first, older pages by cursor, nothing repeated", async () => {
  const fresh = (await as(carol, () => chatApi.openDirect(alice.id))).data;
  for (let i = 1; i <= 35; i += 1)
    await as(carol, () => chatApi.send(fresh.id, `m${i}`, newClientId()));
  const page1 = await as(alice, () =>
    chatApi.messages(fresh.id, { limit: 30 }),
  );
  assert.equal(page1.data.length, 30);
  assert.equal(page1.meta.hasMore, true);
  assert.equal(page1.data[29].body, "m35");
  const page2 = await as(alice, () =>
    chatApi.messages(fresh.id, { before: page1.meta.nextBefore, limit: 30 }),
  );
  assert.deepEqual(
    page2.data.map((m) => m.body),
    ["m1", "m2", "m3", "m4", "m5"],
  );
  assert.equal(page2.meta.hasMore, false);
  assert.equal(
    new Set([...page1.data, ...page2.data].map((m) => m.id)).size,
    35,
  );
});
await test("reconnection: messages sent while a doctor was offline are there after reconnecting, once", async () => {
  const seenLive = [];
  sb.on(
    "message:new",
    (payload) =>
      payload.conversationId === direct.id && seenLive.push(payload.message.id),
  );
  sb.io.engine.close(); // the connection drops (no clean disconnect)
  await wait(300);
  assert.equal(sb.connected, false);
  const missed = await emitWithAck(sa, "message:send", {
    conversationId: direct.id,
    body: "Sent while you were offline",
    clientId: newClientId(),
  });
  await nextEvent(sb, "ready", 15000); // the client reconnects by itself and the server re-joins its rooms
  const page = await as(bob, () => chatApi.messages(direct.id, { limit: 30 })); // what the app does on "ready"
  assert.equal(page.data.filter((m) => m.id === missed.message.id).length, 1);
  const incoming = nextEvent(sb, "message:new");
  const live = await emitWithAck(sa, "message:send", {
    conversationId: direct.id,
    body: "And live again",
    clientId: newClientId(),
  });
  assert.equal(
    (await incoming).message.id,
    live.message.id,
    "live delivery works again after reconnecting",
  );
});
await test("one-to-one chat needs a WhatsApp number on the caller’s own profile (current server rule)", async () => {
  dave = await newDoctor("Dave");
  await rejects(
    as(dave, () => chatApi.openDirect(alice.id)),
    "WHATSAPP_REQUIRED",
    403,
  );
  const groups = await as(dave, () => chatApi.conversations("GROUP"));
  const sent = await as(dave, () =>
    chatApi.send(groups.data[0].id, "Hello from Dave", newClientId()),
  );
  assert.ok(sent.data.id, "group chat does not need a WhatsApp number");
  const peer = (await as(alice, () => doctorsApi.get(dave.id))).data;
  assert.equal(
    peer.contact.whatsapp,
    undefined,
    "no WhatsApp action for a doctor without a number",
  );
});
await test("sending too fast is rate limited (shared by REST and sockets)", async () => {
  const eve = await newDoctor("Eve");
  const groups = await as(eve, () => chatApi.conversations("GROUP"));
  let limited = null;
  for (let i = 0; i < 70 && !limited; i += 1) {
    await as(eve, () =>
      chatApi.send(groups.data[0].id, `burst ${i}`, newClientId()),
    ).catch((err) => {
      limited = err;
    });
  }
  assert.ok(
    limited && limited.code === "RATE_LIMITED" && limited.status === 429,
    `got ${limited && limited.code}`,
  );
});
await test("logging out closes that doctor’s live connection", async () => {
  const closed = nextEvent(sc, "disconnect", 5000);
  await as(carol, () => api.post("/auth/logout", {}));
  assert.equal(await closed, "io server disconnect");
  await rejects(
    as(carol, () => chatApi.conversations()),
    "SESSION_EXPIRED",
    401,
  );
});

for (const socket of [sa, sb, sc]) if (socket) socket.disconnect();

const failed = results.filter((r) => !r[0]);
console.log(
  `\n${results.length - failed.length} passed, ${failed.length} failed`,
);
process.exit(failed.length ? 1 : 0);
