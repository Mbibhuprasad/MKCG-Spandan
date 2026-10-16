// Batch Profile Poster Maker — the app's copy of the website's poster model.
//
// Everything above the "App helpers" line is a VERBATIM copy of
// frontend/src/components/posters/model.js (fields, limits, templates,
// validation, prefill). The website is the source of truth: when that file
// changes, copy it here again. `npm run test:api` fails if the two differ.
// Posters are drawn by the website's own templates (see PosterRenderer.js).
//
// ──────────────── verbatim copy of frontend/src/components/posters/model.js ────────────────
// Batch Profile Poster Maker — form model shared by the editor, the preview and
// the export. The API repeats every check here (backend/src/validators/poster.validators.js).

// Keep equal to POSTER_LIMITS in backend/src/config/constants.js.
export const LIMITS = Object.freeze({
  perDoctor: 20,
  title: 80,
  displayName: 80,
  professionalTitle: 80,
  college: 120,
  hometown: 80,
  specialization: 80,
  workplace: 120,
  role: 80,
  qualifications: 160,
  achievements: 400,
  milestones: 400,
  greeting: 120,
  introduction: 600,
  messageToFriends: 600,
  quotation: 240,
  quotationAuthor: 80,
  memory: 600,
  batchMessage: 600,
  closing: 200,
  signature: 80,
  celebrationTitle: 60,
  celebrationTagline: 120,
  celebrationYearsMax: 75,
  contactEmail: 254,
  contactPhone: 20,
  contactAddress: 160,
  contactWebsite: 300,
});

// Poster canvas in CSS pixels (A4 proportions). Exported at 2× → 2480 × 3508 px,
// i.e. A4 at 300 dpi.
export const POSTER_WIDTH = 1240;
export const POSTER_HEIGHT = 1754;

export const TEMPLATES = Object.freeze([
  {
    id: 'classic-tribute',
    light: true, // list cover drawn on ivory (swatch = [ink, wash, accent])
    name: 'Classic Personal Tribute',
    description: 'Blue watercolour, gold framing and elegant type for a personal message.',
    placements: ['LEFT', 'CENTER', 'RIGHT'],
    palettes: [
      { id: 'royal', label: 'Royal blue & gold', swatch: ['#13306b', '#8cb6eb', '#d9b25a'] },
      { id: 'teal', label: 'Teal & gold', swatch: ['#0f4a4f', '#96cdc8', '#d9b25a'] },
      { id: 'rose', label: 'Rose & gold', swatch: ['#5a1f3a', '#ecb6c8', '#d9b25a'] },
    ],
  },
  {
    id: 'silver-jubilee',
    name: 'Silver Jubilee / Batch Celebration',
    description: 'A celebratory alumni poster with a reunion badge and a contact strip.',
    placements: ['LEFT', 'CENTER', 'RIGHT'],
    palettes: [
      { id: 'navy', label: 'Navy & silver', swatch: ['#0b1736', '#12265a', '#dfe5ef'] },
      { id: 'maroon', label: 'Maroon & gold', swatch: ['#3b0a17', '#5c1224', '#f2d48a'] },
      { id: 'emerald', label: 'Emerald & silver', swatch: ['#062b23', '#0b4a3b', '#e3ebe7'] },
    ],
  },
  {
    id: 'modern-professional',
    name: 'Modern Professional Doctor',
    description: 'An editorial layout with a large portrait, credentials and a short biography.',
    placements: ['LEFT', 'RIGHT'],
    palettes: [
      { id: 'navy', label: 'Navy, white & gold', swatch: ['#0c1f3f', '#16305e', '#c9a24c'] },
      { id: 'slate', label: 'Graphite & gold', swatch: ['#1f2733', '#2e3a4b', '#c9a24c'] },
      { id: 'teal', label: 'Deep teal & gold', swatch: ['#0b3b3f', '#12555b', '#c9a24c'] },
    ],
  },
  {
    id: 'college-memories',
    light: true,
    name: 'Nostalgic College Memories',
    description: 'Warm ivory paper, a photo collage and your college story as a timeline.',
    placements: ['LEFT', 'RIGHT'],
    palettes: [
      { id: 'vintage', label: 'Ivory & vintage blue', swatch: ['#2f4a6d', '#f4ead5', '#9c6b3c'] },
      { id: 'sepia', label: 'Ivory & sepia', swatch: ['#5a3e26', '#f3e7d3', '#a8743a'] },
      { id: 'sage', label: 'Ivory & sage', swatch: ['#3f5a46', '#f1ead7', '#a37b45'] },
    ],
  },
  {
    id: 'friends-forever',
    name: 'Friends Forever / Inspirational Message',
    description: 'A heartfelt tribute with a large greeting, a highlighted quote and closing wishes.',
    placements: ['LEFT', 'CENTER', 'RIGHT'],
    palettes: [
      { id: 'sky', label: 'Blue, cream & gold', swatch: ['#123a6b', '#1d4e89', '#d9a441'] },
      { id: 'sunset', label: 'Coral, cream & gold', swatch: ['#6e2430', '#9a3b3b', '#e0a64b'] },
      { id: 'twilight', label: 'Indigo, cream & gold', swatch: ['#1f1b4d', '#2e2a6b', '#d6a84e'] },
    ],
  },
  {
    id: 'medical-blue',
    light: true,
    name: 'Medical Blue Professional',
    description: 'Clean white and clinical blue: framed portrait, specialization and a structured profile.',
    placements: ['LEFT', 'CENTER', 'RIGHT'],
    palettes: [
      { id: 'blue', label: 'White & medical blue', swatch: ['#0b3f7a', '#eaf3fd', '#1769c2'] },
      { id: 'teal', label: 'White & clinical teal', swatch: ['#0a4f52', '#e7f6f5', '#0f8582'] },
      { id: 'indigo', label: 'White & indigo', swatch: ['#232f7d', '#eef0fc', '#3d52c4'] },
    ],
  },
]);

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
export const defaultPalette = (templateId) => templateById(templateId).palettes[0].id;

