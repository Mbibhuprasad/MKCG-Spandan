const request = require("supertest");
const User = require("../src/models/User");
const Event = require("../src/models/Event");
const Notification = require("../src/models/Notification");
const { loadEnv } = require("../src/config/env");
const { renderMarkdown } = require("../src/services/markdown.service");
const { normalizePhone } = require("../src/utils/text");
const { sendEventReminders } = require("../src/services/jobs.service");
const {
  setupTestApp,
  registerDoctor,
  createClient,
  ORIGIN,
  LONG_BODY,
  inFuture,
} = require("./helpers/harness");

const ctx = setupTestApp();

describe("injection and input handling", () => {
  test("operator objects cannot be smuggled into queries (NoSQL injection)", async () => {
    await registerDoctor(ctx.app);
    const asObject = await createClient(ctx.app).post("/api/v1/auth/login", {
      identifier: { $gt: "" },
      password: { $gt: "" },
    });
    expect(asObject.status).toBe(400);
    expect(asObject.headers["set-cookie"]).toBeUndefined();

    const nested = await createClient(ctx.app).post("/api/v1/auth/login", {
      identifier: "a@example.com",
      password: "x",
      filter: { $where: "sleep(1000)" },
    });
    expect(nested.status).toBe(400);
    expect(nested.body.error.code).toBe("INVALID_INPUT");

    const doctor = await registerDoctor(ctx.app);
    const update = await doctor.patch("/api/v1/doctors/me", {
      profile: { $set: { role: "ADMIN" } },
    });
    expect(update.status).toBe(400);
    const dotted = await doctor.patch("/api/v1/doctors/me", {
      "profile.city": "X",
    });
    expect(dotted.status).toBe(400);
    expect((await User.findById(doctor.user.id)).role).toBe("DOCTOR");
  });

  test("prototype pollution keys are rejected", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/auth/login")
      .set("Origin", ORIGIN)
      .set("Content-Type", "application/json")
      .send(
        '{"identifier":"a@example.com","password":"x","__proto__":{"isAdmin":true}}',
      );
    expect(res.status).toBe(400);
    expect({}.isAdmin).toBeUndefined();
  });

  test("blog Markdown is rendered to sanitised HTML (XSS)", async () => {
    const hostile = [
      "# Heading",
      '<script>alert("xss")</script>',
      '<img src=x onerror="alert(1)">',
      "[click me](javascript:alert(1))",
      '<a href="javascript:alert(2)">inline</a>',
      '<iframe src="https://evil.example"></iframe>',
      "![tracking pixel](https://evil.example/pixel.png)",
      "[a real link](https://example.org/article)",
    ].join("\n\n");
    const html = renderMarkdown(hostile);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/<iframe/i);
    expect(html).not.toMatch(/onerror\s*=\s*"/i);
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain("<h2>Heading</h2>");
    expect(html).toContain('href="https://example.org/article"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');

    const author = await registerDoctor(ctx.app);
    const created = await author.post("/api/v1/blogs", {
      title: "A post with hostile markup",
      excerpt: "This excerpt is long enough to pass validation rules.",
      body: `${hostile}\n\n${LONG_BODY}`,
      category: "Other",
    });
    expect(created.status).toBe(201);
    const published = await request(ctx.app).get(
      `/api/v1/blogs/slug/${created.body.data.slug}`,
    );
    expect(published.body.data.bodyHtml).not.toMatch(
      /<script|<img|<iframe|href="javascript:/i,
    );
  });

  test("plain-text content is stored as text and returned as JSON, never as HTML", async () => {
    const doctor = await registerDoctor(ctx.app);
    const body = "<script>alert(1)</script> I <3 this batch & its people";
    const res = await doctor.post("/api/v1/posts", { body });
    expect(res.status).toBe(201);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.data.body).toBe(body); // unchanged text; the UI renders it escaped
    const withControl = await doctor.post("/api/v1/posts", {
      body: "null\u0000byte and bell\u0007 removed",
    });
    expect(withControl.body.data.body).toBe("nullbyte and bell removed");
  });

  test("rejects oversized and malformed JSON bodies", async () => {
    const doctor = await registerDoctor(ctx.app);
    const huge = await doctor.post("/api/v1/posts", {
      body: "x".repeat(300 * 1024),
    });
    expect(huge.status).toBe(413);
    const tooLong = await doctor.post("/api/v1/posts", {
      body: "x".repeat(5001),
    });
    expect(tooLong.status).toBe(400);

    const malformed = await request(ctx.app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"identifier": ');
    expect(malformed.status).toBe(400);
    expect(malformed.body.success).toBe(false);
  });

  test("phone normalisation is strict", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("0091 98765 43210")).toBe("+919876543210");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("98765abc43210")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("safe responses and headers", () => {
  test("sets security headers and never caches API responses", async () => {
    const res = await request(ctx.app).get("/api/v1/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  test("unknown routes and unexpected errors return a safe JSON envelope", async () => {
    const missing = await request(ctx.app).get("/api/v1/does-not-exist");
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: expect.any(String) },
    });

    const doctor = await registerDoctor(ctx.app);
    const spy = jest.spyOn(User, "find").mockImplementationOnce(() => {
      throw new Error("connection string mongodb://user:secret@host leaked");
    });
    const res = await doctor.get("/api/v1/doctors");
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toMatch(
      /secret|mongodb:|stack|at Object/,
    );
  });

  test("responses never contain password hashes or session internals", async () => {
    const doctor = await registerDoctor(ctx.app);
    const viewer = await registerDoctor(ctx.app);
    const responses = await Promise.all([
      doctor.get("/api/v1/auth/me"),
      doctor.get("/api/v1/doctors/me"),
      viewer.get(`/api/v1/doctors/${doctor.user.id}`),
      viewer.get("/api/v1/doctors"),
    ]);
    for (const res of responses) {
      expect(JSON.stringify(res.body)).not.toMatch(
        /passwordHash|\$2[aby]\$|"__v"|tokenHash/,
      );
    }
  });
});

