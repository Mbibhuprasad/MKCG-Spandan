const { z, line, text, httpUrl, nullableId, year } = require('./common');
const {
  POSTER_TEMPLATES,
  POSTER_STATUS,
  POSTER_PORTRAIT_PLACEMENTS,
  POSTER_PHOTO_SOURCES,
  POSTER_SECTIONS,
  POSTER_LIMITS: L,
} = require('../config/constants');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Every text field is optional and may be empty: a draft can be saved at any
// point. The fields a finished poster needs are checked separately (see
// services/poster.service.js → missingRequired).
const opt = (schema) => schema.optional();
const oneLine = (max, label) => opt(line(0, max, label));
const multiLine = (max, label) => opt(text(0, max, label));

// "YYYY-MM-DD", a real calendar date in the past, or '' for "not set".
const isoDay = z
  .string()
  .trim()
  .refine((v) => {
    if (v === '') return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && d.getUTCFullYear() >= 1900 && d <= new Date();
  }, 'Enter a valid date of birth.');

const contactItem = (valueSchema) => z.object({ value: valueSchema.optional(), include: z.boolean().optional() }).optional();

const emailValue = z
  .string()
  .trim()
  .toLowerCase()
  .max(L.contactEmail, 'This email address is too long.')
  .refine((v) => v === '' || EMAIL.test(v), 'Enter a valid email address.');

const phoneValue = z
  .string()
  .trim()
  .max(L.contactPhone, 'This phone number is too long.')
  .refine((v) => {
    if (v === '') return true;
    if (/[^\d\s()+.-]/.test(v)) return false;
    const digits = v.replace(/\D/g, '').length;
    return digits >= 6 && digits <= 15;
  }, 'Enter a valid phone number.');

const websiteValue = z.union([z.literal(''), httpUrl]);

const basic = z
  .object({
    displayName: oneLine(L.displayName, 'Display name'),
    professionalTitle: oneLine(L.professionalTitle, 'Professional title'),
    batchYear: year.optional(),
    college: oneLine(L.college, 'College name'),
    hometown: oneLine(L.hometown, 'Hometown'),
    dateOfBirth: isoDay.optional(),
    showBirthYear: z.boolean().optional(),
    showZodiac: z.boolean().optional(),
  })
  .optional();

const professional = z
  .object({
    specialization: oneLine(L.specialization, 'Specialization'),
    workplace: oneLine(L.workplace, 'Workplace'),
    role: oneLine(L.role, 'Current role'),
    qualifications: oneLine(L.qualifications, 'Qualifications'),
    achievements: multiLine(L.achievements, 'Achievements'),
    milestones: multiLine(L.milestones, 'Awards and milestones'),
  })
  .optional();

const messages = z
  .object({
    greeting: oneLine(L.greeting, 'Greeting'),
    introduction: multiLine(L.introduction, 'Introduction'),
    messageToFriends: multiLine(L.messageToFriends, 'Message to friends'),
    quotation: multiLine(L.quotation, 'Quotation'),
    quotationAuthor: oneLine(L.quotationAuthor, 'Quotation author'),
    memory: multiLine(L.memory, 'Memorable experience'),
    batchMessage: multiLine(L.batchMessage, 'Message about the batch'),
    closing: multiLine(L.closing, 'Closing wishes'),
    signature: oneLine(L.signature, 'Signature'),
  })
  .optional();

const celebration = z
  .object({
    title: oneLine(L.celebrationTitle, 'Celebration title'),
    years: z
      .union([z.null(), z.number().int().min(1, 'Enter a number of years.').max(L.celebrationYearsMax, 'Enter a number of years.')])
      .optional(),
    eventYear: year.optional(),
    tagline: oneLine(L.celebrationTagline, 'Tagline'),
  })
  .optional();

const contact = z
  .object({
    email: contactItem(emailValue),
    phone: contactItem(phoneValue),
    address: contactItem(line(0, L.contactAddress, 'Address')),
    website: contactItem(websiteValue),
  })
  .optional();

const photos = z
  .object({
    portraitSource: z.enum(POSTER_PHOTO_SOURCES).optional(),
    portraitId: nullableId.optional(),
    familyId: nullableId.optional(),
    collegeId: nullableId.optional(),
    memoryId: nullableId.optional(),
  })
  .optional();

const settings = z
  .object({
    palette: z.string().trim().max(20).optional(),
    portraitPlacement: z.enum(POSTER_PORTRAIT_PLACEMENTS).optional(),
    sections: z.object(Object.fromEntries(POSTER_SECTIONS.map((key) => [key, z.boolean().optional()]))).optional(),
  })
  .optional();

const posterFields = {
  title: oneLine(L.title, 'Poster title'),
  template: z.enum(Object.keys(POSTER_TEMPLATES), { message: 'Choose one of the poster templates.' }).optional(),
  status: z.enum(Object.values(POSTER_STATUS)).optional(),
  basic,
  professional,
  messages,
  celebration,
  contact,
  photos,
  settings,
};

const createPoster = z.object(posterFields);
const updatePoster = z.object(posterFields);

const exportPoster = z.object({ format: z.enum(['png', 'pdf'], { message: 'Choose PNG or PDF.' }) });

module.exports = { createPoster, updatePoster, exportPoster };
