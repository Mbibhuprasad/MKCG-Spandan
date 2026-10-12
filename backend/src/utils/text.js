const { getEnv } = require('../config/env');

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Plain-text fields are stored as text and always rendered as text (escaped by
// React), so "sanitising" means removing control characters and tidying whitespace.
function cleanText(value) {
  return String(value ?? '')
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function cleanLine(value) {
  return cleanText(value).replace(/\s+/g, ' ');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

// Returns a canonical "+<digits>" phone number or null when it cannot be valid.
function normalizePhone(value) {
  const raw = String(value ?? '').trim();
  if (!raw || /[^\d\s()+.-]/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  let international = raw.startsWith('+');
  if (!international && raw.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }
  if (!international) {
    digits = digits.replace(/^0+/, '');
    if (digits.length === 10) digits = getEnv().defaultCountryCode + digits;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

function isHttpUrl(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function truncate(value, max) {
  const s = String(value ?? '');
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

module.exports = { cleanText, cleanLine, escapeRegex, normalizeEmail, normalizePhone, isHttpUrl, truncate };