export const PLACEMENTS = Object.freeze([
  { value: 'LEFT', label: 'Left' },
  { value: 'CENTER', label: 'Centre' },
  { value: 'RIGHT', label: 'Right' },
]);

/** Portrait placements a template's layout offers (each template falls back to Left). */
export const placementsOf = (templateId) => PLACEMENTS.filter((p) => templateById(templateId).placements.includes(p.value));

// Optional sections the doctor can switch off. Their content is kept.
export const SECTIONS = Object.freeze([
  { key: 'birthday', label: 'Birthday', hint: 'Off by default. Your date of birth is printed only when this is on.' },
  { key: 'professional', label: 'Professional details' },
  { key: 'achievements', label: 'Achievements and milestones' },
  { key: 'introduction', label: 'Introduction' },
  { key: 'messageToFriends', label: 'Message to friends' },
  { key: 'quotation', label: 'Favourite quotation' },
  { key: 'memory', label: 'Memorable experience' },
  { key: 'batchMessage', label: 'Message about the batch' },
  { key: 'closing', label: 'Closing wishes and signature' },
  { key: 'gallery', label: 'Additional photographs' },
  { key: 'celebration', label: 'Reunion / anniversary badge' },
]);

// Conventional reunion names. Applied only when the doctor picks one; the
// number of years is never worked out on their behalf.
export const CELEBRATION_PRESETS = Object.freeze([
  { title: 'Decennial Reunion', years: 10 },
  { title: 'Silver Jubilee', years: 25 },
  { title: 'Pearl Jubilee', years: 30 },
  { title: 'Ruby Jubilee', years: 40 },
  { title: 'Golden Jubilee', years: 50 },
]);

export const STEPS = Object.freeze([
  { id: 'basic', short: 'Basics', title: 'Basic information', description: 'How your name and batch appear on the poster.' },
  {
    id: 'professional',
    short: 'Professional',
    title: 'Professional information',
    description: 'Filled in from your profile. Changes here apply to this poster only.',
  },
  {
    id: 'messages',
    short: 'Messages',
    title: 'Personal message and memories',
    description: 'Printed exactly as you write them. Leave any of them empty to leave them out.',
  },
  { id: 'photos', short: 'Photos', title: 'Photographs', description: 'All photos are optional and stay private to you.', optional: true },
  {
    id: 'contact',
    short: 'Contact',
    title: 'Contact information',
    description: 'Nothing is printed unless you switch it on for each detail.',
    optional: true,
  },
  { id: 'design', short: 'Design', title: 'Template and final check', description: 'Choose the look and the sections to show.' },
]);

