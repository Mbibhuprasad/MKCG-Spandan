const { z, line, text, httpUrl, year, page, limit, objectId } = require('./common');

const tagList = (maxItems, maxLen, label) =>
  z
    .array(line(1, maxLen, label))
    .max(maxItems, `Add at most ${maxItems} entries.`)
    .transform((items) => [...new Set(items)]);

const education = z.object({
  degree: line(1, 120, 'Degree'),
  institution: line(0, 160, 'Institution').default(''),
  year: year.default(null),
});

const experience = z
  .object({
    role: line(1, 120, 'Role'),
    organization: line(0, 160, 'Organisation').default(''),
    city: line(0, 80, 'City').default(''),
    startYear: year.default(null),
    endYear: year.default(null),
    current: z.boolean().default(false),
    description: text(0, 600, 'Description').default(''),
  })
  .refine((e) => e.startYear === null || e.endYear === null || e.endYear >= e.startYear, {
    path: ['endYear'],
    message: 'The end year cannot be before the start year.',
  });

const achievement = z.object({
  title: line(1, 160, 'Title'),
  year: year.default(null),
  description: text(0, 400, 'Description').default(''),
});

const publication = z.object({
  title: line(1, 240, 'Title'),
  journal: line(0, 160, 'Journal').default(''),
  year: year.default(null),
  url: z.union([z.literal(''), httpUrl]).default(''),
});

const link = z.object({ label: line(1, 40, 'Label'), url: httpUrl });

// Every field is optional: doctors can complete their profile gradually.
// Role, status, email, phone and the "featured" flag cannot be set here.
const updateProfile = z.object({
  name: line(2, 80, 'Full name').optional(),
  profile: z
    .object({
      professionalTitle: line(0, 120, 'Professional title'),
      specialization: line(0, 80, 'Specialization'),
      subspecialty: line(0, 80, 'Subspecialty'),
      designation: line(0, 120, 'Designation'),
      hospital: line(0, 160, 'Hospital or clinic'),
      city: line(0, 80, 'City'),
      state: line(0, 80, 'State'),
      batchYear: year,
      yearsOfExperience: z.union([z.null(), z.number().int().min(0, 'Enter a valid number.').max(80, 'Enter a valid number.')]),
      bio: text(0, 1200, 'Biography'),
      qualifications: tagList(12, 80, 'Qualification'),
      interests: tagList(15, 60, 'Interest'),
      languages: tagList(12, 40, 'Language'),
      education: z.array(education).max(10, 'Add at most 10 entries.'),
      experience: z.array(experience).max(15, 'Add at most 15 entries.'),
      achievements: z.array(achievement).max(20, 'Add at most 20 entries.'),
      publications: z.array(publication).max(30, 'Add at most 30 entries.'),
      links: z.array(link).max(6, 'Add at most 6 links.'),
    })
    .partial()
    .optional(),
  visibility: z
    .object({
      directory: z.boolean(),
      publicListing: z.boolean(),
      showEmail: z.boolean(),
      showPhone: z.boolean(),
    })
    .partial()
    .optional(),
  dismissProfilePrompt: z.boolean().optional(),
});

const setPhoto = z.object({ mediaId: objectId });

const directoryQuery = z.object({
  q: z.string().trim().max(60).optional(),
  specialization: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  page,
  limit: limit(12, 48),
});

module.exports = { updateProfile, setPhoto, directoryQuery };
