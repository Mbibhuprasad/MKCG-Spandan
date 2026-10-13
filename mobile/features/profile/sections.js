// The doctor profile, described as data. Each section mirrors one step of the
// website's profile wizard (frontend/…/profile-wizard/model.js) and owns the
// same request-body keys, so saving a section sends exactly those keys to
// PATCH /doctors/me and never touches the rest of the profile. `step` is the
// wizard position the API stores (PROFILE_WIZARD_STEPS = 9 on the server).
//
// Field types: text | multiline | year | select | bool | tags | phone | email | url
// Limits repeat the API's validators (backend/src/validators/doctor.validators.js).
import {
  BLOOD_GROUPS,
  CREDENTIAL_TYPES,
  DEGREE_LEVELS,
  EMPLOYMENT_TYPES,
  INDIAN_STATES,
} from "@/utils/constants";
import { joinParts, yearRange } from "@/utils/format";

const year = (key, label) => ({ key, label, type: "year" });

export const LISTS = {
  experience: {
    key: "experience",
    label: "Work experience",
    itemLabel: "position",
    max: 15,
    fields: [
      {
        key: "role",
        label: "Role",
        required: true,
        max: 120,
        placeholder: "Consultant Cardiologist",
      },
      { key: "organization", label: "Hospital or organisation", max: 160 },
      {
        key: "employmentType",
        label: "Type",
        type: "select",
        options: EMPLOYMENT_TYPES,
      },
      { key: "city", label: "City", max: 80 },
      { key: "state", label: "State", max: 80 },
      year("startYear", "From year"),
      year("endYear", "To year"),
      { key: "current", label: "I work here now", type: "bool" },
      { key: "description", label: "Description", type: "multiline", max: 600 },
    ],
    range: [
      "startYear",
      "endYear",
      "The end year cannot be before the start year.",
    ],
    summary: (e) => [
      e.role,
      joinParts([e.organization, yearRange(e.startYear, e.endYear, e.current)]),
    ],
  },
  education: {
    key: "education",
    label: "Education",
    itemLabel: "qualification",
    max: 10,
    fields: [
      {
        key: "degree",
        label: "Degree",
        required: true,
        max: 120,
        placeholder: "MBBS",
      },
      { key: "level", label: "Level", type: "select", options: DEGREE_LEVELS },
      {
        key: "institution",
        label: "College or university",
        max: 160,
        placeholder: "Your medical college",
      },
      { key: "fieldOfStudy", label: "Field of study", max: 120 },
      year("startYear", "Start year"),
      year("year", "Completion year"),
      { key: "certification", label: "Academic certification", max: 160 },
      { key: "details", label: "Details", type: "multiline", max: 400 },
    ],
    range: [
      "startYear",
      "year",
      "The completion year cannot be before the start year.",
    ],
    summary: (e) => [
      joinParts([e.degree, e.fieldOfStudy], ", "),
      joinParts([e.institution, yearRange(e.startYear, e.year)]),
    ],
  },
  credentials: {
    key: "credentials",
    label: "Professional qualifications",
    itemLabel: "qualification",
    max: 15,
    fields: [
      {
        key: "title",
        label: "Qualification",
        required: true,
        max: 160,
        placeholder: "FRCS, DNB, Board certification…",
      },
      { key: "type", label: "Type", type: "select", options: CREDENTIAL_TYPES },
      { key: "institution", label: "Awarding institution", max: 160 },
      year("year", "Year"),
      {
        key: "registration",
        label: "Registration details",
        max: 120,
        help: 'Private unless you switch on "Show registration details".',
      },
      { key: "details", label: "Details", type: "multiline", max: 400 },
    ],
    summary: (c) => [c.title, joinParts([c.institution, c.year])],
  },
  fellowships: {
    key: "fellowships",
    label: "Fellowships and postdoctoral certification",
    itemLabel: "fellowship",
    max: 10,
    fields: [
      { key: "title", label: "Title", required: true, max: 160 },
      { key: "institution", label: "Institution", max: 160 },
      { key: "specialty", label: "Specialty", max: 120 },
      year("startYear", "Start year"),
      year("endYear", "Completion year"),
      { key: "certificate", label: "Certificate", max: 160 },
      { key: "description", label: "Description", type: "multiline", max: 600 },
    ],
    range: [
      "startYear",
      "endYear",
      "The completion year cannot be before the start year.",
    ],
    summary: (f) => [
      f.title,
      joinParts([f.institution, yearRange(f.startYear, f.endYear)]),
    ],
  },
  achievements: {
    key: "achievements",
    label: "Awards",
    itemLabel: "award",
    max: 20,
    // `imageId` (an award photo added on the website) is carried through
    // untouched so saving from the phone never removes it.
    keep: ["imageId"],
    fields: [
      { key: "title", label: "Title", required: true, max: 160 },
      { key: "issuer", label: "Awarding organisation", max: 160 },
      year("year", "Year"),
      { key: "description", label: "Description", type: "multiline", max: 400 },
    ],
    summary: (a) => [a.title, joinParts([a.issuer, a.year])],
  },
  memberships: {
    key: "memberships",
    label: "Memberships",
    itemLabel: "membership",
    max: 15,
    fields: [
      {
        key: "organization",
        label: "Organisation",
        required: true,
        max: 160,
        placeholder: "Indian Medical Association",
      },
      {
        key: "type",
        label: "Membership type",
        max: 120,
        placeholder: "Life member",
      },
      {
        key: "number",
        label: "Membership number",
        max: 80,
        help: 'Private unless you switch on "Show registration details".',
      },
      year("startYear", "From year"),
      year("endYear", "To year"),
      { key: "current", label: "Current member", type: "bool" },
    ],
    range: [
      "startYear",
      "endYear",
      "The end year cannot be before the start year.",
    ],
    summary: (m) => [
      m.organization,
      joinParts([m.type, yearRange(m.startYear, m.endYear, m.current)]),
    ],
  },
  publications: {
    key: "publications",
    label: "Publications",
    itemLabel: "publication",
    max: 30,
    fields: [
      { key: "title", label: "Title", required: true, max: 240 },
      { key: "journal", label: "Journal", max: 160 },
      { key: "authors", label: "Authors", max: 300 },
      year("year", "Year"),
      {
        key: "url",
        label: "Link",
        type: "url",
        max: 300,
        placeholder: "https://…",
      },
      { key: "description", label: "Description", type: "multiline", max: 600 },
    ],
    summary: (p) => [p.title, joinParts([p.journal, p.year])],
  },
  practiceLocations: {
    key: "practiceLocations",
    label: "Other places where you practise",
    itemLabel: "location",
    max: 5,
    fields: [
      {
        key: "hospital",
        label: "Hospital or clinic",
        required: true,
        max: 160,
      },
      { key: "designation", label: "Designation", max: 120 },
      { key: "area", label: "Area", max: 160 },
      { key: "address", label: "Address", max: 240 },
      { key: "city", label: "City", max: 80 },
      { key: "state", label: "State", max: 80 },
      { key: "country", label: "Country", max: 80 },
      {
        key: "phone",
        label: "Phone",
        type: "phone",
        help: "Shown to members only while workplace contact is switched on.",
      },
    ],
    summary: (l) => [l.hospital, joinParts([l.designation, l.city])],
  },
  links: {
    key: "links",
    label: "Professional links",
    itemLabel: "link",
    max: 6,
    fields: [
      {
        key: "label",
        label: "Label",
        required: true,
        max: 40,
        placeholder: "Google Scholar",
      },
      {
        key: "url",
        label: "Link",
        type: "url",
        required: true,
        max: 300,
        placeholder: "https://…",
      },
    ],
    summary: (l) => [l.label, l.url],
  },
};

