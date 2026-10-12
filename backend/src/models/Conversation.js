const mongoose = require('mongoose');

const { Schema } = mongoose;

const CONVERSATION_TYPES = ['GROUP', 'DIRECT'];

// Key of the one group every active member belongs to.
const COMMUNITY_KEY = 'community';

// A chat conversation. Who may read and write it is decided by ConversationMember
// rows — never by anything a client sends.
const conversationSchema = new Schema(
  {
    type: { type: String, enum: CONVERSATION_TYPES, required: true },
    // Natural key that makes "get or create" safe under concurrency:
    //   'community'            the universal members' group
    //   'direct:<idA>:<idB>'   a one-to-one conversation (ids sorted)
    key: { type: String, required: true, unique: true, maxlength: 80 },
    name: { type: String, trim: true, maxlength: 80, default: '' }, // groups only
    description: { type: String, trim: true, maxlength: 300, default: '' }, // groups only
    participants: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] }, // DIRECT only: exactly two
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastMessage: {
      id: { type: Schema.Types.ObjectId, default: null },
      sender: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      senderName: { type: String, default: '' },
      preview: { type: String, default: '', maxlength: 200 },
      at: { type: Date, default: null },
    },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationSchema.index({ type: 1, lastActivityAt: -1 });
conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
module.exports.CONVERSATION_TYPES = CONVERSATION_TYPES;
module.exports.COMMUNITY_KEY = COMMUNITY_KEY;