describe("environment validation", () => {
  const valid = {
    NODE_ENV: "development",
    MONGODB_URI: "mongodb://127.0.0.1:27017/x",
    JWT_SECRET: "a".repeat(40),
    FRONTEND_URL: "http://localhost:5000",
  };

  test("accepts a valid configuration with sensible defaults", () => {
    const env = loadEnv(valid);
    expect(env.port).toBe(5000);
    expect(env.cookie).toMatchObject({
      name: "mkcg_session",
      sameSite: "lax",
      secure: false,
    });
    expect(env.cloudinary.configured).toBe(false);
  });

  test("fails fast on missing or weak settings, naming the variable but not its value", () => {
    expect(() => loadEnv({ ...valid, MONGODB_URI: "" })).toThrow(/MONGODB_URI/);
    expect(() => loadEnv({ ...valid, FRONTEND_URL: "not a url" })).toThrow(
      /FRONTEND_URL/,
    );
    let message = "";
    try {
      loadEnv({ ...valid, JWT_SECRET: "too-short-secret" });
    } catch (err) {
      message = err.message;
    }
    expect(message).toMatch(/JWT_SECRET/);
    expect(message).not.toContain("too-short-secret");
  });

  test("production requires Cloudinary and secure cookies", () => {
    expect(() => loadEnv({ ...valid, NODE_ENV: "production" })).toThrow(
      /CLOUDINARY/,
    );
    const prod = loadEnv({
      ...valid,
      NODE_ENV: "production",
      CLOUDINARY_CLOUD_NAME: "c",
      CLOUDINARY_API_KEY: "k",
      CLOUDINARY_API_SECRET: "s",
    });
    expect(prod.cookie.secure).toBe(true);
    expect(() =>
      loadEnv({ ...valid, COOKIE_SAMESITE: "none", COOKIE_SECURE: "false" }),
    ).toThrow(/COOKIE_SAMESITE/);
  });
});

describe("notifications", () => {
  test("are private to their owner and support read state", async () => {
    const a = await registerDoctor(ctx.app);
    const b = await registerDoctor(ctx.app);

    const listA = await a.get("/api/v1/notifications");
    expect(listA.body.data.map((n) => n.type)).toEqual(["WELCOME"]);
    expect(listA.body.meta.unreadCount).toBe(1);
    expect(
      (await a.get("/api/v1/notifications/unread-count")).body.data.unreadCount,
    ).toBe(1);

    const id = listA.body.data[0].id;
    expect((await b.patch(`/api/v1/notifications/${id}/read`)).status).toBe(
      404,
    ); // not theirs
    expect(
      (await a.patch(`/api/v1/notifications/${id}/read`)).body.data.read,
    ).toBe(true);
    expect(
      (await a.get("/api/v1/notifications?unread=true")).body.data,
    ).toHaveLength(0);

    const all = await b.patch("/api/v1/notifications/read-all");
    expect(all.body.data.updated).toBe(1);
    expect((await request(ctx.app).get("/api/v1/notifications")).status).toBe(
      401,
    );
  });

  test("event reminders are generated once for attendees", async () => {
    const organiser = await registerDoctor(ctx.app);
    const guest = await registerDoctor(ctx.app);
    const bystander = await registerDoctor(ctx.app);

    const event = await organiser.post("/api/v1/events", {
      title: "Tomorrow evening meetup",
      description: "A short-notice catch-up for those nearby.",
      eventType: "MEETUP",
      city: "Berhampur",
      startsAt: inFuture(1),
    });
    const eventId = event.body.data.id;
    await guest.put(`/api/v1/events/${eventId}/rsvp`, { status: "GOING" });

    await sendEventReminders();
    await Event.updateOne({ _id: eventId }, { $set: { reminderSentAt: null } }); // force a second pass
    await sendEventReminders();

    const count = (user) =>
      Notification.countDocuments({
        user: user.user.id,
        type: "EVENT_REMINDER",
      });
    expect(await count(guest)).toBe(1);
    expect(await count(organiser)).toBe(1);
    expect(await count(bystander)).toBe(0);
  });
});