export const PHOTO_SLOTS = Object.freeze([
  { key: 'family', label: 'Family photograph', caption: 'Family' },
  { key: 'college', label: 'College or reunion photograph', caption: 'College days' },
  { key: 'memory', label: 'Another memory', caption: 'Memories' },
]);

const CONTACT_KEYS = ['email', 'phone', 'address', 'website'];

export function blankForm(templateId = TEMPLATES[0].id) {
  return {
    title: '',
    template: templateId,
    status: 'DRAFT',
    basic: {
      displayName: '',
      professionalTitle: '',
      batchYear: '',
      college: '',
      hometown: '',
      dateOfBirth: '',
      showBirthYear: false,
      showZodiac: false,
    },
    professional: { specialization: '', workplace: '', role: '', qualifications: '', achievements: '', milestones: '' },
    messages: {
      greeting: '',
      introduction: '',
      messageToFriends: '',
      quotation: '',
      quotationAuthor: '',
      memory: '',
      batchMessage: '',
      closing: '',
      signature: '',
    },
    celebration: { title: '', years: '', eventYear: '', tagline: '' },
    contact: Object.fromEntries(CONTACT_KEYS.map((key) => [key, { value: '', include: false }])),
    photos: { portraitSource: 'NONE', portrait: null, family: null, college: null, memory: null, profilePhotoUrl: '' },
    settings: {
      palette: defaultPalette(templateId),
      portraitPlacement: 'LEFT',
      sections: Object.fromEntries(SECTIONS.map((s) => [s.key, s.key !== 'birthday'])),
    },
  };
}

/**
 * Placeholder content for the template gallery's design previews. Every value
 * names the field it stands for ("Your name"…) — nothing that could be taken
 * for a real doctor's details — and the gallery labels the cards as samples.
 */
export function sampleForm(templateId) {
  const form = blankForm(templateId);
  return {
    ...form,
    basic: { ...form.basic, displayName: 'Your Name', professionalTitle: 'Your professional title', college: 'Your college name' },
    professional: {
      ...form.professional,
      specialization: 'Your specialization',
      role: 'Your role',
      workplace: 'Your workplace',
      qualifications: 'Your qualifications',
    },
    messages: {
      ...form.messages,
      greeting: 'Your greeting,',
      introduction: 'A few lines about you and your journey since college appear here, exactly as you write them.',
      messageToFriends: 'Your message to your Friends appears here — printed exactly as you write it, with your own line breaks.',
      quotation: 'Your favourite quotation appears here.',
      memory: 'A memorable college experience you would like to share.',
      closing: 'Your closing wishes',
      signature: 'Your signature',
    },
  };
}

const numText = (value) => (value === null || value === undefined ? '' : String(value));

/** Saved poster (API shape) → editor form. */
export function fromPoster(poster) {
  const form = blankForm(poster.template);
  return {
    ...form,
    title: poster.title || '',
    template: poster.template,
    status: poster.status,
    basic: { ...form.basic, ...poster.basic, batchYear: numText(poster.basic.batchYear) },
    professional: { ...form.professional, ...poster.professional },
    messages: { ...form.messages, ...poster.messages },
    celebration: {
      ...form.celebration,
      ...poster.celebration,
      years: numText(poster.celebration.years),
      eventYear: numText(poster.celebration.eventYear),
    },
    contact: Object.fromEntries(CONTACT_KEYS.map((key) => [key, { ...form.contact[key], ...poster.contact[key] }])),
    photos: { ...form.photos, ...poster.photos },
    settings: {
      ...form.settings,
      ...poster.settings,
      sections: { ...form.settings.sections, ...poster.settings.sections },
    },
  };
}

