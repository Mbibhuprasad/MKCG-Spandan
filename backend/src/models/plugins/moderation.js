const mongoose = require('mongoose');
const { MODERATION } = require('../../config/constants');

// Adds the shared publication fields to every community content model.
//
// There is no review step any more: content is published (APPROVED) as soon as
// it is saved. PENDING and REJECTED are kept only so that records written under
// the former approval workflow still load and stay hidden until they are
// normalised (see scripts/publishPending.js) or deleted. The status is
// deliberately separate from account status.
function moderationPlugin(schema) {
  schema.add({
    moderationStatus: {
      type: String,
      enum: Object.values(MODERATION),
      default: MODERATION.APPROVED,
      required: true,
      index: true,
    },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: '' },
    publishedAt: { type: Date, default: Date.now },
  });
}

module.exports = moderationPlugin;
