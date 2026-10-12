const mongoose = require('mongoose');
const { MODERATION } = require('../../config/constants');

// Adds the shared moderation fields to every moderated content model.
// Content moderation status is deliberately separate from account status.
function moderationPlugin(schema) {
  schema.add({
    moderationStatus: {
      type: String,
      enum: Object.values(MODERATION),
      default: MODERATION.PENDING,
      required: true,
      index: true,
    },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: '' },
    publishedAt: { type: Date, default: null },
  });
}

module.exports = moderationPlugin;
