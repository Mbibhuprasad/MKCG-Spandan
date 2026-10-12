const mongoose = require('mongoose');
const moderationPlugin = require('./plugins/moderation');

const { Schema } = mongoose;

const COMMENT_TARGETS = ['post', 'blog', 'memory', 'event'];

const commentSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: COMMENT_TARGETS, required: true },
    target: { type: Schema.Types.ObjectId, required: true },
    body: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true }
);

commentSchema.plugin(moderationPlugin);
commentSchema.index({ targetType: 1, target: 1, moderationStatus: 1, createdAt: -1 });
commentSchema.index({ moderationStatus: 1, submittedAt: 1 });
commentSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
module.exports.COMMENT_TARGETS = COMMENT_TARGETS;
