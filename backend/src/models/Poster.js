const mongoose = require('mongoose');
const {
  POSTER_TEMPLATES,
  POSTER_STATUS,
  POSTER_PORTRAIT_PLACEMENTS,
  POSTER_PHOTO_SOURCES,
  POSTER_SECTIONS,
  POSTER_LIMITS: L,
} = require('../config/constants');

const { Schema } = mongoose;

const str = (max) => ({ type: String, trim: true, maxlength: max, default: '' });
const yearField = { type: Number, min: 1940, max: 2100, default: null };

// A contact detail is printed only when `include` is true. Nothing is copied
// from the account automatically: the doctor chooses each value and each switch.
const contactField = (max) => ({
  value: str(max),
  include: { type: Boolean, default: false },
});

const mediaRef = { type: Schema.Types.ObjectId, ref: 'Media', default: null };

// A doctor's batch profile poster. Private: only its owner can read, change,
// export or delete it. The content is a poster-specific copy — editing it never
// changes the doctor's profile. Photos are Cloudinary assets referenced by id.
const posterSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: str(L.title),
    template: { type: String, enum: Object.keys(POSTER_TEMPLATES), required: true },
    templateVersion: { type: Number, required: true, default: 1 },
    status: { type: String, enum: Object.values(POSTER_STATUS), default: POSTER_STATUS.DRAFT, required: true },

    basic: {
      displayName: str(L.displayName),
      professionalTitle: str(L.professionalTitle),
      batchYear: yearField,
      college: str(L.college),
      hometown: str(L.hometown),
      dateOfBirth: { type: String, default: '' }, // "YYYY-MM-DD" or ''
      showBirthYear: { type: Boolean, default: false },
      showZodiac: { type: Boolean, default: false }, // the sign is derived from dateOfBirth when shown
    },
    professional: {
      specialization: str(L.specialization),
      workplace: str(L.workplace),
      role: str(L.role),
      qualifications: str(L.qualifications),
      achievements: str(L.achievements),
      milestones: str(L.milestones),
    },
    messages: {
      greeting: str(L.greeting),
      introduction: str(L.introduction),
      messageToFriends: str(L.messageToFriends),
      quotation: str(L.quotation),
      quotationAuthor: str(L.quotationAuthor),
      memory: str(L.memory),
      batchMessage: str(L.batchMessage),
      closing: str(L.closing),
      signature: str(L.signature),
    },
    // Reunion / anniversary details are entered by the doctor — never computed.
    celebration: {
      title: str(L.celebrationTitle),
      years: { type: Number, min: 1, max: L.celebrationYearsMax, default: null },
      eventYear: yearField,
      tagline: str(L.celebrationTagline),
    },
    contact: {
      email: contactField(L.contactEmail),
      phone: contactField(L.contactPhone),
      address: contactField(L.contactAddress),
      website: contactField(L.contactWebsite),
    },
    photos: {
      portraitSource: { type: String, enum: POSTER_PHOTO_SOURCES, default: 'NONE' },
      portrait: mediaRef,
      family: mediaRef,
      college: mediaRef,
      memory: mediaRef,
    },
    settings: {
      palette: { type: String, trim: true, maxlength: 20, default: '' },
      portraitPlacement: { type: String, enum: POSTER_PORTRAIT_PLACEMENTS, default: 'LEFT' },
      sections: Object.fromEntries(
        POSTER_SECTIONS.map((key) => [key, { type: Boolean, default: key !== 'birthday' }])
      ),
    },

    lastExportedAt: { type: Date, default: null },
    exportCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

posterSchema.index({ owner: 1, updatedAt: -1 });

module.exports = mongoose.model('Poster', posterSchema);
