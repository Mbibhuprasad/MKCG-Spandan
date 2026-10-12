const mongoose = require('mongoose');
const { RSVP_STATUS } = require('../config/constants');

const { Schema } = mongoose;

const rsvpSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: RSVP_STATUS, required: true },
    guests: { type: Number, min: 0, max: 5, default: 0 },
  },
  { timestamps: true }
);

// One RSVP per doctor per event — enforced by the database.
rsvpSchema.index({ event: 1, user: 1 }, { unique: true });
rsvpSchema.index({ user: 1 });

module.exports = mongoose.model('Rsvp', rsvpSchema);