const toNumber = (value) => {
  const text = String(value ?? '').trim();
  return text === '' ? null : Number(text);
};

/** Editor form → request body. Photos are sent as upload ids only. */
export function toPayload(form, { status } = {}) {
  const body = {
    title: form.title,
    template: form.template,
    basic: { ...form.basic, batchYear: toNumber(form.basic.batchYear) },
    professional: { ...form.professional },
    messages: { ...form.messages },
    celebration: { ...form.celebration, years: toNumber(form.celebration.years), eventYear: toNumber(form.celebration.eventYear) },
    contact: Object.fromEntries(CONTACT_KEYS.map((key) => [key, { value: form.contact[key].value, include: form.contact[key].include }])),
    photos: {
      portraitSource: form.photos.portraitSource,
      portraitId: form.photos.portrait ? form.photos.portrait.id : null,
      familyId: form.photos.family ? form.photos.family.id : null,
      collegeId: form.photos.college ? form.photos.college.id : null,
      memoryId: form.photos.memory ? form.photos.memory.id : null,
    },
    settings: { ...form.settings, sections: { ...form.settings.sections } },
  };
  if (status) body.status = status;
  return body;
}

/* ── Pre-filling from the doctor's profile (GET /doctors/me) ──────────── */

function collegeOf(profile) {
  const education = profile.education || [];
  const undergrad =
    education.find((e) => e.level === 'UNDERGRADUATE' && e.institution) ||
    education.find((e) => /m\.?\s?b\.?\s?b\.?\s?s/i.test(e.degree || '') && e.institution);
  return undergrad ? undergrad.institution : '';
}

function currentExperience(profile) {
  return (profile.experience || []).find((e) => e.current) || null;
}

const awardLine = (a) => [a.title, [a.issuer, a.year].filter(Boolean).join(', ')].filter(Boolean).join(' — ');

const clip = (text, max) => (text.length > max ? '' : text); // never cut a value in half: leave it for the doctor

/**
 * Poster values taken from the profile, per step. Contact details are offered
 * as values but always start switched off.
 */
export function prefillFromProfile(me) {
  if (!me) return {};
  const p = me.profile || {};
  const job = currentExperience(p);
  const fellowships = (p.fellowships || []).map((f) => [f.title, f.institution].filter(Boolean).join(' — ')).join('\n');
  const awards = (p.achievements || []).map(awardLine).filter(Boolean).join('\n');
  const publications = (p.publications || []).map((x) => (x.year ? `${x.title} (${x.year})` : x.title)).join('\n');
  const milestones = [awards, publications].filter(Boolean).join('\n');
  const website = (p.links || []).find((l) => l.url);
  return {
    basic: {
      displayName: me.name || '',
      professionalTitle: p.professionalTitle || '',
      batchYear: numText(p.batchYear),
      college: clip(collegeOf(p), LIMITS.college),
      hometown: p.city || '',
      dateOfBirth: p.dateOfBirth || '',
    },
    professional: {
      specialization: p.specialization || '',
      workplace: p.hospital || (job ? job.organization : '') || '',
      role: p.designation || (job ? job.role : '') || '',
      qualifications: clip((p.qualifications || []).join(', '), LIMITS.qualifications),
      achievements: clip(fellowships, LIMITS.achievements),
      milestones: clip(milestones, LIMITS.milestones) || clip(awards, LIMITS.milestones),
    },
    contact: {
      email: { value: me.email || '' },
      phone: { value: me.phone || '' },
      address: { value: [p.city, p.state].filter(Boolean).join(', ') },
      website: { value: website ? website.url : '' },
    },
    photos: { profilePhotoUrl: p.photoUrl || '', portraitSource: p.photoUrl ? 'PROFILE' : 'NONE' },
  };
}

/** Applies prefilled values for the given groups (contact switches stay off). */
export function applyPrefill(form, prefill, groups) {
  const next = { ...form };
  for (const group of groups) {
    const values = prefill[group];
    if (!values) continue;
    if (group === 'contact') {
      next.contact = { ...form.contact };
      for (const [key, item] of Object.entries(values)) next.contact[key] = { ...form.contact[key], value: item.value };
    } else if (group === 'photos') {
      next.photos = { ...form.photos, ...values };
    } else {
      next[group] = { ...form[group], ...values };
    }
  }
  return next;
}

