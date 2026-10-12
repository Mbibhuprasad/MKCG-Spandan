// Empty (not deleted) so a key in a developer's backend/.env cannot enable it here.
process.env.ADMIN_REGISTER_KEY = '';

const User = require('../src/models/User');
const { setupTestApp, createClient, ADMIN_PASSWORD } = require('./helpers/harness');

const ctx = setupTestApp();

describe('admin registration without ADMIN_REGISTER_KEY', () => {
  test('is switched off, whatever key is sent', async () => {
    for (const registrationKey of ['anything-at-all-2026', 'undefined', ' ']) {
      const res = await createClient(ctx.app).post('/api/v1/admin-register', {
        name: 'Nobody Admin',
        email: 'nobody.admin@example.com',
        phone: '+919700000099',
        password: ADMIN_PASSWORD,
        confirmPassword: ADMIN_PASSWORD,
        registrationKey,
      });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ADMIN_REGISTRATION_DISABLED');
    }
    expect(await User.countDocuments({ role: 'ADMIN' })).toBe(0);
  });
});
