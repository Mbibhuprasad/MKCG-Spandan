// Calendar dates (no time of day), such as a date of birth. A calendar date is
// stored as midnight UTC of that day and travels as "YYYY-MM-DD", so it never
// shifts by a day between time zones. "Today" is the date in the community's
// time zone (TIME_ZONE), not in the server's.

const pad = (n) => String(n).padStart(2, '0');

const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

// { year, month (1–12), day } of `date` as seen in `timeZone`.
function calendarDay(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const pick = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: pick('year'), month: pick('month'), day: pick('day') };
}

const isoDay = ({ year, month, day }) => `${year}-${pad(month)}-${pad(day)}`;

// "1985-02-29" → null (not a real date); "1985-03-04" → Date at midnight UTC.
function parseIsoDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

// A stored calendar date back to "YYYY-MM-DD".
const formatIsoDay = (date) => (date ? new Date(date).toISOString().slice(0, 10) : null);

// The (month, day) pairs whose birthdays fall on `today`. Someone born on
// 29 February celebrates on 28 February in years without that day.
function birthdayMatches(today) {
  const matches = [{ month: today.month, day: today.day }];
  if (today.month === 2 && today.day === 28 && !isLeapYear(today.year)) matches.push({ month: 2, day: 29 });
  return matches;
}

module.exports = { isLeapYear, calendarDay, isoDay, parseIsoDay, formatIsoDay, birthdayMatches };
