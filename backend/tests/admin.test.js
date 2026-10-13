const request = require("supertest");
const cloudinaryMock = require("cloudinary");
const User = require("../src/models/User");
const Post = require("../src/models/Post");
const Comment = require("../src/models/Comment");
const Like = require("../src/models/Like");
const Vote = require("../src/models/Vote");
const Rsvp = require("../src/models/Rsvp");
const Media = require("../src/models/Media");
const Session = require("../src/models/Session");
const Notification = require("../src/models/Notification");
const AuditLog = require("../src/models/AuditLog");
const { ROLES } = require("../src/config/constants");
const {
  setupTestApp,
  registerDoctor,
  createAdmin,
  createClient,
  PNG,
  PASSWORD,
  inFuture,
} = require("./helpers/harness");

const ctx = setupTestApp();

let admin;

beforeAll(async () => {
  admin = await createAdmin(ctx.app);
});

describe("access control", () => {
  const ID = "64b7f0f0f0f0f0f0f0f0f0f0";
  const routes = [
    ["get", "/api/v1/admin/stats"],
    ["get", "/api/v1/admin/doctors"],
    ["get", `/api/v1/admin/doctors/${ID}`],
    ["patch", `/api/v1/admin/doctors/${ID}/status`, { status: "SUSPENDED" }],
    ["patch", `/api/v1/admin/doctors/${ID}/visibility`, { featured: true }],
    ["delete", `/api/v1/admin/doctors/${ID}`],
    ["get", "/api/v1/admin/moderation/posts"],
    ["delete", `/api/v1/admin/moderation/posts/${ID}`],
    ["get", "/api/v1/admin/reports"],
    ["patch", `/api/v1/admin/reports/${ID}`, { status: "RESOLVED" }],
    ["get", "/api/v1/admin/audit-logs"],
  ];

  test("anonymous visitors get 401 and doctors get 403 on every admin route", async () => {
    const doctor = await registerDoctor(ctx.app);
    for (const [method, path, body] of routes) {
      const anonymous = await request(ctx.app)[method](path).send(body);
      expect([path, anonymous.status]).toEqual([path, 401]);
      const asDoctor = await doctor[method](path, body);
      expect([path, asDoctor.status]).toEqual([path, 403]);
    }
  });

  test("there are exactly two roles and no super-admin", async () => {
    expect(Object.values(ROLES).sort()).toEqual(["ADMIN", "DOCTOR"]);
    const invalid = new User({
      role: "SUPER_ADMIN",
      name: "Nobody",
      email: "x@example.com",
      phone: "+911234567890",
      passwordHash: "x",
    });
    await expect(invalid.validate()).rejects.toThrow(/role/);
    expect((await request(ctx.app).get("/api/v1/super-admin")).status).toBe(
      404,
    );
    expect((await admin.get("/api/v1/superadmin/stats")).status).toBe(404);
  });

  test("a doctor cannot make themselves an admin after registration", async () => {
    const doctor = await registerDoctor(ctx.app);
    await doctor.patch("/api/v1/doctors/me", { role: "ADMIN" });
    const stored = await User.findById(doctor.user.id);
    expect(stored.role).toBe("DOCTOR");
    // The role field is immutable at the model level as well.
    stored.role = "ADMIN";
    await stored.save();
    expect((await User.findById(doctor.user.id)).role).toBe("DOCTOR");
  });
});

describe("dashboard statistics", () => {
  test("counts come from real data", async () => {
    const before = (await admin.get("/api/v1/admin/stats")).body.data;
    const doctor = await registerDoctor(ctx.app);
    await doctor.post("/api/v1/posts", { body: "Post one" });
    await doctor.post("/api/v1/posts", { body: "Post two" });
    await doctor.post("/api/v1/polls", {
      question: "A poll question?",
      options: ["A", "B"],
      endsAt: inFuture(3),
    });

    const after = (await admin.get("/api/v1/admin/stats")).body.data;
    expect(after.doctors.active).toBe(before.doctors.active + 1);
    expect(after.content.posts).toBe(before.content.posts + 2);
    expect(after.content.polls).toBe(before.content.polls + 1);
    expect(after.hiddenLegacyItems).toBe(0); // nothing waits for approval
    expect(Object.keys(after.content).sort()).toEqual([
      "blogs",
      "comments",
      "events",
      "memories",
      "polls",
      "posts",
      "visit-plans",
    ]);
  });
});

