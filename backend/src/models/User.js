const mongoose = require('mongoose');
const {
  ROLES,
  ACCOUNT_STATUS,
  EMPLOYMENT_TYPES,
  DEGREE_LEVELS,
  BLOOD_GROUPS,
  CREDENTIAL_TYPES,
  PROFILE_SECTIONS,
  PROFILE_WIZARD_LEGACY_STEP_MAP,
} = require('../config/constants');

const { Schema } = mongoose;

const educationSchema = new Schema(
  {
    degree: { type: String, trim: true, maxlength: 120, required: true },
    level: { type: String, enum: ['', ...DEGREE_LEVELS], default: '' },
    certification: { type: String, trim: true, maxlength: 160, default: '' }, // academic certification
    institution: { type: String, trim: true, maxlength: 160, default: '' },
    fieldOfStudy: { type: String, trim: true, maxlength: 120, default: '' },
    startYear: { type: Number, min: 1940, max: 2100, default: null },
    year: { type: Number, min: 1940, max: 2100, default: null }, // completion year
    details: { type: String, trim: true, maxlength: 400, default: '' },
  },
  { _id: true }
);

// Professional qualifications, kept apart from academic education. Everything
// here is self-declared: the platform does not verify registrations.
const credentialSchema = new Schema(
  {
    title: { type: String, trim: true, maxlength: 160, required: true },
    type: { type: String, enum: ['', ...CREDENTIAL_TYPES], default: '' },
    institution: { type: String, trim: true, maxlength: 160, default: '' },
    year: { type: Number, min: 1940, max: 2100, default: null },
    registration: { type: String, trim: true, maxlength: 120, default: '' }, // private unless visibility.showRegistration
    details: { type: String, trim: true, maxlength: 400, default: '' },
  },
  { _id: true }
);

const fellowshipSchema = new Schema(
  {
    title: { type: String, trim: true, maxlength: 160, required: true },
    institution: { type: String, trim: true, maxlength: 160, default: '' },
    specialty: { type: String, trim: true, maxlength: 120, default: '' },
    startYear: { type: Number, min: 1940, max: 2100, default: null },
    endYear: { type: Number, min: 1940, max: 2100, default: null },
    certificate: { type: String, trim: true, maxlength: 160, default: '' },
    description: { type: String, trim: true, maxlength: 600, default: '' },
  },
  { _id: true }
);

const experienceSchema = new Schema(
  {
    role: { type: String, trim: true, maxlength: 120, required: true },
    organization: { type: String, trim: true, maxlength: 160, default: '' },
    employmentType: { type: String, enum: ['', ...EMPLOYMENT_TYPES], default: '' },
    city: { type: String, trim: true, maxlength: 80, default: '' },
    state: { type: String, trim: true, maxlength: 80, default: '' },
    startYear: { type: Number, min: 1940, max: 2100, default: null },
    endYear: { type: Number, min: 1940, max: 2100, default: null },
    current: { type: Boolean, default: false },
    description: { type: String, trim: true, maxlength: 600, default: '' },
  },
  { _id: true }
);

const achievementSchema = new Schema(
  {
    title: { type: String, trim: true, maxlength: 160, required: true },
    issuer: { type: String, trim: true, maxlength: 160, default: '' }, // awarding organisation
    year: { type: Number, min: 1940, max: 2100, default: null },
    description: { type: String, trim: true, maxlength: 400, default: '' },
    // Optional award photo or certificate: a Cloudinary asset, never binary data.
    image: {
      media: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
      url: { type: String, default: '' },
      thumbUrl: { type: String, default: '' },
    },
  },
  { _id: true }
);

