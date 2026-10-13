const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../src/models/User");
const Session = require("../src/models/Session");
const { POLICY_VERSION } = require("../src/config/constants");
const {
  setupTestApp,
  createClient,
  doctorPayload,
  registerDoctor,
  loginAs,
  createAdmin,
  ORIGIN,
  PASSWORD,
} = require("./helpers/harness");

const ctx = setupTestApp();

describe("doctor registration", () => {
  test("registers a doctor, signs them in automatically and needs no approval", async () => {
    const client = createClient(ctx.app);
    const payload = doctorPayload({
      specialization: "Cardiology",
      city: "Bhubaneswar",
    });
    const res = await client.post("/api/v1/auth/register", payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      role: "DOCTOR",
      status: "ACTIVE",
      email: payload.email,
      name: payload.name,
    });
    expect(res.body.data.user.profile.specialization).toBe("Cardiology");
    expect(res.body.data.csrfToken).toEqual(expect.any(String));
    // The web flow never exposes the token to JavaScript.
    expect(res.body.data.token).toBeUndefined();

    const cookie = res.headers["set-cookie"].find((c) =>
      c.startsWith("mkcg_session="),
    );
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    // Immediately usable: session restoration and the dashboard both work.
    const me = await client.get("/api/v1/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(payload.email);

    const dashboard = await client.get("/api/v1/dashboard/summary");
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.profileCompletion.isComplete).toBe(false);
  });

  test("stores a hash (never the password) and the accepted policy version", async () => {
    const client = await registerDoctor(ctx.app);
    const stored = await User.findOne({
      email: client.credentials.email,
    }).select("+passwordHash");
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored.passwordHash).not.toContain(PASSWORD);
    expect(stored.policyAcceptance.version).toBe(POLICY_VERSION);
    expect(stored.policyAcceptance.acceptedAt).toBeInstanceOf(Date);

    const body = JSON.stringify((await client.get("/api/v1/auth/me")).body);
    expect(body).not.toContain("passwordHash");
    expect(body).not.toContain(stored.passwordHash);
  });

  test("public registration can never create an admin or set account status", async () => {
    const client = createClient(ctx.app);
    const payload = doctorPayload({
      role: "ADMIN",
      status: "SUSPENDED",
      featured: true,
      isAdmin: true,
    });
    const res = await client.post("/api/v1/auth/register", payload);
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("DOCTOR");
    expect(res.body.data.user.status).toBe("ACTIVE");

    const stored = await User.findOne({ email: payload.email });
    expect(stored.role).toBe("DOCTOR");
    expect(stored.featured).toBe(false);

    client.csrf = res.body.data.csrfToken;
    const admin = await client.get("/api/v1/admin/stats");
    expect(admin.status).toBe(403);
  });

  test("normalises email and phone and rejects duplicates of either", async () => {
    const first = doctorPayload({
      email: "  Asha.Rao@Example.COM ",
      phone: "098765 43210",
    });
    const created = await createClient(ctx.app).post(
      "/api/v1/auth/register",
      first,
    );
    expect(created.status).toBe(201);
    expect(created.body.data.user.email).toBe("asha.rao@example.com");
    expect(created.body.data.user.phone).toBe("+919876543210");

    const sameEmail = await createClient(ctx.app).post(
      "/api/v1/auth/register",
      doctorPayload({ email: "ASHA.RAO@example.com" }),
    );
    expect(sameEmail.status).toBe(409);
    expect(sameEmail.body.error.details.email).toBeDefined();

    const samePhone = await createClient(ctx.app).post(
      "/api/v1/auth/register",
      doctorPayload({ phone: "+91 98765-43210" }),
    );
    expect(samePhone.status).toBe(409);
    expect(samePhone.body.error.details.phone).toBeDefined();
  });

  test("validates input on the server", async () => {
    const res = await createClient(ctx.app).post("/api/v1/auth/register", {
      name: "A",
      email: "not-an-email",
      phone: "12",
      password: "short",
      confirmPassword: "different",
      acceptPolicies: false,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.error.details)).toEqual(
      expect.arrayContaining([
        "name",
        "email",
        "phone",
        "password",
        "acceptPolicies",
      ]),
    );
    expect(await User.countDocuments({ email: "not-an-email" })).toBe(0);
  });
});

