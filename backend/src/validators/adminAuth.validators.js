const { z, line } = require('./common');
const { email, phone, login } = require('./auth.validators');

// Administrators use a stronger password rule than doctors (same rule as `npm run admin:create`).
const adminPassword = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Use at most 72 characters.')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number.');

// Note: there is deliberately no `role` or `status` field here either. The
// ADMIN role is assigned by the server, and only when `registrationKey` matches.
const adminRegister = z
  .object({
    name: line(2, 80, 'Full name'),
    email,
    phone,
    password: adminPassword,
    confirmPassword: z.string(),
    registrationKey: z.string().min(1, 'Enter the admin registration key.').max(200, 'Enter the admin registration key.'),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });

module.exports = { adminRegister, adminLogin: login };
