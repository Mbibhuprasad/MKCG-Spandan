const mongoose = require('mongoose');

const { Schema } = mongoose;

// Membership of a conversation, and how far the member has read. A row here is
// the only thing that grants access to a conversation's messages.
const conversationMemberSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // The newest message the member has seen; everything after it is unread.
    lastReadMessage: { type: Schema.Types.ObjectId, default: null },
    lastReadAt: { type: Date, default: null },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

conversationMemberSchema.index({ conversation: 1, user: 1 }, { unique: true });
conversationMemberSchema.index({ user: 1 });

module.exports = mongoose.model('ConversationMember', conversationMemberSchema);
