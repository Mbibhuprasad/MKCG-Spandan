import { normalizePhone } from '@/utils/phone';

// The same rules as backend/src/validators/auth.validators.js, checked on the
// phone first so mistakes are reported without a round trip. The API validates
// everything again and remains the authority.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const byteLength = (value) => {
  let bytes = 0;
  for (const ch of String(value)) {
    const code = ch.codePointAt(0);
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
};

export function passwordIssue(password) {
  if (!password || password.length < 8) return 'Use at least 8 characters.';
  if (byteLength(password) > 72) return 'Use at most 72 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Include at least one letter and one number.';
  return '';
}

export function validateRegistration(form) {
  const errors = {};
  const name = form.name.replace(/\s+/g, ' ').trim();
  if (name.length < 2) errors.name = 'Enter your full name.';
  else if (name.length > 80) errors.name = 'Full name must be at most 80 characters.';
  if (!EMAIL_RE.test(form.email.trim()) || form.email.trim().length > 254) errors.email = 'Enter a valid email address.';
  if (!normalizePhone(form.phone)) errors.phone = 'Enter a valid phone number, including the country code if outside India.';
  const issue = passwordIssue(form.password);
  if (issue) errors.password = issue;
  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.';
  if (!form.acceptPolicies) errors.acceptPolicies = 'Please accept the Terms, Privacy Policy and Community Guidelines.';
  return errors;
}

export function validateLogin(form) {
  const errors = {};
  if (form.identifier.trim().length < 3) errors.identifier = 'Enter your email or phone number.';
  if (!form.password) errors.password = 'Enter your password.';
  return errors;
}
