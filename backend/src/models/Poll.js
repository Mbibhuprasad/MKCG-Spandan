const mongoose = require('mongoose');
const moderationPlugin = require('./plugins/moderation');
const { POLL_RESULTS_VISIBILITY, LIMITS } = require('../config/constants');

const { Schema } = mongoose;

const optionSchema = new Schema({ text: { type: String, required: true, trim: true, maxlength: 140 } }, { _id: true });

const pollSchema = new Schema(
  {
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true, trim: true, maxlength: 240 },
    description: { type: String, default: '', maxlength: 1000 },
    options: {
      type: [optionSchema],
      validate: [
        (v) => v.length >= LIMITS.pollOptionsMin && v.length <= LIMITS.pollOptionsMax,
        `A poll needs between ${LIMITS.pollOptionsMin} and ${LIMITS.pollOptionsMax} options.`,
      ],
    },
    allowMultiple: { type: Boolean, default: false },
    resultsVisibility: { type: String, enum: POLL_RESULTS_VISIBILITY, default: 'AFTER_VOTE' },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    voteCount: { type: Number, default: 0, min: 0 }, // number of doctors who voted (informational)
  },
  { timestamps: true }
);

pollSchema.plugin(moderationPlugin);
pollSchema.index({ moderationStatus: 1, endsAt: -1 });
pollSchema.index({ moderationStatus: 1, submittedAt: 1 });
pollSchema.index({ creator: 1, createdAt: -1 });

module.exports = mongoose.model('Poll', pollSchema);
