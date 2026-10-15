const { z, line, text, httpUrl, year, page, limit, objectId, nullableId } = require('./common');
const { email, phone } = require('./auth.validators');
const { normalizeSpecialization, normalizeSubspecialty, splitSubspecialties } = require('../services/specialty.service');
const { getEnv } = require('../config/env');
const { calendarDay, isoDay, parseIsoDay } = require('../utils/calendar');
const {
  EMPLOYMENT_TYPES,
  DEGREE_LEVELS,
  BLOOD_GROUPS,
  CREDENTIAL_TYPES,
  PROFILE_SECTIONS,
  PROFILE_WIZARD_STEPS,
} = require('../config/constants');

// '' means "not stated"; anything else must be one of the known values.
const optionalEnum = (values) => z.enum(['', ...values], 'Choose one of the listed options.').default('');

// Refinement for year ranges: the end may not come before the start.
const notBefore = (startKey, endKey, message) => [
  (e) => e[startKey] === null || e[endKey] === null || e[endKey] >= e[startKey],
  { path: [endKey], message },
];

const tagList = (maxItems, maxLen, label) =>
  z
    .array(line(1, maxLen, label))
    .max(maxItems, `Add at most ${maxItems} entries.`)
    .transform((items) => [...new Set(items)]);

const education = z
  .object({
    degree: line(1, 120, 'Degree'),
    level: optionalEnum(DEGREE_LEVELS),
    certification: line(0, 160, 'Academic certification').default(''),
    institution: line(0, 160, 'Institution').default(''),
    fieldOfStudy: line(0, 120, 'Field of study').default(''),
    startYear: year.default(null),
    year: year.default(null),
    details: text(0, 400, 'Details').default(''),
  })
  .refine(...notBefore('startYear', 'year', 'The completion year cannot be before the start year.'));

const credential = z.object({
  title: line(1, 160, 'Qualification'),
  type: optionalEnum(CREDENTIAL_TYPES),
  institution: line(0, 160, 'Awarding institution').default(''),
  year: year.default(null),
  registration: line(0, 120, 'Registration details').default(''),
  details: text(0, 400, 'Details').default(''),
});

const fellowship = z
  .object({
    title: line(1, 160, 'Title'),
    institution: line(0, 160, 'Institution').default(''),
    specialty: line(0, 120, 'Specialty').default(''),
    startYear: year.default(null),
    endYear: year.default(null),
    certificate: line(0, 160, 'Certificate').default(''),
    description: text(0, 600, 'Description').default(''),
  })
  .refine(...notBefore('startYear', 'endYear', 'The completion year cannot be before the start year.'));

const experience = z
  .object({
    role: line(1, 120, 'Role'),
    organization: line(0, 160, 'Organisation').default(''),
    employmentType: optionalEnum(EMPLOYMENT_TYPES),
    city: line(0, 80, 'City').default(''),
    state: line(0, 80, 'State').default(''),
    startYear: year.default(null),
    endYear: year.default(null),
    current: z.boolean().default(false),
    description: text(0, 600, 'Description').default(''),
  })
  .refine(...notBefore('startYear', 'endYear', 'The end year cannot be before the start year.'));

const achievement = z.object({
  title: line(1, 160, 'Title'),
  issuer: line(0, 160, 'Awarding organisation').default(''),
  year: year.default(null),
  description: text(0, 400, 'Description').default(''),
  // An upload made with purpose "award" (or null). The stored URLs are derived
  // from it on the server; a client can never supply an image URL.
  imageId: nullableId.default(null),
});

const membership = z
  .object({
    organization: line(1, 160, 'Organisation'),
    type: line(0, 120, 'Membership type').default(''),
    number: line(0, 80, 'Membership number').default(''),
    startYear: year.default(null),
    endYear: year.default(null),
    current: z.boolean().default(false),
  })
  .refine(...notBefore('startYear', 'endYear', 'The end year cannot be before the start year.'));

const practiceLocation = z.object({
  hospital: line(1, 160, 'Hospital or clinic'),
  designation: line(0, 120, 'Designation').default(''),
  area: line(0, 160, 'Practice area').default(''),
  address: line(0, 240, 'Address').default(''),
  city: line(0, 80, 'City').default(''),
  state: line(0, 80, 'State').default(''),
  country: line(0, 80, 'Country').default(''),
  phone: z.union([z.literal(''), phone]).default(''),
});

const publication = z.object({
  title: line(1, 240, 'Title'),
  journal: line(0, 160, 'Journal').default(''),
  authors: line(0, 300, 'Authors').default(''),
  description: text(0, 600, 'Description').default(''),
  year: year.default(null),
  url: z.union([z.literal(''), httpUrl]).default(''),
});

const link = z.object({ label: line(1, 40, 'Label'), url: httpUrl });

