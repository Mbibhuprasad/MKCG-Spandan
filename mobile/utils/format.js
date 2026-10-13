// Formatting helpers. Written without Intl so output is identical on every
// Android JavaScript engine build. Dates are shown in the phone's own time zone.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const toDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// "12 Dec 2026"
export function formatDate(value) {
  const d = toDate(value);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}

// "4:05 pm"
export function formatTime(value) {
  const d = toDate(value);
  if (!d) return '';
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
}

// "Sat, 12 Dec 2026 · 4:05 pm"
export function formatDateTime(value) {
  const d = toDate(value);
  return d ? `${DAYS[d.getDay()]}, ${formatDate(d)} · ${formatTime(d)}` : '';
}

export function dateParts(value) {
  const d = toDate(value);
  return d ? { day: d.getDate(), month: MONTHS[d.getMonth()], year: d.getFullYear(), weekday: DAYS[d.getDay()] } : null;
}

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// "Today", "Yesterday" or "12 Dec 2026" — the separators in a conversation.
export function dayLabel(value) {
  const d = toDate(value);
  if (!d) return '';
  const now = new Date();
  if (sameDay(d, now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  return formatDate(d);
}

export const isSameDay = (a, b) => {
  const x = toDate(a);
  const y = toDate(b);
  return Boolean(x && y && sameDay(x, y));
};

// Compact stamp for lists: a time today, "Yesterday", a weekday this week, else a date.
export function listStamp(value) {
  const d = toDate(value);
  if (!d) return '';
  const now = new Date();
  if (sameDay(d, now)) return formatTime(d);
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return DAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`}`;
}

const UNITS = [
  ['year', 365 * 86400],
  ['month', 30 * 86400],
  ['week', 7 * 86400],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

// "3 hours ago", "in 2 days"
export function timeAgo(value) {
  const d = toDate(value);
  if (!d) return '';
  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  for (const [unit, size] of UNITS) {
    if (abs >= size) {
      const n = Math.round(abs / size);
      const label = `${n} ${unit}${n === 1 ? '' : 's'}`;
      return seconds < 0 ? `${label} ago` : `in ${label}`;
    }
  }
  return 'just now';
}

export function initials(name = '') {
  const parts = String(name)
    .replace(/^(dr\.?|prof\.?)\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

// "2015 – Present", "2012 – 2014" or just "2019" when only one year is known.
export function yearRange(start, end, current = false) {
  const to = current ? 'Present' : end;
  if (start && to) return `${start} – ${to}`;
  return String(start || to || '');
}

export const joinParts = (parts, separator = ' · ') => parts.filter(Boolean).join(separator);

export const truncate = (value, max) => {
  const s = String(value ?? '');
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};

export const labelOf = (list, value) => {
  const found = list.find((item) => item.value === value);
  return found ? found.label : value;
};

// A unique id for a message this device is sending (the API accepts 8–64
// characters of A–Z a–z 0–9 _ -). A retry reuses it, so the message is stored once.
export function newClientId() {
  const random = () => Math.random().toString(36).slice(2, 12);
  return `m${Date.now().toString(36)}${random()}${random()}`.slice(0, 40);
}
