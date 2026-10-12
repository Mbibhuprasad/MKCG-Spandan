const mongoose = require('mongoose');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');

const { Schema } = mongoose;

const educationSchema = new Schema(
  {
    degree: { type: String, trim: true, maxlength: 120, required: true },
    institution: { type: String, trim: true, maxlength: 160, default: '' },
    year: { type: Number, min: 1940, max: 2100, default: null },
  },
  { _id: true }
);

const experienceSchema = new Schema(
  {
    role: { type: String, trim: true, maxlength: 120, required: true },
    organization: { type: String, trim: true, maxlength: 160, default: '' },
    city: { type: String, trim: true, maxlength: 80, default: '' },
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
    year: { type: Number, min: 1940, max: 2100, default: null },
    description: { type: String, trim: true, maxlength: 400, default: '' },
  },
  { _id: true }
);

const publicationSchema = new Schema(
  {
    title: { type: String, trim: true, maxlength: 240, required: true },
    journal: { type: String, trim: true, maxlength: 160, default: '' },
    year: { type: Number, min: 1940, max: 2100, default: null },
    url: { type: String, trim: true, maxlength: 300, default: '' },
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
    specialization: { type: String, trim: true, maxlength: 80, default: '' },
    subspecialty: { type: String, trim: true, maxlength: 80, default: '' },
    designation: { type: String, trim: true, maxlength: 120, default: '' },
    hospital: { type: String, trim: true, maxlength: 160, default: '' },
    city: { type: String, trim: true, maxlength: 80, default: '' },
    state: { type: String, trim: true, maxlength: 80, default: '' },
    batchYear: { type: Number, min: 1940, max: 2100, default: null },
    yearsOfExperience: { type: Number, min: 0, max: 80, default: null },
    bio: { type: String, trim: true, maxlength: 1200, default: '' },
    qualifications: { type: [{ type: String, trim: true, maxlength: 80 }], default: [] },
    interests: { type: [{ type: String, trim: true, maxlength: 60 }], default: [] },
    languages: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },
    education: { type: [educationSchema], default: [] },
    experience: { type: [experienceSchema], default: [] },
    achievements: { type: [achievementSchema], default: [] },
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

    policyAcceptance: {
      version: { type: String, default: '' },
      acceptedAt: { type: Date, default: null },
    },

    profile: { type: profileSchema, default: () => ({}) },
    profilePromptDismissedAt: { type: Date, default: null },

    visibility: {
      directory: { type: Boolean, default: true }, // listed in the member directory
      publicListing: { type: Boolean, default: false }, // consent to appear on the public homepage
      showEmail: { type: Boolean, default: false }, // email visible to members
      showPhone: { type: Boolean, default: false }, // phone visible to members
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
