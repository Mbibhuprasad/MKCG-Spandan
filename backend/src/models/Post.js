const mongoose = require('mongoose');
const moderationPlugin = require('./plugins/moderation');
const { POST_TYPES, LIMITS } = require('../config/constants');

const { Schema } = mongoose;

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: POST_TYPES, default: 'GENERAL' },
    body: { type: String, required: true, maxlength: 5000 },
    media: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Media' }],
      default: [],
      validate: [(v) => v.length <= LIMITS.postMedia, `A post can include at most ${LIMITS.postMedia} images.`],
    },
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

postSchema.plugin(moderationPlugin);
postSchema.index({ moderationStatus: 1, publishedAt: -1 });
postSchema.index({ moderationStatus: 1, submittedAt: 1 });
postSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
