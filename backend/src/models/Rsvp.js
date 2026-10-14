const mongoose = require('mongoose');
const { RSVP_STATUS } = require('../config/constants');

const { Schema } = mongoose;

const rsvpSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: RSVP_STATUS, required: true },
    guests: { type: Number, min: 0, max: 5, default: 0 },
    // The member's own travel plan for the event, shown on its Event Schedule:
    // where they travel from (a place they typed — never a tracked location)
    // and when they arrive and leave. A plan exists when `arrivalAt` is set.
    travel: {
      from: { type: String, trim: true, maxlength: 120, default: '' },
      arrivalAt: { type: Date, default: null },
      departureAt: { type: Date, default: null },
      note: { type: String, trim: true, maxlength: 300, default: '' },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// One RSVP per doctor per event — enforced by the database.
rsvpSchema.index({ event: 1, user: 1 }, { unique: true });
rsvpSchema.index({ user: 1 });
rsvpSchema.index({ event: 1, 'travel.arrivalAt': 1 }); // the Event Schedule, earliest arrival first

module.exports = mongoose.model('Rsvp', rsvpSchema);
