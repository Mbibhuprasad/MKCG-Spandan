const { z, objectId, text, limit } = require('./common');
const { CONVERSATION_TYPES } = require('../models/Conversation');
const { MESSAGE_MAX_LENGTH, REACTIONS } = require('../models/Message');

const clientId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'This message identifier is not valid.');

const conversationListQuery = z.object({ type: z.enum(CONVERSATION_TYPES).optional() });

const openDirect = z.object({ doctorId: objectId });

// `before` is the id of the oldest message already loaded (the cursor).
const messageListQuery = z.object({ before: objectId.optional(), limit: limit(30, 50) });

// A text message, or a photo (the id returned by POST /conversations/:id/images)
// with an optional caption.
const sendMessage = z
  .object({
    body: text(0, MESSAGE_MAX_LENGTH, 'Your message').optional().default(''),
    mediaId: objectId.optional(),
    clientId: clientId.optional(),
  })
  .refine((v) => v.body || v.mediaId, { message: 'Your message is required.', path: ['body'] });

// '' removes the caller's reaction.
const react = z.object({ emoji: z.enum(['', ...REACTIONS], 'Choose one of the listed reactions.') });
const messageParams = z.object({ id: objectId, messageId: objectId });

// Socket events carry the conversation in the payload instead of the URL.
const socketSend = sendMessage.and(z.object({ conversationId: objectId }));
const socketRead = z.object({ conversationId: objectId });
const socketReact = react.extend({ conversationId: objectId, messageId: objectId });
const socketDelete = z.object({ conversationId: objectId, messageId: objectId });

module.exports = {
  conversationListQuery,
  openDirect,
  messageListQuery,
  sendMessage,
  react,
  messageParams,
  socketSend,
  socketRead,
  socketReact,
  socketDelete,
};
