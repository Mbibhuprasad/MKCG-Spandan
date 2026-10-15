const mongoose = require('mongoose');

const { Schema } = mongoose;

const MESSAGE_MAX_LENGTH = 4000;

// The reactions a member can add to a message (long press in the app).
const REACTIONS = Object.freeze(['👍', '❤️', '😂', '😮', '😢', '🙏']);

// A chat message. Plain text only: it is stored as text and rendered as text.
const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: MESSAGE_MAX_LENGTH },
    // Chosen by the sending device. A retry after a dropped connection carries
    // the same value, so the message is stored once.
    clientId: { type: String, maxlength: 64 },
    // At most one reaction per member, in the order they were added.
    reactions: {
      type: [
        {
          _id: false,
          user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          emoji: { type: String, enum: REACTIONS, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// History is read newest-first by _id, which is also the pagination cursor.
messageSchema.index({ conversation: 1, _id: -1 });
messageSchema.index({ sender: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } });

module.exports = mongoose.model('Message', messageSchema);
module.exports.MESSAGE_MAX_LENGTH = MESSAGE_MAX_LENGTH;
module.exports.REACTIONS = REACTIONS;