/* ── Validation (mirrors the API) ─────────────────────────────────────── */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidIsoDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value && d.getUTCFullYear() >= 1900 && d <= new Date();
}

const LENGTH_CHECKS = [
  ['title', LIMITS.title],
  ['basic.displayName', LIMITS.displayName],
  ['basic.professionalTitle', LIMITS.professionalTitle],
  ['basic.college', LIMITS.college],
  ['basic.hometown', LIMITS.hometown],
  ['professional.specialization', LIMITS.specialization],
  ['professional.workplace', LIMITS.workplace],
  ['professional.role', LIMITS.role],
  ['professional.qualifications', LIMITS.qualifications],
  ['professional.achievements', LIMITS.achievements],
  ['professional.milestones', LIMITS.milestones],
  ['messages.greeting', LIMITS.greeting],
  ['messages.introduction', LIMITS.introduction],
  ['messages.messageToFriends', LIMITS.messageToFriends],
  ['messages.quotation', LIMITS.quotation],
  ['messages.quotationAuthor', LIMITS.quotationAuthor],
  ['messages.memory', LIMITS.memory],
  ['messages.batchMessage', LIMITS.batchMessage],
  ['messages.closing', LIMITS.closing],
  ['messages.signature', LIMITS.signature],
  ['celebration.title', LIMITS.celebrationTitle],
  ['celebration.tagline', LIMITS.celebrationTagline],
  ['contact.email.value', LIMITS.contactEmail],
  ['contact.phone.value', LIMITS.contactPhone],
  ['contact.address.value', LIMITS.contactAddress],
  ['contact.website.value', LIMITS.contactWebsite],
];

export const valueAt = (form, path) => path.split('.').reduce((obj, key) => (obj == null ? obj : obj[key]), form);

function yearError(value, label = 'year') {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const n = Number(text);
  return Number.isInteger(n) && n >= 1940 && n <= 2100 ? '' : `Enter a valid ${label}.`;
}

/**
 * Returns { 'basic.displayName': 'message', … }. With `complete`, the fields a
 * finished poster needs are required too.
 */
export function validateForm(form, { complete = false } = {}) {
  const errors = {};
  for (const [path, max] of LENGTH_CHECKS) {
    const value = String(valueAt(form, path) ?? '').trim();
    if (value.length > max) errors[path] = `Please keep this to ${max} characters (now ${value.length}).`;
  }

  if (complete) {
    if (!form.basic.displayName.trim()) errors['basic.displayName'] = 'Enter the name to print on the poster.';
    if (!String(form.basic.batchYear).trim()) errors['basic.batchYear'] = 'Enter your batch year.';
    if (!form.basic.college.trim()) errors['basic.college'] = 'Enter your college name.';
  }

  const batch = yearError(form.basic.batchYear, 'batch year');
  if (batch) errors['basic.batchYear'] = batch;
  const eventYear = yearError(form.celebration.eventYear, 'year');
  if (eventYear) errors['celebration.eventYear'] = eventYear;

  const years = String(form.celebration.years ?? '').trim();
  if (years) {
    const n = Number(years);
    if (!Number.isInteger(n) || n < 1 || n > LIMITS.celebrationYearsMax) {
      errors['celebration.years'] = `Enter a whole number from 1 to ${LIMITS.celebrationYearsMax}.`;
    }
  }

  if (form.basic.dateOfBirth && !isValidIsoDay(form.basic.dateOfBirth)) errors['basic.dateOfBirth'] = 'Enter a valid date of birth.';

  const email = form.contact.email.value.trim();
  if (email && !EMAIL.test(email)) errors['contact.email.value'] = 'Enter a valid email address.';
  const phone = form.contact.phone.value.trim();
  if (phone) {
    const digits = phone.replace(/\D/g, '').length;
    if (/[^\d\s()+.-]/.test(phone) || digits < 6 || digits > 15) errors['contact.phone.value'] = 'Enter a valid phone number.';
  }
  const website = form.contact.website.value.trim();
  if (website && !isHttpUrl(website)) errors['contact.website.value'] = 'Enter a full link starting with http:// or https://';
  for (const key of CONTACT_KEYS) {
    if (form.contact[key].include && !form.contact[key].value.trim() && !errors[`contact.${key}.value`]) {
      errors[`contact.${key}.value`] = 'Enter a value, or switch this detail off.';
    }
  }
  return errors;
}

