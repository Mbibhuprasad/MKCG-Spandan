const mongoose = require('mongoose');

const { Schema } = mongoose;

// One ballot per doctor per poll. Multi-choice polls store several option ids
// on the same ballot, so the unique index still guarantees a single vote.
const voteSchema = new Schema(
  {
    poll: { type: Schema.Types.ObjectId, ref: 'Poll', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    options: { type: [{ type: Schema.Types.ObjectId }], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

voteSchema.index({ poll: 1, user: 1 }, { unique: true });
voteSchema.index({ user: 1 });

module.exports = mongoose.model('Vote', voteSchema);