// "YYYY-MM-DD", a real calendar date between 1900 and today (in the community's
// time zone). '' or null clears it. Stored as midnight UTC of that day.
const dateOfBirth = z
  .union([z.null(), z.literal(''), z.string()])
  .transform((value, ctx) => {
    if (!value) return null;
    const parsed = parseIsoDay(value);
    if (!parsed || parsed.getUTCFullYear() < 1900) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid date of birth.' });
      return z.NEVER;
    }
    if (value > isoDay(calendarDay(new Date(), getEnv().timeZone))) {
      ctx.addIssue({ code: 'custom', message: 'The date of birth cannot be in the future.' });
      return z.NEVER;
    }
    return parsed;
  });

// Every field is optional: doctors can complete their profile gradually and
// save their progress at any step. The few fields the wizard requires are
// checked by the controller when the doctor submits (`submit: true`).
// Role, status, email, phone, the "featured" flag and the completion timestamp
// cannot be set here.
const updateProfile = z.object({
  name: line(2, 80, 'Full name').optional(),
  // '' clears the number. `sameAsPhone` means "my registered phone number is my WhatsApp number".
  whatsapp: z
    .object({
      sameAsPhone: z.boolean().default(false),
      number: z.union([z.literal(''), phone]).default(''),
    })
    .optional(),
  profile: z
    .object({
      professionalTitle: line(0, 120, 'Professional title'),
      headline: line(0, 160, 'Headline'),
      bloodGroup: z.enum(['', ...BLOOD_GROUPS], 'Choose one of the listed blood groups.'),
      dateOfBirth,
      address: line(0, 240, 'Address'),
      // Listed options keep their listed spelling; typed values are tidied into Title Case.
      specialization: line(0, 80, 'Specialization').transform(normalizeSpecialization),
      // Several subspecializations are sent as one comma-separated value.
      subspecialty: line(0, 700, 'Subspecializations')
        .refine((value) => splitSubspecialties(value).length <= 8, 'Add at most 8 subspecializations.')
        .refine((value) => splitSubspecialties(value).every((sub) => sub.length <= 80), 'Keep each subspecialization under 80 characters.')
        .transform(normalizeSubspecialty),
      fieldOfWork: line(0, 120, 'Field of work'),
      expertise: tagList(20, 80, 'Area of expertise'),
      procedures: tagList(30, 100, 'Procedure'),
      practiceArea: line(0, 160, 'Clinical practice area'),
      practiceLocations: z.array(practiceLocation).max(5, 'Add at most 5 locations.'),
      memberships: z.array(membership).max(15, 'Add at most 15 entries.'),
      designation: line(0, 120, 'Designation'),
      hospital: line(0, 160, 'Hospital or clinic'),
      city: line(0, 80, 'City'),
      state: line(0, 80, 'State'),
      country: line(0, 80, 'Country'),
      workAddress: line(0, 240, 'Workplace address'),
      workEmail: z.union([z.literal(''), email]),
      workPhone: z.union([z.literal(''), phone]),
      batchYear: year,
      yearsOfExperience: z.union([z.null(), z.number().int().min(0, 'Enter a valid number.').max(80, 'Enter a valid number.')]),
      bio: text(0, 1200, 'Biography'),
      qualifications: tagList(12, 80, 'Qualification'),
      interests: tagList(15, 60, 'Interest'),
      languages: tagList(12, 40, 'Language'),
      education: z.array(education).max(10, 'Add at most 10 entries.'),
      credentials: z.array(credential).max(15, 'Add at most 15 entries.'),
      experience: z.array(experience).max(15, 'Add at most 15 entries.'),
      fellowships: z.array(fellowship).max(10, 'Add at most 10 entries.'),
      achievements: z.array(achievement).max(20, 'Add at most 20 entries.'),
      publications: z.array(publication).max(30, 'Add at most 30 entries.'),
      links: z.array(link).max(6, 'Add at most 6 links.'),
    })
    .partial()
    .optional(),
  visibility: z
    .object({
      directory: z.boolean(),
      portfolio: z.boolean(),
      publicListing: z.boolean(),
      showEmail: z.boolean(),
      showPhone: z.boolean(),
      showWhatsapp: z.boolean(),
      showWorkContact: z.boolean(),
      showRegistration: z.boolean(),
      showBloodGroup: z.boolean(),
      showBirthday: z.boolean(),
      sections: z.object(Object.fromEntries(PROFILE_SECTIONS.map((key) => [key, z.boolean()]))).partial(),
    })
    .partial()
    .optional(),
  dismissProfilePrompt: z.boolean().optional(),
  // Profile wizard: the step to resume from, and the final submission.
  wizardStep: z
    .number()
    .int()
    .min(0)
    .max(PROFILE_WIZARD_STEPS - 1)
    .optional(),
  submit: z.boolean().optional(),
});

const setPhoto = z.object({ mediaId: objectId });

const specialtyQuery = z.object({ q: z.string().trim().max(60).optional() });

const directoryQuery = z.object({
  q: z.string().trim().max(60).optional(),
  specialization: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  page,
  limit: limit(12, 48),
});

module.exports = { updateProfile, setPhoto, directoryQuery, specialtyQuery };
