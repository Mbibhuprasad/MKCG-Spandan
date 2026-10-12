const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Session = require('../src/models/Session');
const { createInitialAdmin, rotateAdminPassword, BootstrapError } = require('../src/services/adminBootstrap.service');
const { setupTestApp, registerDoctor, loginAs, createClient, ADMIN_ENV, ADMIN_PASSWORD } = require('./helpers/harness');

const ctx = setupTestApp();

describe('admin bootstrap', () => {
  test('fails safely when required variables are missing, without echoing secrets', async () => {
    await expect(createInitialAdmin({})).rejects.toThrow(BootstrapError);
    await expect(createInitialAdmin({ ...ADMIN_ENV, ADMIN_PASSWORD: '' })).rejects.toThrow(/ADMIN_PASSWORD/);

    let message = '';
    try {
      await createInitialAdmin({ ...ADMIN_ENV, ADMIN_EMAIL: 'not-an-email', ADMIN_PASSWORD: 'SuperSecretValue123' });
    } catch (err) {
      message = err.message;
    }
    expect(message).toMatch(/ADMIN_EMAIL/);
    expect(message).not.toContain('SuperSecretValue123');
    expect(await User.countDocuments({ role: 'ADMIN' })).toBe(0);
  });

  test('rejects weak and placeholder passwords', async () => {
    await expect(createInitialAdmin({ ...ADMIN_ENV, ADMIN_PASSWORD: 'short1' })).rejects.toThrow(BootstrapError);
    await expect(
      createInitialAdmin({ ...ADMIN_ENV, ADMIN_PASSWORD: 'replace-with-a-strong-admin-password' })
    ).rejects.toThrow(BootstrapError);
    expect(await User.countDocuments({ role: 'ADMIN' })).toBe(0);
  });

  test('never promotes an existing doctor account', async () => {
    const doctor = await registerDoctor(ctx.app);
    await expect(createInitialAdmin({ ...ADMIN_ENV, ADMIN_EMAIL: doctor.credentials.email })).rejects.toThrow(BootstrapError);
    const stored = await User.findOne({ email: doctor.credentials.email });
    expect(stored.role).toBe('DOCTOR');
  });

  test('creates one admin with a hashed password, and is idempotent', async () => {
    const first = await createInitialAdmin(ADMIN_ENV);
    expect(first.created).toBe(true);

    const admin = await User.findOne({ email: ADMIN_ENV.ADMIN_EMAIL }).select('+passwordHash');
    expect(admin.role).toBe('ADMIN');
    expect(admin.status).toBe('ACTIVE');
    expect(admin.passwordHash).not.toContain(ADMIN_PASSWORD);
    expect(await bcrypt.compare(ADMIN_PASSWORD, admin.passwordHash)).toBe(true);

    // Running again — even with a different password configured — changes nothing.
    const second = await createInitialAdmin({ ...ADMIN_ENV, ADMIN_PASSWORD: 'ADifferentPassword999' });
    expect(second).toEqual({ created: false, reason: 'ADMIN_EXISTS' });
    const after = await User.findOne({ email: ADMIN_ENV.ADMIN_EMAIL }).select('+passwordHash');
    expect(after.passwordHash).toBe(admin.passwordHash);
    expect(await User.countDocuments({ role: 'ADMIN' })).toBe(1);

    const client = await loginAs(ctx.app, ADMIN_ENV.ADMIN_EMAIL, ADMIN_PASSWORD);
    expect(client.user.role).toBe('ADMIN');
    expect((await client.get('/api/v1/admin/stats')).status).toBe(200);
  });

  test('password rotation is explicit, replaces the hash and signs the admin out', async () => {
    const client = await loginAs(ctx.app, ADMIN_ENV.ADMIN_EMAIL, ADMIN_PASSWORD);
    const adminId = client.user.id;
    expect(await Session.countDocuments({ user: adminId })).toBeGreaterThan(0);

    await expect(rotateAdminPassword({ ADMIN_EMAIL: 'someone.else@example.com', ADMIN_PASSWORD: 'RotatedPassword2027' })).rejects.toThrow(
      BootstrapError
    );

    const result = await rotateAdminPassword({ ADMIN_EMAIL: ADMIN_ENV.ADMIN_EMAIL, ADMIN_PASSWORD: 'RotatedPassword2027' });
    expect(result.rotated).toBe(true);
    expect(await Session.countDocuments({ user: adminId })).toBe(0);
    expect((await client.get('/api/v1/auth/me')).status).toBe(401);

    const old = await createClient(ctx.app).post('/api/v1/auth/login', { identifier: ADMIN_ENV.ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(old.status).toBe(401);
    await loginAs(ctx.app, ADMIN_ENV.ADMIN_EMAIL, 'RotatedPassword2027');
  });
});