export const SECTIONS = [
  {
    key: "basic",
    step: 0,
    icon: "person-outline",
    title: "Basic profile",
    description:
      "Photo, title and a short biography — how batchmates recognise you.",
    photo: true,
    top: ["name"],
    fields: [
      { key: "name", top: true, label: "Full name", required: true, max: 80 },
      {
        key: "professionalTitle",
        label: "Professional title",
        max: 120,
        placeholder: "Consultant Cardiologist",
      },
      {
        key: "headline",
        label: "Headline",
        max: 160,
        placeholder: "One line about your work",
      },
      { key: "bio", label: "Biography", type: "multiline", max: 1200, rows: 5 },
      {
        key: "languages",
        label: "Languages",
        type: "tags",
        max: 40,
        maxItems: 12,
      },
      {
        key: "bloodGroup",
        label: "Blood group",
        type: "select",
        options: BLOOD_GROUPS,
        help: "Private unless you choose to show it to members.",
      },
      { key: "address", label: "Area or locality", max: 240 },
    ],
    lists: [],
  },
  {
    key: "expertise",
    step: 1,
    icon: "medkit-outline",
    title: "Specialization & experience",
    description: "What you do, and where you have worked.",
    fields: [
      {
        key: "specialization",
        label: "Primary specialization",
        type: "specialization",
        required: true,
      },
      { key: "subspecialty", label: "Subspecialization", type: "subspecialty" },
      { key: "fieldOfWork", label: "Field of work", max: 120 },
      {
        key: "expertise",
        label: "Areas of expertise",
        type: "tags",
        max: 80,
        maxItems: 20,
      },
      {
        key: "procedures",
        label: "Procedures",
        type: "tags",
        max: 100,
        maxItems: 30,
      },
    ],
    lists: ["experience"],
  },
  {
    key: "education",
    step: 2,
    icon: "school-outline",
    title: "Education & qualifications",
    description: "Academic degrees and professional qualifications.",
    fields: [
      {
        key: "qualifications",
        label: "Qualifications (short form)",
        type: "tags",
        max: 80,
        maxItems: 12,
        placeholder: "MBBS, MD, DM…",
      },
    ],
    lists: ["education", "credentials"],
  },
  {
    key: "practice",
    step: 3,
    icon: "business-outline",
    title: "Practice & contacts",
    description:
      "Where you practise, and your WhatsApp number for the contact feature.",
    whatsapp: true,
    visibility: ["showWorkContact"],
    fields: [
      { key: "hospital", label: "Hospital or clinic", max: 160 },
      { key: "designation", label: "Designation", max: 120 },
      { key: "practiceArea", label: "Clinical practice area", max: 160 },
      { key: "city", label: "City", required: true, max: 80 },
      {
        key: "state",
        label: "State",
        type: "select",
        options: INDIAN_STATES,
        searchable: true,
        allowCustom: true,
      },
      { key: "country", label: "Country", max: 80 },
      {
        key: "workAddress",
        label: "Workplace address",
        max: 240,
        help: "Professional address only — never a home address.",
      },
      { key: "workPhone", label: "Workplace phone", type: "phone" },
      { key: "workEmail", label: "Workplace email", type: "email" },
    ],
    lists: ["practiceLocations"],
  },
  {
    key: "fellowships",
    step: 4,
    icon: "ribbon-outline",
    title: "Fellowships",
    description: "Fellowships and postdoctoral certification.",
    fields: [],
    lists: ["fellowships"],
  },
  {
    key: "awards",
    step: 5,
    icon: "trophy-outline",
    title: "Awards & memberships",
    description: "Recognition and the professional bodies you belong to.",
    fields: [],
    lists: ["achievements", "memberships"],
  },
  {
    key: "publications",
    step: 6,
    icon: "document-text-outline",
    title: "Publications & links",
    description: "Research, papers and professional links.",
    fields: [],
    lists: ["publications", "links"],
  },
];

