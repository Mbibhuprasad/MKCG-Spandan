// Uses real (low) limits. They are set before the app reads its configuration,
// which happens lazily inside setupTestApp().
process.env.RATE_LIMIT_LOGIN_MAX = '4';
process.env.RATE_LIMIT_REGISTER_MAX = '3';

const { setupTestApp, createClient, doctorPayload, registerDoctor, PASSWORD } = require('./helpers/harness');

const ctx = setupTestApp();

describe('rate limiting', () => {
  test('repeated failed logins for one account are throttled', async () => {
    const doctor = await registerDoctor(ctx.app);
    const attempt = (password) =>
      createClient(ctx.app).post('/api/v1/auth/login', { identifier: doctor.credentials.email, password });

    for (let i = 0; i < 4; i += 1) {
      expect((await attempt('WrongPassword1')).status).toBe(401);
    }
    const blocked = await attempt('WrongPassword1');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');

    // Even the correct password is refused while the limit is in force…
    expect((await attempt(PASSWORD)).status).toBe(429);

    // …but a different account from the same address is unaffected.
    const someoneElse = await createClient(ctx.app).post('/api/v1/auth/login', {
      identifier: 'different.person@example.com',
      password: 'WrongPassword1',
    });
    expect(someoneElse.status).toBe(401);
  });

  test('registration is throttled per client', async () => {
    // One registration was already used by the previous test.
    const statuses = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await createClient(ctx.app).post('/api/v1/auth/register', doctorPayload());
      statuses.push(res.status);
    }
    expect(statuses.filter((s) => s === 201)).toHaveLength(2);
    expect(statuses.filter((s) => s === 429)).toHaveLength(2);
  });
});
