const mongoose = require('mongoose');
const moderationPlugin = require('./plugins/moderation');
const { LIMITS } = require('../config/constants');

const { Schema } = mongoose;

const memorySchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    caption: { type: String, default: '', maxlength: 1500 },
    event: { type: Schema.Types.ObjectId, ref: 'Event', default: null },
    memoryDate: { type: Date, default: null },
    // Every memory belongs to its owner's portfolio gallery. This decides whether
    // it is also listed in the community Memories section.
    showInCommunity: { type: Boolean, default: true },
    media: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Media' }],
      validate: [
        (v) => v.length >= 1 && v.length <= LIMITS.memoryMedia,
        `A memory needs between 1 and ${LIMITS.memoryMedia} photos or videos.`,
      ],
    },
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

memorySchema.plugin(moderationPlugin);
memorySchema.index({ moderationStatus: 1, publishedAt: -1 });
memorySchema.index({ moderationStatus: 1, event: 1, publishedAt: -1 });
memorySchema.index({ moderationStatus: 1, submittedAt: 1 });
memorySchema.index({ owner: 1, createdAt: -1 });
memorySchema.index({ owner: 1, moderationStatus: 1, publishedAt: -1 });

module.exports = mongoose.model('Memory', memorySchema);