describe("login, logout and session handling", () => {
  test("a doctor can log out and log in again with email or phone", async () => {
    const client = await registerDoctor(ctx.app);

    const out = await client.post("/api/v1/auth/logout");
    expect(out.status).toBe(200);
    expect((await client.get("/api/v1/auth/me")).status).toBe(401);

    const byEmail = await loginAs(
      ctx.app,
      client.credentials.email.toUpperCase(),
      PASSWORD,
    );
    expect(byEmail.user.email).toBe(client.credentials.email);

    const byPhone = await loginAs(ctx.app, client.credentials.phone, PASSWORD);
    expect(byPhone.user.email).toBe(client.credentials.email);
    expect((await byPhone.get("/api/v1/auth/me")).status).toBe(200);
  });

  test("logout always clears the cookie and ends the session, even without the CSRF token", async () => {
    const client = await registerDoctor(ctx.app);
    const res = await client.agent
      .post("/api/v1/auth/logout")
      .set("Origin", ORIGIN)
      .send({});
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"].join(";")).toMatch(/mkcg_session=;/);
    expect(await Session.countDocuments({ user: client.user.id })).toBe(0);

    // Logging out when nobody is signed in is harmless.
    expect(
      (await createClient(ctx.app).post("/api/v1/auth/logout")).status,
    ).toBe(200);
    // A cross-site logout attempt is still stopped by the origin check.
    const other = await registerDoctor(ctx.app);
    const forged = await other.agent
      .post("/api/v1/auth/logout")
      .set("Origin", "https://evil.example")
      .send({});
    expect(forged.status).toBe(403);
    expect((await other.get("/api/v1/auth/me")).status).toBe(200);
  });

  test("rejects wrong passwords without revealing whether the account exists", async () => {
    const client = await registerDoctor(ctx.app);
    const wrong = await createClient(ctx.app).post("/api/v1/auth/login", {
      identifier: client.credentials.email,
      password: "WrongPassword1",
    });
    const unknown = await createClient(ctx.app).post("/api/v1/auth/login", {
      identifier: "nobody.here@example.com",
      password: "WrongPassword1",
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
    expect(wrong.headers["set-cookie"]).toBeUndefined();
  });

  test("logging out invalidates the session on the server, not just the cookie", async () => {
    const client = await registerDoctor(ctx.app);
    const loginRes = await request(ctx.app)
      .post("/api/v1/auth/login")
      .set("X-Client-Type", "mobile")
      .send({ identifier: client.credentials.email, password: PASSWORD });
    const token = loginRes.body.data.token;
    expect(token).toEqual(expect.any(String));
    expect(loginRes.headers["set-cookie"]).toBeUndefined();

    const authed = await request(ctx.app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(authed.status).toBe(200);

    await request(ctx.app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    const after = await request(ctx.app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  test("GET /auth/session reports the state without failing for signed-out visitors", async () => {
    const anonymous = await request(ctx.app).get("/api/v1/auth/session");
    expect(anonymous.status).toBe(200);
    expect(anonymous.body.data).toEqual({
      authenticated: false,
      reason: "SIGNED_OUT",
      message: "",
    });

    const client = await registerDoctor(ctx.app);
    const signedIn = await client.get("/api/v1/auth/session");
    expect(signedIn.body.data.authenticated).toBe(true);
    expect(signedIn.body.data.user.email).toBe(client.credentials.email);
    expect(signedIn.body.data.csrfToken).toBe(client.csrf);
    expect(JSON.stringify(signedIn.body)).not.toContain("passwordHash");

    // A stale cookie is reported as signed out and cleared.
    await Session.deleteMany({ user: client.user.id });
    const stale = await client.get("/api/v1/auth/session");
    expect(stale.body.data.authenticated).toBe(false);
    expect(stale.headers["set-cookie"].join(";")).toMatch(/mkcg_session=;/);
  });

  test("rejects forged, tampered and expired tokens", async () => {
    const client = await registerDoctor(ctx.app);
    const session = await Session.findOne({ user: client.user.id });

    const forged = jwt.sign(
      { sub: client.user.id, sid: String(session._id) },
      "another-secret-another-secret-another",
    );
    expect(
      (
        await request(ctx.app)
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${forged}`)
      ).status,
    ).toBe(401);

    const expired = jwt.sign(
      { sub: client.user.id, sid: String(session._id) },
      process.env.JWT_SECRET,
      { expiresIn: -10 },
    );
    expect(
      (
        await request(ctx.app)
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${expired}`)
      ).status,
    ).toBe(401);

    const unsigned = jwt.sign(
      { sub: client.user.id, sid: String(session._id) },
      "",
      { algorithm: "none" },
    );
    expect(
      (
        await request(ctx.app)
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${unsigned}`)
      ).status,
    ).toBe(401);

    // A valid signature is still useless once the server-side session is gone.
    const valid = jwt.sign(
      { sub: client.user.id, sid: String(session._id) },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    expect(
      (
        await request(ctx.app)
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${valid}`)
      ).status,
    ).toBe(200);
    await Session.deleteOne({ _id: session._id });
    expect(
      (
        await request(ctx.app)
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${valid}`)
      ).status,
    ).toBe(401);
  });

  test("changing the password signs out other sessions and replaces the old password", async () => {
    const first = await registerDoctor(ctx.app);
    const second = await loginAs(ctx.app, first.credentials.email, PASSWORD);

    const wrong = await first.patch("/api/v1/auth/password", {
      currentPassword: "NotMyPassword1",
      newPassword: "BrandNewPass2027",
    });
    expect(wrong.status).toBe(400);

    const changed = await first.patch("/api/v1/auth/password", {
      currentPassword: PASSWORD,
      newPassword: "BrandNewPass2027",
    });
    expect(changed.status).toBe(200);
    expect((await first.get("/api/v1/auth/me")).status).toBe(200);
    expect((await second.get("/api/v1/auth/me")).status).toBe(401);

    const oldLogin = await createClient(ctx.app).post("/api/v1/auth/login", {
      identifier: first.credentials.email,
      password: PASSWORD,
    });
    expect(oldLogin.status).toBe(401);
    await loginAs(ctx.app, first.credentials.email, "BrandNewPass2027");
  });
});

describe("CSRF and origin protection", () => {
  test("cookie-authenticated changes need the session CSRF token", async () => {
    const client = await registerDoctor(ctx.app);

    const missing = await client.agent
      .patch("/api/v1/doctors/me")
      .set("Origin", ORIGIN)
      .send({ name: "Changed Name" });
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe("CSRF_INVALID");

    const wrong = await client.agent
      .patch("/api/v1/doctors/me")
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", "f".repeat(64))
      .send({ name: "Changed Name" });
    expect(wrong.status).toBe(403);

    // A token from a different session is not accepted either.
    const other = await registerDoctor(ctx.app);
    const crossed = await client.agent
      .patch("/api/v1/doctors/me")
      .set("Origin", ORIGIN)
      .set("X-CSRF-Token", other.csrf)
      .send({ name: "Changed Name" });
    expect(crossed.status).toBe(403);

    const ok = await client.patch("/api/v1/doctors/me", {
      name: "Dr Correct Name",
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.name).toBe("Dr Correct Name");
  });

  test("state-changing requests from another origin are refused", async () => {
    const client = await registerDoctor(ctx.app);
    const res = await client.agent
      .patch("/api/v1/doctors/me")
      .set("Origin", "https://evil.example")
      .set("X-CSRF-Token", client.csrf)
      .send({ name: "Hacked" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  test("CORS only allows the configured frontend origin", async () => {
    const allowed = await request(ctx.app)
      .get("/api/v1/health")
      .set("Origin", ORIGIN);
    expect(allowed.headers["access-control-allow-origin"]).toBe(ORIGIN);
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const denied = await request(ctx.app)
      .get("/api/v1/health")
      .set("Origin", "https://evil.example");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("suspended accounts", () => {
  test("a suspended doctor is signed out, cannot log in and cannot use protected features", async () => {
    const admin = await createAdmin(ctx.app);
    const doctor = await registerDoctor(ctx.app);
    expect((await doctor.get("/api/v1/posts")).status).toBe(200);

    const suspended = await admin.patch(
      `/api/v1/admin/doctors/${doctor.user.id}/status`,
      {
        status: "SUSPENDED",
        reason: "Repeated guideline violations",
      },
    );
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.status).toBe("SUSPENDED");

    // The existing session is refused at once, with a reason the UI can show.
    const me = await doctor.get("/api/v1/auth/me");
    expect(me.status).toBe(403);
    expect(me.body.error.code).toBe("ACCOUNT_SUSPENDED");
    expect((await doctor.get("/api/v1/posts")).status).toBe(403);
    expect(
      (await doctor.post("/api/v1/posts", { body: "Hello everyone" })).status,
    ).toBe(403);
    expect((await doctor.get("/api/v1/dashboard/summary")).status).toBe(403);
    const probe = await doctor.get("/api/v1/auth/session");
    expect(probe.body.data).toMatchObject({
      authenticated: false,
      reason: "ACCOUNT_SUSPENDED",
    });

    // Correct credentials are refused while suspended.
    const login = await createClient(ctx.app).post("/api/v1/auth/login", {
      identifier: doctor.credentials.email,
      password: PASSWORD,
    });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe("ACCOUNT_SUSPENDED");
    expect(login.headers["set-cookie"]).toBeUndefined();

    // Even a still-valid token is refused because status is read from the database.
    const session = await Session.create({
      user: doctor.user.id,
      expiresAt: new Date(Date.now() + 60000),
    });
    const token = jwt.sign(
      { sub: doctor.user.id, sid: String(session._id) },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    const direct = await request(ctx.app)
      .get("/api/v1/posts")
      .set("Authorization", `Bearer ${token}`);
    expect(direct.status).toBe(403);
    expect(direct.body.error.code).toBe("ACCOUNT_SUSPENDED");

    // Reactivation restores access, but sessions from before never come back to life.
    const reactivated = await admin.patch(
      `/api/v1/admin/doctors/${doctor.user.id}/status`,
      { status: "ACTIVE" },
    );
    expect(reactivated.body.data.status).toBe("ACTIVE");
    expect((await doctor.get("/api/v1/auth/me")).status).toBe(401);
    expect(await Session.countDocuments({ user: doctor.user.id })).toBe(0);
    const back = await loginAs(ctx.app, doctor.credentials.email, PASSWORD);
    expect((await back.get("/api/v1/posts")).status).toBe(200);
  });
});