const STEP_OF_GROUP = {
  basic: 'basic',
  professional: 'professional',
  messages: 'messages',
  photos: 'photos',
  contact: 'contact',
  celebration: 'design',
  settings: 'design',
  title: 'design',
  template: 'design',
};

export const stepOfErrorKey = (key) => STEPS.findIndex((s) => s.id === (STEP_OF_GROUP[key.split('.')[0]] || 'design'));

export function errorsByStep(errors) {
  const counts = STEPS.map(() => 0);
  for (const key of Object.keys(errors)) counts[stepOfErrorKey(key)] += 1;
  return counts;
}

/* ── Display helpers used by the templates ─────────────────────────────── */

const ZODIAC = [
  // [last day of the sign in its end month, sign] — tropical (Western) zodiac.
  [1, 19, 'Capricorn'],
  [2, 18, 'Aquarius'],
  [3, 20, 'Pisces'],
  [4, 19, 'Aries'],
  [5, 20, 'Taurus'],
  [6, 20, 'Gemini'],
  [7, 22, 'Cancer'],
  [8, 22, 'Leo'],
  [9, 22, 'Virgo'],
  [10, 22, 'Libra'],
  [11, 21, 'Scorpio'],
  [12, 21, 'Sagittarius'],
];

/** Western sun sign for a "YYYY-MM-DD" date, or '' when there is no valid date. */
export function zodiacOf(isoDay) {
  if (!isoDay || !isValidIsoDay(isoDay)) return '';
  const month = Number(isoDay.slice(5, 7));
  const day = Number(isoDay.slice(8, 10));
  const [, lastDay, sign] = ZODIAC[month - 1];
  return day <= lastDay ? sign : month === 12 ? 'Capricorn' : ZODIAC[month][2];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "15 August" or "15 August 1975". Built from the digits, so no time zone can shift the day. */
export function birthdayLabel(isoDay, withYear) {
  if (!isoDay || !isValidIsoDay(isoDay)) return '';
  const label = `${Number(isoDay.slice(8, 10))} ${MONTHS[Number(isoDay.slice(5, 7)) - 1]}`;
  return withYear ? `${label} ${isoDay.slice(0, 4)}` : label;
}

/** Splits a multi-line field into its non-empty lines (achievements, milestones). */
export const linesOf = (text) =>
  String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

export function initialsOf(name) {
  const words = String(name || '')
    .replace(/^(dr|prof)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0].toUpperCase())
    .join('');
}

/** Safe, readable file name for a download. */
export function posterFileName(form, extension) {
  const ascii = String(form.basic.displayName || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40);
  return `${ascii || 'batch'}-poster.${extension}`;
}

// ──────────────── App helpers (from frontend/src/components/posters/PosterEditor.jsx) ────────────────

export const REQUIRED_LABELS = { 'basic.displayName': 'display name', 'basic.batchYear': 'batch year', 'basic.college': 'college name' };

export function setIn(obj, path, value) {
  const [head, ...rest] = path.split('.');
  if (!rest.length) return { ...obj, [head]: value };
  return { ...obj, [head]: setIn(obj[head] || {}, rest.join('.'), value) };
}

export const payloadKey = (form) => JSON.stringify(toPayload(form));

export const photoIds = (form) =>
  ['portrait', 'family', 'college', 'memory'].map((k) => form.photos[k] && form.photos[k].id).filter(Boolean);

/** Switching template keeps every value; the colour falls back to the new template's default. */
export function withTemplate(form, templateId) {
  const t = templateById(templateId);
  const palette = t.palettes.some((p) => p.id === form.settings.palette) ? form.settings.palette : t.palettes[0].id;
  return { ...form, template: templateId, settings: { ...form.settings, palette } };
}