const publicationSchema = new Schema(
  {
    title: { type: String, trim: true, maxlength: 240, required: true },
    journal: { type: String, trim: true, maxlength: 160, default: '' },
    authors: { type: String, trim: true, maxlength: 300, default: '' },
    description: { type: String, trim: true, maxlength: 600, default: '' },
    year: { type: Number, min: 1940, max: 2100, default: null },
    url: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { _id: true }
);

// Professional memberships. The number is private unless visibility.showRegistration.
const membershipSchema = new Schema(
  {
    organization: { type: String, trim: true, maxlength: 160, required: true },
    type: { type: String, trim: true, maxlength: 120, default: '' }, // membership type or designation
    number: { type: String, trim: true, maxlength: 80, default: '' },
    startYear: { type: Number, min: 1940, max: 2100, default: null },
    endYear: { type: Number, min: 1940, max: 2100, default: null },
    current: { type: Boolean, default: false },
  },
  { _id: true }
);

// Additional places where the doctor practises (the main one is on the profile itself).
const practiceLocationSchema = new Schema(
  {
    hospital: { type: String, trim: true, maxlength: 160, required: true },
    designation: { type: String, trim: true, maxlength: 120, default: '' },
    area: { type: String, trim: true, maxlength: 160, default: '' },
    address: { type: String, trim: true, maxlength: 240, default: '' },
    city: { type: String, trim: true, maxlength: 80, default: '' },
    state: { type: String, trim: true, maxlength: 80, default: '' },
    country: { type: String, trim: true, maxlength: 80, default: '' },
    phone: { type: String, trim: true, maxlength: 16, default: '' }, // shown only with visibility.showWorkContact
  },
  { _id: true }
);

const linkSchema = new Schema(
  {
    label: { type: String, trim: true, maxlength: 40, required: true },
    url: { type: String, trim: true, maxlength: 300, required: true },
  },
  { _id: true }
);

const profileSchema = new Schema(
  {
    photo: {
      media: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
      url: { type: String, default: '' },
      thumbUrl: { type: String, default: '' },
    },
    professionalTitle: { type: String, trim: true, maxlength: 120, default: '' },
    headline: { type: String, trim: true, maxlength: 160, default: '' },
    // Optional and private: other members see it only with visibility.showBloodGroup.
    bloodGroup: { type: String, enum: ['', ...BLOOD_GROUPS], default: '' },
    // Optional, stored as midnight UTC of the calendar date. Only the doctor and
    // admins ever receive it; members only see the doctor in "Today's Birthdays".
    dateOfBirth: { type: Date, default: null },
    address: { type: String, trim: true, maxlength: 240, default: '' }, // area or locality, entered in the basic profile step
    specialization: { type: String, trim: true, maxlength: 80, default: '' },
    subspecialty: { type: String, trim: true, maxlength: 80, default: '' },
    fieldOfWork: { type: String, trim: true, maxlength: 120, default: '' },
    expertise: { type: [{ type: String, trim: true, maxlength: 80 }], default: [] },
    procedures: { type: [{ type: String, trim: true, maxlength: 100 }], default: [] },
    practiceArea: { type: String, trim: true, maxlength: 160, default: '' },
    designation: { type: String, trim: true, maxlength: 120, default: '' },
    hospital: { type: String, trim: true, maxlength: 160, default: '' },
    city: { type: String, trim: true, maxlength: 80, default: '' },
    state: { type: String, trim: true, maxlength: 80, default: '' },
    country: { type: String, trim: true, maxlength: 80, default: '' },
    // Professional (workplace) details only — never a home address.
    workAddress: { type: String, trim: true, maxlength: 240, default: '' },
    workEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    workPhone: { type: String, trim: true, maxlength: 16, default: '' },
    batchYear: { type: Number, min: 1940, max: 2100, default: null },
    yearsOfExperience: { type: Number, min: 0, max: 80, default: null },
    bio: { type: String, trim: true, maxlength: 1200, default: '' },
    qualifications: { type: [{ type: String, trim: true, maxlength: 80 }], default: [] },
    interests: { type: [{ type: String, trim: true, maxlength: 60 }], default: [] }, // no longer collected by the profile form
    languages: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },
    education: { type: [educationSchema], default: [] },
    credentials: { type: [credentialSchema], default: [] },
    experience: { type: [experienceSchema], default: [] },
    fellowships: { type: [fellowshipSchema], default: [] },
    achievements: { type: [achievementSchema], default: [] }, // shown as "Awards"
    memberships: { type: [membershipSchema], default: [] },
    practiceLocations: { type: [practiceLocationSchema], default: [] },
    publications: { type: [publicationSchema], default: [] },
    links: { type: [linkSchema], default: [] },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    role: { type: String, enum: Object.values(ROLES), default: ROLES.DOCTOR, required: true, immutable: true },
    status: { type: String, enum: Object.values(ACCOUNT_STATUS), default: ACCOUNT_STATUS.ACTIVE, required: true },
    name: { type: String, trim: true, minlength: 2, maxlength: 80, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, required: true, unique: true, trim: true, maxlength: 16 },
    passwordHash: { type: String, required: true, select: false },
    passwordChangedAt: { type: Date, default: null },

    // WhatsApp number for the member contact feature (required before one-to-one
    // chat). `sameAsPhone` reuses the registered phone number instead of storing it twice.
    whatsapp: {
      sameAsPhone: { type: Boolean, default: false },
      number: { type: String, trim: true, maxlength: 16, default: '' },
    },

    policyAcceptance: {
      version: { type: String, default: '' },
      acceptedAt: { type: Date, default: null },
    },

    profile: { type: profileSchema, default: () => ({}) },
    profilePromptDismissedAt: { type: Date, default: null },
    // Profile wizard: where the doctor left off, and when they submitted it.
    // Only the profile endpoint sets these; `completedAt` is never client-supplied.
    profileWizard: {
      // The upper bound still admits positions saved by the former 11-step wizard.
      step: { type: Number, min: 0, max: PROFILE_WIZARD_LEGACY_STEP_MAP.length - 1, default: 0 },
      // Which step order `step` refers to (see PROFILE_WIZARD_LAYOUT). Accounts
      // that have not saved a position since the steps were reorganised stay on 1.
      layout: { type: Number, default: 1 },
      completedAt: { type: Date, default: null },
    },

    visibility: {
      directory: { type: Boolean, default: true }, // listed in the member directory
      portfolio: { type: Boolean, default: true }, // full portfolio open to members (otherwise a name card only)
      publicListing: { type: Boolean, default: false }, // consent to appear on the public homepage
      showEmail: { type: Boolean, default: false }, // email visible to members
      showPhone: { type: Boolean, default: false }, // phone visible to members
      showWhatsapp: { type: Boolean, default: true }, // WhatsApp number visible to members (contact action in chat)
      showWorkContact: { type: Boolean, default: true }, // workplace email / phone visible to members
      showRegistration: { type: Boolean, default: false }, // registration details visible to members
      showBloodGroup: { type: Boolean, default: false }, // blood group visible to members
      showBirthday: { type: Boolean, default: true }, // listed in "Today's Birthdays" on their birthday (the date itself is never shown)
      // Portfolio sections shown to other members (the doctor and admins always see all).
      sections: Object.fromEntries(PROFILE_SECTIONS.map((key) => [key, { type: Boolean, default: true }])),
    },

    featured: { type: Boolean, default: false }, // admin-approved for the public homepage

    suspension: {
      reason: { type: String, trim: true, maxlength: 500, default: '' },
      at: { type: Date, default: null },
      by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    },

    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, status: 1, 'visibility.directory': 1, name: 1 });
userSchema.index({ role: 1, status: 1, 'profile.specialization': 1 });
userSchema.index({ role: 1, status: 1, 'profile.city': 1 });
userSchema.index({ featured: 1, role: 1, status: 1 });

module.exports = mongoose.model('User', userSchema);