// The short form shown as the first onboarding step: the handful of details that
// make a new member recognisable. Everything else can be added later from
// Profile → Edit profile, which uses the full sections above.
export const ESSENTIALS = {
  key: "essentials",
  step: 0,
  icon: "person-outline",
  title: "Complete your profile",
  description:
    "A few details so batchmates can find and recognise you. You can add the rest any time.",
  photo: true,
  whatsapp: true,
  fields: [
    {
      key: "professionalTitle",
      label: "Professional title",
      max: 120,
      placeholder: "Consultant Cardiologist",
    },
    {
      key: "specialization",
      label: "Primary specialization",
      type: "specialization",
    },
    { key: "hospital", label: "Hospital or clinic", max: 160 },
    { key: "city", label: "City", max: 80 },
    {
      key: "bio",
      label: "Short biography",
      type: "multiline",
      max: 1200,
      rows: 4,
    },
  ],
  lists: [],
};

export const sectionByKey = (key) =>
  SECTIONS.find((s) => s.key === key) || null;

// How much of a section is filled in, from the saved account (for the hub list).
export function sectionProgress(section, user) {
  const p = user.profile;
  let filled = 0;
  let total = 0;
  for (const field of section.fields) {
    total += 1;
    const value = field.top ? user[field.key] : p[field.key];
    if (
      Array.isArray(value)
        ? value.length
        : value !== null && value !== undefined && value !== ""
    )
      filled += 1;
  }
  for (const key of section.lists) {
    total += 1;
    if ((p[key] || []).length) filled += 1;
  }
  if (section.photo) {
    total += 1;
    if (p.photoUrl) filled += 1;
  }
  if (section.whatsapp) {
    total += 1;
    if (user.whatsapp && user.whatsapp.number) filled += 1;
  }
  return { filled, total };
}
