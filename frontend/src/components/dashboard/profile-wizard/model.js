// Profile wizard model: the steps, the mapping between the saved account and
// the form, the request body each step owns, and the client-side checks.
// The API validates everything again — these checks only give faster feedback.
import {
  Award,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Images,
  MapPin,
  Medal,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { DEFAULT_COUNTRY, PROFILE_SECTIONS } from "@/lib/constants";
import { sameText } from "@/lib/specialties";

export const YEAR_MIN = 1940;
export const YEAR_MAX = 2100;
export const BIO_MAX = 1200;

export const LIST_LIMITS = {
  education: 10,
  credentials: 15,
  experience: 15,
  fellowships: 10,
  achievements: 20,
  memberships: 15,
  practiceLocations: 5,
  publications: 30,
  links: 6,
};

// `top` and `profile` name the request-body keys a step owns: saving a step
// sends exactly those, so a half-finished later step never blocks an earlier one.
// The gallery step owns none: memories and blogs are saved through their own
// APIs the moment they are created, like the profile photo.
// The order here is the order of the wizard; the API keeps the same count
// (PROFILE_WIZARD_STEPS in backend/src/config/constants.js).
export const STEPS = [
  {
    id: "basic",
    title: "Basic profile",
    short: "Basic profile",
    icon: UserRound,
    description:
      "How batchmates will recognise you. Your name is carried over from registration.",
    top: ["name"],
    profile: [
      "professionalTitle",
      "designation",
      "headline",
      "bloodGroup",
      "dateOfBirth",
      "address",
      "bio",
      "languages",
    ],
  },
  {
    id: "expertise",
    title: "Specialization & Expertise",
    short: "Specialization & Expertise",
    icon: Stethoscope,
    description:
      "What you do. Pick from the lists or type your own — every specialty and every kind of practice is welcome.",
    top: [],
    profile: [
      "specialization",
      "subspecialty",
      "fieldOfWork",
      "expertise",
      "procedures",
      "experience",
    ],
  },
  {
    id: "education",
    title: "Proffesional experience",
    short: "Proffesional experience",
    icon: GraduationCap,
    description:
      "Your degrees and earlier education, and your professional qualifications and certifications.",
    optional: true,
    top: [],
    profile: ["education", "qualifications", "credentials"],
  },

  {
    id: "fellowships",
    title: "Fellowship & Advanced Training",
    short: "Fellowship & Advanced Training",
    icon: Medal,
    description:
      "Fellowships and postdoctoral qualifications. Skip this step if it does not apply to you.",
    optional: true,
    top: [],
    profile: ["fellowships"],
  },
  {
    id: "practice",
    title: "Education & Qualification",
    short: "Education & Qualification",
    icon: MapPin,
    description:
      "Where you practise and how colleagues can reach you there. Workplace details only — never a home address.",
    top: ["whatsapp"],
    profile: [
      "practiceArea",
      "hospital",
      "workAddress",
      "city",
      "state",
      "country",
      "workEmail",
      "workPhone",
      "practiceLocations",
      "links",
    ],
  },
  {
    id: "publications",
    title: "Publications",
    short: "Publications",
    icon: BookOpen,
    description: "Papers, chapters, books and conference work.",
    optional: true,
    top: [],
    profile: ["publications"],
  },
  {
    id: "awards",
    title: "Awards & memberships",
    short: "Awards & memberships",
    icon: Award,
    description:
      "Awards and honours you have received, and the professional bodies you belong to.",
    optional: true,
    top: [],
    profile: ["achievements", "memberships"],
  },

  {
    id: "gallery",
    title: "Gallery & blogs",
    short: "Gallery & blogs",
    icon: Images,
    description:
      "Photos and writing for your portfolio. Each item is published as soon as you save it.",
    optional: true,
    top: [],
    profile: [],
  },
  {
    id: "review",
    title: "Visibility & review",
    short: "Visibility & review",
    icon: ClipboardCheck,
    description:
      "Decide who can see what, then check everything once more. Nothing is final — you can edit your profile whenever you like.",
    top: ["visibility"],
    profile: [],
  },
];

export const LAST_STEP = STEPS.length - 1;
export const stepIndex = (id) => STEPS.findIndex((s) => s.id === id);

const str = (value) =>
  value === null || value === undefined ? "" : String(value);
const num = (value) =>
  value === "" || value === null || value === undefined ? null : Number(value);

let keySeq = 0;
const newKey = () => `new-${++keySeq}`;

export const BLANK = {
  education: () => ({
    key: newKey(),
    degree: "",
    level: "",
    institution: "",
    fieldOfStudy: "",
    startYear: "",
    year: "",
    certification: "",
    details: "",
  }),
  credentials: () => ({
    key: newKey(),
    title: "",
    type: "",
    institution: "",
    year: "",
    registration: "",
    details: "",
  }),
  experience: () => ({
    key: newKey(),
    role: "",
    organization: "",
    employmentType: "",
    city: "",
    state: "",
    startYear: "",
    endYear: "",
    current: false,
    description: "",
  }),
  fellowships: () => ({
    key: newKey(),
    title: "",
    institution: "",
    specialty: "",
    startYear: "",
    endYear: "",
    certificate: "",
    description: "",
  }),
  achievements: () => ({
    key: newKey(),
    title: "",
    issuer: "",
    year: "",
    description: "",
    imageId: null,
    imageUrl: "",
  }),
  memberships: () => ({
    key: newKey(),
    organization: "",
    type: "",
    number: "",
    startYear: "",
    endYear: "",
    current: false,
  }),
  practiceLocations: () => ({
    key: newKey(),
    hospital: "",
    designation: "",
    area: "",
    address: "",
    city: "",
    state: "",
    country: DEFAULT_COUNTRY,
    phone: "",
  }),
  publications: () => ({
    key: newKey(),
    title: "",
    journal: "",
    authors: "",
    year: "",
    description: "",
    url: "",
  }),
  links: () => ({ key: newKey(), label: "", url: "" }),
};

/** The signed-in account (as returned by the API) → wizard form state. */
export function toForm(account) {
  const user = account || {};
  const p = user.profile || {};
  const v = user.visibility || {};
  const w = user.whatsapp || {};
  const sections = v.sections || {};
  return {
    name: user.name || "",
    professionalTitle: p.professionalTitle || "",
    designation: p.designation || "",
    headline: p.headline || "",
    bloodGroup: p.bloodGroup || "",
    dateOfBirth: p.dateOfBirth || "", // "YYYY-MM-DD"
    address: p.address || "",
    bio: p.bio || "",
    languages: [...(p.languages || [])],

    specialization: p.specialization || "",
    subspecialty: p.subspecialty || "",
    // Not sent to the API: the specialization the subspecialization was chosen
    // for, so a later change of specialization can ask about it (see subspecialtyNeedsReview).
    subspecialtyFor: p.specialization || "",
    fieldOfWork: p.fieldOfWork || "",
    expertise: [...(p.expertise || [])],
    procedures: [...(p.procedures || [])],
    experience: (p.experience || []).map((e) => ({
      key: e.id,
      role: e.role || "",
      organization: e.organization || "",
      employmentType: e.employmentType || "",
      city: e.city || "",
      state: e.state || "",
      startYear: str(e.startYear),
      endYear: str(e.endYear),
      current: Boolean(e.current),
      description: e.description || "",
    })),

    practiceArea: p.practiceArea || "",
    hospital: p.hospital || "",
    workAddress: p.workAddress || "",
    city: p.city || "",
    state: p.state || "",
    country: p.country || DEFAULT_COUNTRY,
    workEmail: p.workEmail || "",
    workPhone: p.workPhone || "",
    // "Same as my registered phone" keeps a single copy of that number on the account.
    whatsappSame: Boolean(w.sameAsPhone),
    whatsappNumber: w.sameAsPhone ? "" : w.number || "",
    practiceLocations: (p.practiceLocations || []).map((l) => ({
      key: l.id,
      hospital: l.hospital || "",
      designation: l.designation || "",
      area: l.area || "",
      address: l.address || "",
      city: l.city || "",
      state: l.state || "",
      country: l.country || "",
      phone: l.phone || "",
    })),
    links: (p.links || []).map((l) => ({
      key: l.id,
      label: l.label || "",
      url: l.url || "",
    })),

    education: (p.education || []).map((e) => ({
      key: e.id,
      degree: e.degree || "",
      level: e.level || "",
      institution: e.institution || "",
      fieldOfStudy: e.fieldOfStudy || "",
      startYear: str(e.startYear),
      year: str(e.year),
      certification: e.certification || "",
      details: e.details || "",
    })),
    qualifications: [...(p.qualifications || [])],
    credentials: (p.credentials || []).map((c) => ({
      key: c.id,
      title: c.title || "",
      type: c.type || "",
      institution: c.institution || "",
      year: str(c.year),
      registration: c.registration || "",
      details: c.details || "",
    })),

    fellowships: (p.fellowships || []).map((f) => ({
      key: f.id,
      title: f.title || "",
      institution: f.institution || "",
      specialty: f.specialty || "",
      startYear: str(f.startYear),
      endYear: str(f.endYear),
      certificate: f.certificate || "",
      description: f.description || "",
    })),

    achievements: (p.achievements || []).map((a) => ({
      key: a.id,
      title: a.title || "",
      issuer: a.issuer || "",
      year: str(a.year),
      description: a.description || "",
      imageId: a.imageId || null,
      imageUrl: a.imageThumbUrl || a.imageUrl || "", // preview only; the API derives the stored URL from imageId
    })),

    memberships: (p.memberships || []).map((m) => ({
      key: m.id,
      organization: m.organization || "",
      type: m.type || "",
      number: m.number || "",
      startYear: str(m.startYear),
      endYear: str(m.endYear),
      current: Boolean(m.current),
    })),

    publications: (p.publications || []).map((x) => ({
      key: x.id,
      title: x.title || "",
      journal: x.journal || "",
      authors: x.authors || "",
      year: str(x.year),
      description: x.description || "",
      url: x.url || "",
    })),

    visibility: {
      directory: v.directory !== false,
      portfolio: v.portfolio !== false,
      publicListing: Boolean(v.publicListing),
      showEmail: Boolean(v.showEmail),
      showPhone: Boolean(v.showPhone),
      showWhatsapp: v.showWhatsapp !== false,
      showWorkContact: v.showWorkContact !== false,
      showRegistration: Boolean(v.showRegistration),
      showBloodGroup: Boolean(v.showBloodGroup),
      showBirthday: v.showBirthday !== false,
      sections: Object.fromEntries(
        PROFILE_SECTIONS.map(({ key }) => [key, sections[key] !== false]),
      ),
    },
  };
}

/** Wizard form state → the complete PATCH /doctors/me body. */
export function toPayload(form) {
  return {
    name: form.name,
    whatsapp: {
      sameAsPhone: form.whatsappSame,
      number: form.whatsappSame ? "" : form.whatsappNumber.trim(),
    },
    profile: {
      professionalTitle: form.professionalTitle,
      designation: form.designation,
      headline: form.headline,
      bloodGroup: form.bloodGroup,
      dateOfBirth: form.dateOfBirth || null,
      address: form.address,
      bio: form.bio,
      languages: form.languages,

      specialization: form.specialization,
      subspecialty: form.subspecialty,
      fieldOfWork: form.fieldOfWork,
      expertise: form.expertise,
      procedures: form.procedures,
      experience: form.experience.map((e) => ({
        role: e.role,
        organization: e.organization,
        employmentType: e.employmentType,
        city: e.city,
        state: e.state,
        startYear: num(e.startYear),
        endYear: e.current ? null : num(e.endYear),
        current: e.current,
        description: e.description,
      })),

      practiceArea: form.practiceArea,
      hospital: form.hospital,
      workAddress: form.workAddress,
      city: form.city,
      state: form.state,
      country: form.country,
      workEmail: form.workEmail.trim(),
      workPhone: form.workPhone.trim(),
      practiceLocations: form.practiceLocations.map((l) => ({
        hospital: l.hospital,
        designation: l.designation,
        area: l.area,
        address: l.address,
        city: l.city,
        state: l.state,
        country: l.country,
        phone: l.phone.trim(),
      })),
      links: form.links.map((l) => ({ label: l.label, url: l.url.trim() })),

      education: form.education.map((e) => ({
        degree: e.degree,
        level: e.level,
        institution: e.institution,
        fieldOfStudy: e.fieldOfStudy,
        startYear: num(e.startYear),
        year: num(e.year),
        certification: e.certification,
        details: e.details,
      })),
      qualifications: form.qualifications,
      credentials: form.credentials.map((c) => ({
        title: c.title,
        type: c.type,
        institution: c.institution,
        year: num(c.year),
        registration: c.registration,
        details: c.details,
      })),

      fellowships: form.fellowships.map((f) => ({
        title: f.title,
        institution: f.institution,
        specialty: f.specialty,
        startYear: num(f.startYear),
        endYear: num(f.endYear),
        certificate: f.certificate,
        description: f.description,
      })),

      // The image travels as the id of an upload; the API works out the URL itself.
      achievements: form.achievements.map((a) => ({
        title: a.title,
        issuer: a.issuer,
        year: num(a.year),
        description: a.description,
        imageId: a.imageId || null,
      })),

      memberships: form.memberships.map((m) => ({
        organization: m.organization,
        type: m.type,
        number: m.number,
        startYear: num(m.startYear),
        endYear: m.current ? null : num(m.endYear),
        current: m.current,
      })),

      publications: form.publications.map((x) => ({
        title: x.title,
        journal: x.journal,
        authors: x.authors,
        year: num(x.year),
        description: x.description,
        url: x.url.trim(),
      })),
    },
    visibility: form.visibility,
  };
}

/** The part of a complete request body that one step owns. */
export function stepSlice(payload, stepId) {
  const step = STEPS[stepIndex(stepId)];
  const out = {};
  for (const key of step.top) out[key] = payload[key];
  if (step.profile.length) {
    out.profile = {};
    for (const key of step.profile) out.profile[key] = payload.profile[key];
  }
  return out;
}

/** Combines the slices of several steps into one request body. */
export function mergeSlices(payload, stepIds) {
  const body = {};
  for (const id of stepIds) {
    const { profile, ...top } = stepSlice(payload, id);
    Object.assign(body, top);
    if (profile) body.profile = { ...(body.profile || {}), ...profile };
  }
  return body;
}

/** Which step an API error key such as "profile.education.0.degree" belongs to (-1 if none). */
export function stepOfErrorKey(key) {
  const [head, field] = String(key).split(".");
  return STEPS.findIndex((step) =>
    head === "profile" ? step.profile.includes(field) : step.top.includes(head),
  );
}

/**
 * True while the doctor has changed the specialization but still holds a
 * subspecialization chosen for the previous one that is not an option of the
 * new one. It must then be replaced, cleared or explicitly kept — it is never
 * carried over silently. `isListed(specialization, subspecialty)` comes from
 * the specialty catalogue.
 */
export function subspecialtyNeedsReview(form, isListed = () => false) {
  if (!form.subspecialty.trim()) return false;
  if (sameText(form.specialization, form.subspecialtyFor)) return false;
  return !isListed(form.specialization, form.subspecialty);
}

/**
 * After a save, shows the specialization and subspecialization as the API
 * stored them (it tidies typed values: "spine surgery" → "Spine Surgery").
 * A field the doctor has edited again since `sent` is left alone.
 */
export function adoptStored(form, sent, account) {
  const stored = (account && account.profile) || {};
  const next = { ...form };
  for (const key of ["specialization", "subspecialty"]) {
    if (typeof stored[key] === "string" && form[key] === sent[key])
      next[key] = stored[key];
  }
  if (
    form.specialization === sent.specialization &&
    form.subspecialty === sent.subspecialty
  )
    next.subspecialtyFor = next.specialization;
  return next;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isHttpUrl = (value) => /^https?:\/\/\S+$/i.test(String(value).trim());
const URL_MESSAGE = "Enter a full link starting with http:// or https://";
const PHONE_MESSAGE =
  "Enter a valid phone number, including the country code if outside India.";

function isPhone(value) {
  const raw = String(value).trim();
  if (/[^\d\s()+.-]/.test(raw)) return false;
  const digits = raw.replace(/\D/g, "").length;
  return digits >= 8 && digits <= 15;
}

// Today's date as "YYYY-MM-DD" on the visitor's own calendar.
export function todayInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "" (not stated) or a real calendar date from 1900 up to today.
function dateOfBirthError(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
  if (!date || date.getUTCDate() !== +match[3] || date.getUTCMonth() !== +match[2] - 1 || +match[1] < 1900) {
    return "Enter a valid date of birth.";
  }
  return value > todayInputValue() ? "The date of birth cannot be in the future." : null;
}

function yearError(value) {
  if (value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= YEAR_MIN && n <= YEAR_MAX
    ? null
    : `Enter a year between ${YEAR_MIN} and ${YEAR_MAX}.`;
}

const isBefore = (end, start) =>
  end !== "" && start !== "" && Number(end) < Number(start);

/**
 * Checks one step. Error keys match the API's ("profile.education.0.degree"),
 * so server-side messages land on the same fields.
 * `strict` also demands the fields required for final submission; without it
 * only the format of what has been entered is checked (used for saving a draft).
 * `isListedSubspecialty` is the specialty catalogue's check (see subspecialtyNeedsReview).
 */
export function validateStep(
  form,
  stepId,
  { strict = true, isListedSubspecialty } = {},
) {
  const errors = {};
  const put = (key, message) => {
    if (message && !errors[key]) errors[key] = message;
  };
  const years = (list, index, ...keys) =>
    keys.forEach((key) =>
      put(`profile.${list}.${index}.${key}`, yearError(form[list][index][key])),
    );

  switch (stepId) {
    case "basic":
      if (form.name.trim().length < 2) put("name", "Enter your full name.");
      put("profile.dateOfBirth", dateOfBirthError(form.dateOfBirth));
      break;

    case "expertise":
      if (strict && !form.specialization.trim())
        put(
          "profile.specialization",
          "Choose or type your primary specialization.",
        );
      if (subspecialtyNeedsReview(form, isListedSubspecialty)) {
        put(
          "profile.subspecialty",
          `You changed your specialization. Choose a subspecialization that fits it, clear this one, or confirm that “${form.subspecialty.trim()}” still applies.`,
        );
      }
      form.experience.forEach((e, i) => {
        if (!e.role.trim())
          put(
            `profile.experience.${i}.role`,
            "Designation or job title is required.",
          );
        years("experience", i, "startYear");
        if (!e.current) {
          years("experience", i, "endYear");
          if (isBefore(e.endYear, e.startYear))
            put(
              `profile.experience.${i}.endYear`,
              "The end year cannot be before the start year.",
            );
        }
      });
      break;

    case "education":
      form.education.forEach((e, i) => {
        if (!e.degree.trim())
          put(
            `profile.education.${i}.degree`,
            "Qualification or degree is required.",
          );
        years("education", i, "startYear", "year");
        if (isBefore(e.year, e.startYear))
          put(
            `profile.education.${i}.year`,
            "The completion year cannot be before the start year.",
          );
      });
      form.credentials.forEach((c, i) => {
        if (!c.title.trim())
          put(`profile.credentials.${i}.title`, "Qualification is required.");
        years("credentials", i, "year");
      });
      break;

    case "practice":
      if (strict && !form.city.trim())
        put("profile.city", "Enter the city where you practise.");
      if (form.workEmail.trim() && !EMAIL_RE.test(form.workEmail.trim()))
        put("profile.workEmail", "Enter a valid email address.");
      if (form.workPhone.trim() && !isPhone(form.workPhone))
        put("profile.workPhone", PHONE_MESSAGE);
      if (
        !form.whatsappSame &&
        form.whatsappNumber.trim() &&
        !isPhone(form.whatsappNumber)
      )
        put("whatsapp.number", PHONE_MESSAGE);
      form.practiceLocations.forEach((l, i) => {
        if (!l.hospital.trim())
          put(
            `profile.practiceLocations.${i}.hospital`,
            "Hospital or clinic name is required.",
          );
        if (l.phone.trim() && !isPhone(l.phone))
          put(`profile.practiceLocations.${i}.phone`, PHONE_MESSAGE);
      });
      form.links.forEach((l, i) => {
        if (!l.label.trim())
          put(`profile.links.${i}.label`, "Label is required.");
        if (!isHttpUrl(l.url)) put(`profile.links.${i}.url`, URL_MESSAGE);
      });
      break;

    case "fellowships":
      form.fellowships.forEach((f, i) => {
        if (!f.title.trim())
          put(
            `profile.fellowships.${i}.title`,
            "Fellowship or qualification is required.",
          );
        years("fellowships", i, "startYear", "endYear");
        if (isBefore(f.endYear, f.startYear))
          put(
            `profile.fellowships.${i}.endYear`,
            "The completion year cannot be before the start year.",
          );
      });
      break;

    case "awards":
      form.achievements.forEach((a, i) => {
        if (!a.title.trim())
          put(`profile.achievements.${i}.title`, "Award title is required.");
        years("achievements", i, "year");
      });
      form.memberships.forEach((m, i) => {
        if (!m.organization.trim())
          put(
            `profile.memberships.${i}.organization`,
            "Association or organisation name is required.",
          );
        years("memberships", i, "startYear");
        if (!m.current) {
          years("memberships", i, "endYear");
          if (isBefore(m.endYear, m.startYear))
            put(
              `profile.memberships.${i}.endYear`,
              "The end year cannot be before the start year.",
            );
        }
      });
      break;

    case "publications":
      form.publications.forEach((x, i) => {
        if (!x.title.trim())
          put(
            `profile.publications.${i}.title`,
            "Publication title is required.",
          );
        years("publications", i, "year");
        if (x.url.trim() && !isHttpUrl(x.url))
          put(`profile.publications.${i}.url`, URL_MESSAGE);
      });
      break;

    default:
      break;
  }
  return errors;
}

/** Number of live error messages per step index. */
export function countErrorsByStep(errors) {
  const counts = STEPS.map(() => 0);
  for (const [key, message] of Object.entries(errors)) {
    if (!message) continue;
    const index = stepOfErrorKey(key);
    if (index >= 0) counts[index] += 1;
  }
  return counts;
}
