const { z, line, optionalLine } = require('./common');
const { normalizeEmail, normalizePhone } = require('../utils/text');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const email = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.string().max(254, 'Enter a valid email address.').regex(EMAIL_RE, 'Enter a valid email address.'));

const phone = z
  .string()
  .max(32, 'Enter a valid phone number.')
  .transform(normalizePhone)
  .refine((v) => v !== null, 'Enter a valid phone number, including the country code if outside India.');

// bcrypt only reads the first 72 bytes, so longer passwords are refused rather than silently truncated.
const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Use at most 72 characters.')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number.');

// Note: there is deliberately no `role`, `status` or similar field here.
// Unknown keys are dropped, and the server always assigns the DOCTOR role.
const register = z
  .object({
    name: line(2, 80, 'Full name'),
    email,
    phone,
    password,
    confirmPassword: z.string(),
    acceptPolicies: z
      .boolean()
      .refine((v) => v === true, 'Please accept the Terms, Privacy Policy and Community Guidelines.'),
    specialization: optionalLine(80, 'Specialization'),
    city: optionalLine(80, 'City'),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });

const login = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or phone number.').max(254, 'Enter your email or phone number.'),
  password: z.string().min(1, 'Enter your password.').max(200, 'Enter your password.'),
});

const changePassword = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.').max(200),
    newPassword: password,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ['newPassword'],
    message: 'Choose a password you have not just used.',
  });

module.exports = { register, login, changePassword, email, phone, password };
