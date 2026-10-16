const mongoose = require('mongoose');

const { Schema } = mongoose;

const MESSAGE_MAX_LENGTH = 4000;

// TEXT: a plain-text message. IMAGE: a photo, optionally with a caption in `body`.
const MESSAGE_TYPES = Object.freeze(['TEXT', 'IMAGE']);

// The reactions a member can add to a message (long press in the app, the
// message menu on the website).
const REACTIONS = Object.freeze(['👍', '❤️', '😂', '😊', '😮', '😢', '🙏']);

// A chat message. Text is stored as text and rendered as text; a photo is a
// reference to a Media record (never a URL sent by a client).
const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: MESSAGE_TYPES, default: 'TEXT' },
    // Required for a TEXT message; the optional caption of an IMAGE. Emptied when deleted.
    body: {
      type: String,
      maxlength: MESSAGE_MAX_LENGTH,
      default: '',
      validate: {
        validator(value) {
          return Boolean(this.deletedAt) || this.type !== 'TEXT' || Boolean(value);
        },
        message: 'A text message needs some text.',
      },
    },
    media: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
    // "Delete for everyone": the content (text, photo, reactions) is removed
    // and only this marker remains, so every member sees "This message was deleted".
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
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
module.exports.MESSAGE_TYPES = MESSAGE_TYPES;
module.exports.REACTIONS = REACTIONS;
