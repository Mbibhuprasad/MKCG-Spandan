// Must be set before the app (and its cached environment) is loaded.
process.env.ADMIN_REGISTER_KEY = 'test-admin-register-key-2026';

const request = require('supertest');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const { setupTestApp, createClient, registerDoctor, ADMIN_PASSWORD } = require('./helpers/harness');

const ctx = setupTestApp();

const KEY = process.env.ADMIN_REGISTER_KEY;
let counter = 0;

function adminPayload(overrides = {}) {
  counter += 1;
  return {
    name: `Admin Test ${counter}`,
    email: `admin${counter}.register@example.com`,
    phone: `+9197000000${String(counter).padStart(2, '0')}`,
    password: ADMIN_PASSWORD,
    confirmPassword: ADMIN_PASSWORD,
    registrationKey: KEY,
    ...overrides,
  };
}

describe('admin registration', () => {
  test('creates an administrator with the correct key and signs them in', async () => {
    const client = createClient(ctx.app);
    const payload = adminPayload();
    const res = await client.post('/api/v1/admin-register', payload);

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ role: 'ADMIN', status: 'ACTIVE', email: payload.email });
    expect(res.body.data.csrfToken).toEqual(expect.any(String));
    expect(res.body.data.token).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(KEY);

    const stored = await User.findOne({ email: payload.email }).select('+passwordHash');
    expect(stored.role).toBe('ADMIN');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored.visibility.directory).toBe(false);
    expect(await AuditLog.countDocuments({ action: 'ADMIN_REGISTERED', targetId: String(stored._id) })).toBe(1);

    // The new session really is an admin session.
    expect((await client.get('/api/v1/admin/stats')).status).toBe(200);
  });

  test('refuses a missing or wrong registration key and creates nothing', async () => {
    const before = await User.countDocuments({ role: 'ADMIN' });

    const wrong = await createClient(ctx.app).post('/api/v1/admin-register', adminPayload({ registrationKey: 'not-the-right-key-at-all' }));
    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe('INVALID_REGISTRATION_KEY');
    expect(wrong.headers['set-cookie']).toBeUndefined();

    const missing = adminPayload();
    delete missing.registrationKey;
    const none = await createClient(ctx.app).post('/api/v1/admin-register', missing);
    expect(none.status).toBe(400);
    expect(none.body.error.details.registrationKey).toEqual(expect.any(String));

    expect(await User.countDocuments({ role: 'ADMIN' })).toBe(before);
  });

  test('applies the admin password rule and checks the confirmation', async () => {
    const weak = await createClient(ctx.app).post(
      '/api/v1/admin-register',
      adminPayload({ password: 'Short2026', confirmPassword: 'Short2026' })
    );
    expect(weak.status).toBe(400);
    expect(weak.body.error.details.password).toMatch(/12/);

    const mismatch = await createClient(ctx.app).post('/api/v1/admin-register', adminPayload({ confirmPassword: 'SomethingElse2026' }));
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.details.confirmPassword).toBe('Passwords do not match.');
  });

  test('never promotes an existing doctor account', async () => {
    const doctor = await registerDoctor(ctx.app);
    const res = await createClient(ctx.app).post('/api/v1/admin-register', adminPayload({ email: doctor.credentials.email }));
    expect(res.status).toBe(409);
    expect(res.body.error.details.email).toEqual(expect.any(String));
    expect((await User.findOne({ email: doctor.credentials.email })).role).toBe('DOCTOR');
  });

  test('mobile clients receive a bearer token that works on admin routes', async () => {
    const res = await request(ctx.app).post('/api/v1/admin-register').set('X-Client-Type', 'mobile').send(adminPayload());
    expect(res.status).toBe(201);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.headers['set-cookie']).toBeUndefined();

    const stats = await request(ctx.app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${res.body.data.token}`);
    expect(stats.status).toBe(200);
  });
});

describe('admin login', () => {
  test('signs an administrator in by email or phone', async () => {
    const payload = adminPayload();
    await createClient(ctx.app).post('/api/v1/admin-register', payload);

    const byEmail = createClient(ctx.app);
    const res = await byEmail.post('/api/v1/admin-login', { identifier: payload.email.toUpperCase(), password: ADMIN_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.headers['set-cookie'].some((c) => c.startsWith('mkcg_session='))).toBe(true);
    expect((await byEmail.get('/api/v1/admin/stats')).status).toBe(200);

    const byPhone = await createClient(ctx.app).post('/api/v1/admin-login', { identifier: payload.phone, password: ADMIN_PASSWORD });
    expect(byPhone.status).toBe(200);
  });

  test('rejects wrong passwords and unknown accounts with the same answer', async () => {
    const payload = adminPayload();
    await createClient(ctx.app).post('/api/v1/admin-register', payload);

    const wrong = await createClient(ctx.app).post('/api/v1/admin-login', { identifier: payload.email, password: 'WrongPassword2026' });
    const unknown = await createClient(ctx.app).post('/api/v1/admin-login', { identifier: 'nobody.here@example.com', password: ADMIN_PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
    expect(wrong.headers['set-cookie']).toBeUndefined();
  });

  test('does not sign a doctor in', async () => {
    const doctor = await registerDoctor(ctx.app);
    const res = await createClient(ctx.app).post('/api/v1/admin-login', {
      identifier: doctor.credentials.email,
      password: doctor.credentials.password,
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_AN_ADMIN');
    expect(res.headers['set-cookie']).toBeUndefined();

    // A doctor with the wrong password learns nothing about the account's role.
    const wrong = await createClient(ctx.app).post('/api/v1/admin-login', { identifier: doctor.credentials.email, password: 'WrongPassword2026' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('refuses a suspended administrator', async () => {
    const payload = adminPayload();
    await createClient(ctx.app).post('/api/v1/admin-register', payload);
    await User.updateOne({ email: payload.email }, { status: 'SUSPENDED' });

    const res = await createClient(ctx.app).post('/api/v1/admin-login', { identifier: payload.email, password: ADMIN_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });
});