describe("doctor management", () => {
  test("lists, searches and filters doctors (admins themselves are not listed)", async () => {
    const doctor = await registerDoctor(ctx.app, {
      name: "Dr Searchable Unique",
      specialization: "Dermatology",
    });
    const all = await admin.get("/api/v1/admin/doctors?limit=50");
    expect(all.body.data.every((d) => d.role === "DOCTOR")).toBe(true);

    const byName = await admin.get("/api/v1/admin/doctors?q=searchable");
    expect(byName.body.data.map((d) => d.id)).toEqual([doctor.user.id]);
    expect(byName.body.data[0].email).toBe(doctor.credentials.email);

    const detail = await admin.get(`/api/v1/admin/doctors/${doctor.user.id}`);
    expect(detail.body.data.contentCounts).toMatchObject({ post: 0, blog: 0 });
    expect(JSON.stringify(detail.body)).not.toContain("passwordHash");

    expect(
      (await admin.get("/api/v1/admin/doctors?status=SUSPENDED")).body.data.map(
        (d) => d.id,
      ),
    ).not.toContain(doctor.user.id);
  });

  test("suspension is audited, locks the account at once and can be reversed", async () => {
    const doctor = await registerDoctor(ctx.app);
    const suspended = await admin.patch(
      `/api/v1/admin/doctors/${doctor.user.id}/status`,
      { status: "SUSPENDED", reason: "Spam" },
    );
    expect(suspended.body.data).toMatchObject({
      status: "SUSPENDED",
      suspension: { reason: "Spam" },
    });
    expect((await doctor.get("/api/v1/auth/me")).body.error.code).toBe(
      "ACCOUNT_SUSPENDED",
    );
    expect(
      (await admin.get("/api/v1/admin/stats")).body.data.doctors.suspended,
    ).toBeGreaterThanOrEqual(1);
    expect(
      await AuditLog.countDocuments({
        action: "DOCTOR_SUSPENDED",
        targetId: doctor.user.id,
      }),
    ).toBe(1);
    expect(
      await Notification.countDocuments({
        user: doctor.user.id,
        type: "ACCOUNT_STATUS",
      }),
    ).toBe(1);

    // Suspended doctors disappear from the member directory.
    const viewer = await registerDoctor(ctx.app);
    expect(
      (await viewer.get("/api/v1/doctors?limit=48")).body.data.map((d) => d.id),
    ).not.toContain(doctor.user.id);
    expect((await viewer.get(`/api/v1/doctors/${doctor.user.id}`)).status).toBe(
      404,
    );

    await admin.patch(`/api/v1/admin/doctors/${doctor.user.id}/status`, {
      status: "ACTIVE",
    });
    expect((await User.findById(doctor.user.id)).status).toBe("ACTIVE");
    expect(await Session.countDocuments({ user: doctor.user.id })).toBe(0); // must sign in again
  });

  test("the admin account cannot be suspended or deleted through doctor management", async () => {
    const adminId = admin.user.id;
    expect(
      (
        await admin.patch(`/api/v1/admin/doctors/${adminId}/status`, {
          status: "SUSPENDED",
        })
      ).status,
    ).toBe(404);
    expect(
      (await admin.delete(`/api/v1/admin/doctors/${adminId}`)).status,
    ).toBe(404);
    expect((await User.findById(adminId)).status).toBe("ACTIVE");
  });

  test("deleting a doctor removes the account and everything they own, and fixes counters", async () => {
    cloudinaryMock.__reset();
    const leaving = await registerDoctor(ctx.app, { name: "Dr Leaving Soon" });
    const staying = await registerDoctor(ctx.app, { name: "Dr Staying Here" });

    // Content owned by the doctor who will be deleted.
    const upload = await leaving.upload("post", PNG);
    const ownPost = await leaving.post("/api/v1/posts", {
      body: "My own post",
      mediaIds: [upload.body.data.id],
    });
    const photo = await leaving.upload("profile", PNG);
    await leaving.put("/api/v1/doctors/me/photo", {
      mediaId: photo.body.data.id,
    });

    // Their footprint on someone else's content.
    const otherPost = await staying.post("/api/v1/posts", {
      body: "A post by the doctor who stays",
    });
    const otherPostId = otherPost.body.data.id;
    await leaving.put(`/api/v1/likes/post/${otherPostId}`);
    await leaving.post("/api/v1/comments", {
      targetType: "post",
      targetId: otherPostId,
      body: "Great news!",
    });

    const poll = await staying.post("/api/v1/polls", {
      question: "A poll by the staying doctor?",
      options: ["A", "B"],
      endsAt: inFuture(5),
      resultsVisibility: "ALWAYS",
    });
    await leaving.post(`/api/v1/polls/${poll.body.data.id}/vote`, {
      optionIds: [poll.body.data.options[0].id],
    });

    const event = await staying.post("/api/v1/events", {
      title: "Dinner in town",
      description: "Dinner for those nearby.",
      eventType: "DINNER",
      city: "Cuttack",
      startsAt: inFuture(9),
    });
    await leaving.put(`/api/v1/events/${event.body.data.id}/rsvp`, {
      status: "GOING",
    });

    // And the staying doctor liked the leaving doctor's post.
    await staying.put(`/api/v1/likes/post/${ownPost.body.data.id}`);

    const before = await staying.get(`/api/v1/posts/${otherPostId}`);
    expect(before.body.data).toMatchObject({ likeCount: 1, commentCount: 1 });

    const id = leaving.user.id;
    const removed = await admin.delete(`/api/v1/admin/doctors/${id}`, {
      reason: "Requested account removal",
    });
    expect(removed.status).toBe(200);

    expect(await User.findById(id)).toBeNull();
    expect(await Session.countDocuments({ user: id })).toBe(0);
    expect(await Post.countDocuments({ author: id })).toBe(0);
    expect(await Comment.countDocuments({ author: id })).toBe(0);
    expect(await Like.countDocuments({ user: id })).toBe(0);
    expect(await Like.countDocuments({ target: ownPost.body.data.id })).toBe(0);
    expect(await Vote.countDocuments({ user: id })).toBe(0);
    expect(await Rsvp.countDocuments({ user: id })).toBe(0);
    expect(await Notification.countDocuments({ user: id })).toBe(0);
    expect(await Media.countDocuments({ owner: id })).toBe(0);
    expect(cloudinaryMock.__state.destroyed.length).toBeGreaterThanOrEqual(2); // post image + profile photo

    // Counters on other people's content were corrected.
    const after = await staying.get(`/api/v1/posts/${otherPostId}`);
    expect(after.body.data).toMatchObject({ likeCount: 0, commentCount: 0 });
    expect(
      (await staying.get(`/api/v1/polls/${poll.body.data.id}`)).body.data
        .totalVoters,
    ).toBe(0);
    expect(
      (await staying.get(`/api/v1/events/${event.body.data.id}`)).body.data.rsvp
        .going,
    ).toBe(0);

    // The account is gone for good; the audit trail keeps a minimal record.
    expect((await leaving.get("/api/v1/auth/me")).status).toBe(401);
    const login = await createClient(ctx.app).post("/api/v1/auth/login", {
      identifier: leaving.credentials.email,
      password: PASSWORD,
    });
    expect(login.status).toBe(401);
    const log = await AuditLog.findOne({
      action: "DOCTOR_DELETED",
      targetId: id,
    });
    expect(log.summary).toContain("Dr Leaving Soon");
    expect(JSON.stringify(log.toObject())).not.toContain(
      leaving.credentials.email,
    );

    // The same email can register again afterwards.
    await registerDoctor(ctx.app, { email: leaving.credentials.email });
  });
});

describe("audit log", () => {
  test("records sensitive admin actions and is readable only by admins", async () => {
    const res = await admin.get("/api/v1/admin/audit-logs?limit=50");
    expect(res.status).toBe(200);
    const actions = res.body.data.map((l) => l.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "DOCTOR_SUSPENDED",
        "DOCTOR_REACTIVATED",
        "DOCTOR_DELETED",
        "ADMIN_BOOTSTRAPPED",
      ]),
    );
    expect(res.body.meta.total).toBeGreaterThanOrEqual(actions.length);
  });
});
