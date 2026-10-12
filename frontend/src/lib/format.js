// Formatting helpers. A fixed locale and time zone keep server-rendered and
// client-rendered output identical (no hydration mismatches, no off-by-one days).
const LOCALE = 'en-IN';
export const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || 'Asia/Kolkata';

const toDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const d = toDate(value);
  return d ? new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, ...options }).format(d) : '';
}

// { day: 12, month: 'Dec', year: 2026 } in the community time zone.
export function dateParts(value) {
  const d = toDate(value);
  if (!d) return null;
  const parts = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(d);
  const pick = (type) => parts.find((p) => p.type === type)?.value || '';
  return { day: Number(pick('day')), month: pick('month'), year: Number(pick('year')) };
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function formatTime(value) {
  const d = toDate(value);
  return d ? new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(d) : '';
}

// "12 Dec 2026" or "12 – 14 Dec 2026" / "30 Dec 2026 – 2 Jan 2027"
export function formatDateRange(start, end) {
  const a = dateParts(start);
  const b = dateParts(end);
  if (!a) return '';
  if (!b || (a.day === b.day && a.month === b.month && a.year === b.year)) return formatDate(start);
  if (a.year === b.year && a.month === b.month) return `${a.day} – ${formatDate(end)}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

// "3 hours ago", "in 2 days". Only call this on the client (it depends on "now").
export function timeAgo(value) {
  const d = toDate(value);
  if (!d) return '';
  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (abs >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

// Value for <input type="datetime-local"> in the visitor's own time zone.
export function toLocalInputValue(value) {
  const d = toDate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toDateInputValue(value) {
  return toLocalInputValue(value).slice(0, 10);
}

// datetime-local / date string → ISO string for the API ('' → null).
export function fromLocalInputValue(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
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

export function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function yearsLabel(years) {
  if (years === null || years === undefined) return '';
  return years === 1 ? '1 year of experience' : `${years} years of experience`;
}

// "2015 – Present", "2012 – 2014" or just "2019" when only one year is known.
export function yearRange(start, end, current = false) {
  const to = current ? 'Present' : end;
  if (start && to) return `${start} – ${to}`;
  return String(start || to || '');
}

export const cn = (...parts) => parts.filter(Boolean).join(' ');
