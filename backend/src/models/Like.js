const mongoose = require('mongoose');

const { Schema } = mongoose;

const LIKE_TARGETS = ['post', 'blog', 'memory'];

const likeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: LIKE_TARGETS, required: true },
    target: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One like per doctor per content item — enforced by the database.
likeSchema.index({ user: 1, targetType: 1, target: 1 }, { unique: true });
likeSchema.index({ targetType: 1, target: 1 });

module.exports = mongoose.model('Like', likeSchema);
module.exports.LIKE_TARGETS = LIKE_TARGETS;
