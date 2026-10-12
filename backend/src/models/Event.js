const mongoose = require('mongoose');
const moderationPlugin = require('./plugins/moderation');
const { EVENT_TYPES } = require('../config/constants');

const { Schema } = mongoose;

// Events and voluntary visit plans (eventType === 'VISIT_PLAN') share one model.
// Only a city/venue and dates are stored — there is no location tracking.
const eventSchema = new Schema(
  {
    organizer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, maxlength: 4000 },
    eventType: { type: String, enum: EVENT_TYPES, required: true },
    venue: { type: String, trim: true, maxlength: 200, default: '' },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    budgetNote: { type: String, trim: true, maxlength: 140, default: '' },
    cover: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
    rsvpEnabled: { type: Boolean, default: true },
    rsvpDeadline: { type: Date, default: null },
    capacity: { type: Number, min: 1, max: 100000, default: null },
    showOnPublicSite: { type: Boolean, default: false },
    commentCount: { type: Number, default: 0, min: 0 },
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

eventSchema.plugin(moderationPlugin);
eventSchema.index({ moderationStatus: 1, endsAt: 1 });
eventSchema.index({ moderationStatus: 1, startsAt: 1 });
eventSchema.index({ moderationStatus: 1, eventType: 1, submittedAt: 1 });
eventSchema.index({ organizer: 1, createdAt: -1 });

module.exports = mongoose.model('Event', eventSchema);
