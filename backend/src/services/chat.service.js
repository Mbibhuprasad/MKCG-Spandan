// Chat rules shared by the REST endpoints and the Socket.IO gateway. Every
// function takes the authenticated user and checks membership itself, so no
// caller can read or write a conversation by merely knowing its id.
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const Message = require('../models/Message');
const Media = require('../models/Media');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { getEnv } = require('../config/env');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');
const { AUTHOR_FIELDS, authorSummary, whatsappOf } = require('./serializers');
const { createFromUpload, claimMedia, unclaim, destroyMedia } = require('./media.service');
const cloud = require('./cloudinary.service');
const realtime = require('../realtime/hub');

const { COMMUNITY_KEY } = Conversation;
const COMMUNITY_GROUP = Object.freeze({
  name: 'MKCG Spandan Community',
  description: 'The common room for every member of the community.',
});
const UNREAD_CAP = 99;
const PREVIEW_LENGTH = 140;
const PEER_FIELDS = `${AUTHOR_FIELDS} phone whatsapp visibility profile.city`;
const DELETED_PREVIEW = 'This message was deleted';
const PHOTO_PREVIEW = '📷 Photo';

const notFound = () => ApiError.notFound('That conversation could not be found.');
const messageNotFound = () => ApiError.notFound('That message could not be found.');
const isAdmin = (user) => user.role === ROLES.ADMIN;

/* ───────────── Rate limiting ───────────── */

// One sliding one-minute window per sender, shared by REST and sockets.
const sendLog = new Map();
const WINDOW_MS = 60 * 1000;

function consumeSendQuota(userId) {
  const max = getEnv().rateLimit.chatMax;
  const now = Date.now();
  const key = String(userId);
  const recent = (sendLog.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= max) {
    sendLog.set(key, recent);
    throw new ApiError(429, 'RATE_LIMITED', 'You are sending messages too quickly. Please wait a moment.');
  }
  recent.push(now);
  sendLog.set(key, recent);
  if (sendLog.size > 5000) {
    for (const [k, times] of sendLog) if (!times.some((t) => now - t < WINDOW_MS)) sendLog.delete(k);
  }
}

/* ───────────── Membership ───────────── */

let communityId = null;

// The one group all members share. Created on first use; the unique key makes
// simultaneous first requests end up with the same document.
async function ensureCommunityGroup() {
  if (communityId) {
    const cached = await Conversation.findById(communityId);
    if (cached) return cached;
    communityId = null;
  }
  let group = await Conversation.findOne({ key: COMMUNITY_KEY });
  if (!group) {
    try {
      group = await Conversation.create({ type: 'GROUP', key: COMMUNITY_KEY, ...COMMUNITY_GROUP });
    } catch (err) {
      if (!err || err.code !== 11000) throw err;
      group = await Conversation.findOne({ key: COMMUNITY_KEY });
    }
  }
  communityId = group._id;
  return group;
}

// Every active member belongs to the community group. A new member starts with
// the existing history marked as read.
async function ensureCommunityMembership(user) {
  const group = await ensureCommunityGroup();
  const result = await ConversationMember.updateOne(
    { conversation: group._id, user: user._id },
    { $setOnInsert: { lastReadMessage: group.lastMessage.id || null, lastReadAt: new Date(), joinedAt: new Date() } },
    { upsert: true }
  );
  if (result.upsertedCount) realtime.joinUser(user._id, group._id);
  return group;
}

// Loads a conversation only if the user is a member of it. A missing
// conversation and one the user does not belong to look exactly the same.
async function requireMembership(conversationId, user) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw notFound();
  if (conversation.key === COMMUNITY_KEY) await ensureCommunityMembership(user);
  const member = await ConversationMember.findOne({ conversation: conversation._id, user: user._id });
  if (!member) throw notFound();
  return { conversation, member };
}

async function conversationIdsOf(userId) {
  const rows = await ConversationMember.find({ user: userId }).select('conversation').lean();
  return rows.map((r) => r.conversation);
}

/* ───────────── Serialisation ───────────── */

// Reactions grouped by emoji, in the order each emoji was first added:
// [{ emoji: '👍', userIds: ['…', '…'] }]. Each viewer finds their own by id.
function serializeReactions(reactions = []) {
  const groups = new Map();
  for (const { emoji, user } of reactions) {
    if (!groups.has(emoji)) groups.set(emoji, []);
    groups.get(emoji).push(String(user));
  }
  return [...groups].map(([emoji, userIds]) => ({ emoji, userIds }));
}

// A chat photo as its conversation's members receive it. The URLs are signed
// (authenticated delivery), so only the API can produce them, and only members
// are ever given them. `previewUrl` fits a chat bubble; `url` is the large view.
// The original file is downloaded through GET …/messages/:messageId/image.
function serializeChatImage(media) {
  if (!media || !media.publicId) return null;
  return {
    id: String(media._id),
    width: media.width,
    height: media.height,
    format: media.format,
    bytes: media.bytes,
    url: cloud.displayUrl(media),
    previewUrl: cloud.previewUrl(media),
  };
}

// A deleted message keeps only who sent it and when: its text, photo and
// reactions are gone from the database and from every response.
function serializeMessage(message) {
  const deleted = Boolean(message.deletedAt);
  return {
    id: String(message._id),
    conversationId: String(message.conversation),
    type: message.type || 'TEXT',
    body: deleted ? '' : message.body || '',
    image: deleted ? null : serializeChatImage(message.media),
    deleted,
    deletedAt: message.deletedAt || null,
    sender: authorSummary(message.sender),
    clientId: message.clientId || null,
    reactions: deleted ? [] : serializeReactions(message.reactions),
    createdAt: message.createdAt,
  };
}

// The one-line summary shown in conversation lists.
function previewOf(message) {
  if (message.deletedAt) return DELETED_PREVIEW;
  const text = String(message.body || '').replace(/\s+/g, ' ').trim();
  if (message.type === 'IMAGE') return (text ? `📷 ${text}` : PHOTO_PREVIEW).slice(0, PREVIEW_LENGTH);
  return text.slice(0, PREVIEW_LENGTH);
}

const MESSAGE_POPULATE = [{ path: 'sender', select: AUTHOR_FIELDS }, { path: 'media' }];

// The other participant of a one-to-one conversation, as this viewer may see
// them. The WhatsApp number is included only when the doctor allows it.
function serializePeer(peer, viewer) {
  if (!peer || !peer.name) return { ...authorSummary(null), city: '', available: false, whatsapp: null };
  const visibility = peer.visibility || {};
  const number = whatsappOf(peer);
  const mayContact = visibility.showWhatsapp !== false || isAdmin(viewer);
  return {
    ...authorSummary(peer),
    city: (peer.profile && peer.profile.city) || '',
    available: peer.status === ACCOUNT_STATUS.ACTIVE,
    whatsapp: number && mayContact ? number : null,
  };
}

function serializeConversation(conversation, { viewer, unreadCount = 0, peer = null, memberCount = null }) {
  const direct = conversation.type === 'DIRECT';
  const last = conversation.lastMessage || {};
  const peerOut = direct ? serializePeer(peer, viewer) : null;
  return {
    id: String(conversation._id),
    type: conversation.type,
    isCommunity: conversation.key === COMMUNITY_KEY,
    name: direct ? peerOut.name : conversation.name,
    description: direct ? '' : conversation.description,
    avatarUrl: direct ? peerOut.photoUrl : '',
    peer: peerOut,
    memberCount,
    lastMessage: last.id
      ? {
          id: String(last.id),
          preview: last.preview,
          senderId: last.sender ? String(last.sender) : null,
          senderName: last.senderName || '',
          at: last.at,
        }
      : null,
    lastActivityAt: conversation.lastActivityAt,
    unreadCount,
    canSend: direct ? peerOut.available : true,
  };
}

async function unreadCountFor(conversation, member, userId) {
  if (!conversation.lastMessage.id) return 0;
  if (member.lastReadMessage && String(member.lastReadMessage) === String(conversation.lastMessage.id)) return 0;
  const filter = { conversation: conversation._id, sender: { $ne: userId } };
  if (member.lastReadMessage) filter._id = { $gt: member.lastReadMessage };
  return Message.countDocuments(filter).limit(UNREAD_CAP + 1);
}

const peerIdOf = (conversation, userId) => conversation.participants.find((p) => String(p) !== String(userId)) || null;

async function present(conversations, memberships, viewer) {
  const memberOf = new Map(memberships.map((m) => [String(m.conversation), m]));
  const peerIds = conversations.filter((c) => c.type === 'DIRECT').map((c) => peerIdOf(c, viewer._id)).filter(Boolean);
  const peers = peerIds.length ? await User.find({ _id: { $in: peerIds } }).select(PEER_FIELDS) : [];
  const peerOf = new Map(peers.map((p) => [String(p._id), p]));

  return Promise.all(
    conversations.map(async (conversation) => {
      const member = memberOf.get(String(conversation._id));
      const [unreadCount, memberCount] = await Promise.all([
        unreadCountFor(conversation, member, viewer._id),
        conversation.type === 'GROUP' ? ConversationMember.countDocuments({ conversation: conversation._id }) : null,
      ]);
      const peer = conversation.type === 'DIRECT' ? peerOf.get(String(peerIdOf(conversation, viewer._id))) : null;
      return serializeConversation(conversation, { viewer, unreadCount, peer, memberCount });
    })
  );
}

/* ───────────── Queries ───────────── */

async function listConversations(user, { type } = {}) {
  await ensureCommunityMembership(user);
  const memberships = await ConversationMember.find({ user: user._id });
  const filter = { _id: { $in: memberships.map((m) => m.conversation) } };
  if (type) filter.type = type;
  const conversations = await Conversation.find(filter).sort({ lastActivityAt: -1, _id: -1 }).limit(200);
  return present(conversations, memberships, user);
}

async function getConversation(conversationId, user) {
  const { conversation, member } = await requireMembership(conversationId, user);
  const [out] = await present([conversation], [member], user);
  return out;
}

async function unreadTotal(user) {
  const conversations = await listConversations(user);
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

// Newest page first; `before` continues from the oldest message already shown.
// Messages are returned oldest → newest within the page.
async function listMessages(conversationId, user, { before, limit }) {
  const { conversation } = await requireMembership(conversationId, user);
  const filter = { conversation: conversation._id };
  if (before) filter._id = { $lt: before };
  const rows = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate(MESSAGE_POPULATE);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  return { messages: page.map(serializeMessage), hasMore, nextBefore: hasMore && page.length ? String(page[0]._id) : null };
}

/* ───────────── Commands ───────────── */

const directKey = (a, b) => `direct:${[String(a), String(b)].sort().join(':')}`;

// One-to-one chat needs a WhatsApp number on the caller's own profile first.
function assertDirectEligible(user) {
  if (isAdmin(user) || whatsappOf(user)) return;
  throw ApiError.forbidden(
    'Add your WhatsApp number to your profile to start one-to-one chats.',
    'WHATSAPP_REQUIRED'
  );
}

// Returns the single conversation between the caller and another doctor,
// creating it on first use. Opening it again — from either side — finds the same one.
async function openDirect(user, doctorId) {
  if (String(doctorId) === String(user._id)) throw ApiError.badRequest('You cannot start a chat with yourself.');
  assertDirectEligible(user);

  const key = directKey(user._id, doctorId);
  let conversation = await Conversation.findOne({ key });
  let created = false;

  if (!conversation) {
    const peer = await User.findById(doctorId).select('role status visibility');
    const listed = peer && peer.role === ROLES.DOCTOR && peer.status === ACCOUNT_STATUS.ACTIVE;
    const reachable = listed && (peer.visibility.directory !== false || isAdmin(user));
    if (!reachable) throw ApiError.notFound('That doctor could not be found.');

    try {
      conversation = await Conversation.create({ type: 'DIRECT', key, participants: [user._id, peer._id], createdBy: user._id });
      created = true;
    } catch (err) {
      if (!err || err.code !== 11000) throw err;
      conversation = await Conversation.findOne({ key }); // the other side opened it at the same moment
    }
  }

  // Idempotent, so a half-finished earlier attempt is completed here.
  for (const participant of conversation.participants) {
    await ConversationMember.updateOne(
      { conversation: conversation._id, user: participant },
      { $setOnInsert: { joinedAt: new Date() } },
      { upsert: true }
    );
    realtime.joinUser(participant, conversation._id);
  }

  return { conversation: await getConversation(conversation._id, user), created };
}

async function markRead(conversationId, user) {
  const { conversation, member } = await requireMembership(conversationId, user);
  const latest = conversation.lastMessage.id || null;
  if (String(member.lastReadMessage || '') !== String(latest || '')) {
    member.lastReadMessage = latest;
  }
  member.lastReadAt = new Date();
  await member.save();
  return { conversationId: String(conversation._id), unreadCount: 0 };
}

// Sending, reacting and uploading follow the same rules: one-to-one chat needs
// the caller's WhatsApp number, and the other member must still be available.
async function assertCanSend(conversation, user) {
  if (conversation.type !== 'DIRECT') return;
  assertDirectEligible(user);
  const peer = await User.findById(peerIdOf(conversation, user._id)).select('status');
  if (!peer || peer.status !== ACCOUNT_STATUS.ACTIVE) {
    throw ApiError.conflict('This member is no longer available.', undefined, 'PEER_UNAVAILABLE');
  }
}

// Stores a photo for a conversation the caller belongs to and may write in.
// The returned id is then sent as `mediaId`; until it is, the upload belongs to
// no message and the periodic cleanup removes it after a day.
async function uploadImage(conversationId, user, file) {
  const { conversation } = await requireMembership(conversationId, user);
  await assertCanSend(conversation, user);
  const media = await createFromUpload({ file, purpose: 'chat', user });
  return serializeChatImage(media);
}

async function sendMessage(user, { conversationId, body = '', mediaId, clientId }) {
  const { conversation, member } = await requireMembership(conversationId, user);
  await assertCanSend(conversation, user);

  // A retry of a message that was already stored returns the stored message.
  if (clientId) {
    const existing = await Message.findOne({ sender: user._id, clientId }).populate(MESSAGE_POPULATE);
    if (existing) {
      if (String(existing.conversation) !== String(conversation._id)) throw ApiError.conflict('That message was already sent.');
      return { message: serializeMessage(existing), duplicate: true };
    }
  }

  consumeSendQuota(user._id);

  // A photo must be the caller's own, unused chat upload; it is claimed for
  // this message before the message exists, and released again if saving fails.
  const messageId = new mongoose.Types.ObjectId();
  let media = null;
  if (mediaId) {
    try {
      await claimMedia({ ids: [mediaId], ownerId: user._id, purpose: 'chat', kind: 'Message', itemId: messageId });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MEDIA_INVALID') {
        throw ApiError.badRequest('That photo is no longer available. Please choose it again.', { mediaId: 'Invalid or unavailable upload.' }, 'MEDIA_INVALID');
      }
      throw err;
    }
    media = await Media.findById(mediaId);
  }

  let message;
  try {
    message = await Message.create({
      _id: messageId,
      conversation: conversation._id,
      sender: user._id,
      type: media ? 'IMAGE' : 'TEXT',
      body,
      media: media ? media._id : null,
      clientId,
    });
  } catch (err) {
    if (media) await unclaim([media._id]);
    if (!clientId || !err || err.code !== 11000) throw err;
    const existing = await Message.findOne({ sender: user._id, clientId }).populate(MESSAGE_POPULATE);
    return { message: serializeMessage(existing), duplicate: true };
  }

  const preview = previewOf(message);
  // Only ever move the summary forward, so two messages saved at the same
  // moment cannot leave an older one as "latest".
  await Conversation.updateOne(
    { _id: conversation._id, $or: [{ 'lastMessage.id': null }, { 'lastMessage.id': { $lt: message._id } }] },
    {
      $set: {
        lastMessage: { id: message._id, sender: user._id, senderName: user.name, preview, at: message.createdAt },
        lastActivityAt: message.createdAt,
      },
    }
  );
  // The sender has, by definition, read their own message.
  if (!member.lastReadMessage || String(member.lastReadMessage) < String(message._id)) {
    await ConversationMember.updateOne(
      { _id: member._id },
      { $set: { lastReadMessage: message._id, lastReadAt: message.createdAt } }
    );
  }

  message.sender = user;
  message.media = media;
  const out = serializeMessage(message);
  realtime.emitToConversation(conversation._id, 'message:new', { conversationId: String(conversation._id), message: out });
  return { message: out, duplicate: false };
}

// Sets the caller's reaction to a message ('' removes it). A member has at most
// one reaction per message, so a new emoji replaces the previous one. Reacting
// follows the same rules as sending: members only, and not to a member who is
// no longer available. It does not change the conversation's latest message or
// anyone's unread count.
async function reactToMessage(user, { conversationId, messageId, emoji }) {
  const { conversation } = await requireMembership(conversationId, user);
  await assertCanSend(conversation, user);

  consumeSendQuota(user._id);

  // One atomic update: drop this member's reaction, then add the new one.
  // A deleted message takes no reactions.
  const message = await Message.findOneAndUpdate(
    { _id: messageId, conversation: conversation._id, deletedAt: null },
    [
      {
        $set: {
          reactions: {
            $concatArrays: [
              { $filter: { input: { $ifNull: ['$reactions', []] }, cond: { $ne: ['$$this.user', user._id] } } },
              emoji ? [{ user: user._id, emoji }] : [],
            ],
          },
        },
      },
    ],
    { returnDocument: 'after', updatePipeline: true }
  ).select('reactions');
  if (!message) {
    const deleted = await Message.exists({ _id: messageId, conversation: conversation._id, deletedAt: { $ne: null } });
    if (deleted) throw ApiError.conflict('This message was deleted.', undefined, 'MESSAGE_DELETED');
    throw messageNotFound();
  }

  const out = { conversationId: String(conversation._id), messageId: String(message._id), reactions: serializeReactions(message.reactions) };
  realtime.emitToConversation(conversation._id, 'message:reaction', out);
  return out;
}

// "Delete for everyone". Only the sender may delete a message (there is no
// moderator role in chat). The text, photo and reactions are removed from the
// database — the photo from Cloudinary too — and every member is told at once;
// members who are offline get the deleted state with the next history load.
// Deleting a message that is already deleted simply returns it again.
async function deleteMessage(user, { conversationId, messageId }) {
  const { conversation } = await requireMembership(conversationId, user);
  const current = await Message.findOne({ _id: messageId, conversation: conversation._id }).select('sender deletedAt media');
  if (!current) throw messageNotFound();
  if (String(current.sender) !== String(user._id)) {
    throw ApiError.forbidden('You can only delete messages you sent.', 'NOT_MESSAGE_SENDER');
  }

  if (!current.deletedAt) {
    consumeSendQuota(user._id);
    const now = new Date();
    const changed = await Message.updateOne(
      { _id: current._id, deletedAt: null },
      { $set: { deletedAt: now, deletedBy: user._id, body: '', media: null, reactions: [] } }
    );
    if (changed.modifiedCount) {
      if (current.media) await destroyMedia([current.media]);
      await Conversation.updateOne(
        { _id: conversation._id, 'lastMessage.id': current._id },
        { $set: { 'lastMessage.preview': DELETED_PREVIEW } }
      );
      const deleted = await Message.findById(current._id).populate(MESSAGE_POPULATE);
      const out = serializeMessage(deleted);
      realtime.emitToConversation(conversation._id, 'message:deleted', {
        conversationId: String(conversation._id),
        messageId: out.id,
        message: out,
      });
      return { conversationId: String(conversation._id), messageId: out.id, message: out };
    }
  }

  const deleted = await Message.findById(current._id).populate(MESSAGE_POPULATE);
  return { conversationId: String(conversation._id), messageId: String(current._id), message: serializeMessage(deleted) };
}

// The original file of a photo message, for a member of its conversation.
// Resolves with { response, filename, contentType }; the controller streams it.
async function openMessageImage(user, { conversationId, messageId }) {
  const { conversation } = await requireMembership(conversationId, user);
  const message = await Message.findOne({ _id: messageId, conversation: conversation._id }).populate('media');
  if (!message) throw messageNotFound();
  if (message.deletedAt) throw ApiError.conflict('This message was deleted.', undefined, 'MESSAGE_DELETED');
  if (!message.media || !message.media.publicId) throw ApiError.notFound('This message has no photo.');

  const media = message.media;
  const stamp = new Date(message.createdAt).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const format = media.format || 'jpg';
  const response = await cloud.fetchOriginal(media);
  return {
    response,
    filename: `mkcgspandan-chat-${stamp}.${format}`,
    contentType: { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[format] || 'application/octet-stream',
    bytes: media.bytes || null,
  };
}

/* ───────────── Account deletion ───────────── */

async function refreshLastMessage(conversationId) {
  const latest = await Message.findOne({ conversation: conversationId }).sort({ _id: -1 }).populate({ path: 'sender', select: 'name' });
  const lastMessage = latest
    ? {
        id: latest._id,
        sender: latest.sender ? latest.sender._id : null,
        senderName: latest.sender ? latest.sender.name : '',
        preview: previewOf(latest),
        at: latest.createdAt,
      }
    : { id: null, sender: null, senderName: '', preview: '', at: null };
  await Conversation.updateOne({ _id: conversationId }, { $set: { lastMessage } });
}

// Removes everything a deleted account leaves in chat: its one-to-one
// conversations (with their messages), its group messages and its memberships.
async function removeUserChatData(userId) {
  const id = new mongoose.Types.ObjectId(String(userId));
  const directs = await Conversation.find({ type: 'DIRECT', participants: id }).select('_id').lean();
  const directIds = directs.map((c) => c._id);
  if (directIds.length) {
    // The other member's photos in those conversations go with them (the
    // account's own uploads are removed by the caller).
    const photos = await Message.distinct('media', { conversation: { $in: directIds }, media: { $ne: null } });
    await destroyMedia(photos);
    await Message.deleteMany({ conversation: { $in: directIds } });
    await ConversationMember.deleteMany({ conversation: { $in: directIds } });
    await Conversation.deleteMany({ _id: { $in: directIds } });
  }

  const touched = await Message.distinct('conversation', { sender: id });
  await Message.deleteMany({ sender: id });
  await Message.updateMany({ 'reactions.user': id }, { $pull: { reactions: { user: id } } });
  for (const conversationId of touched) await refreshLastMessage(conversationId);

  await ConversationMember.deleteMany({ user: id });
}

module.exports = {
  COMMUNITY_GROUP,
  ensureCommunityGroup,
  ensureCommunityMembership,
  conversationIdsOf,
  listConversations,
  getConversation,
  unreadTotal,
  listMessages,
  openDirect,
  markRead,
  uploadImage,
  sendMessage,
  reactToMessage,
  deleteMessage,
  openMessageImage,
  removeUserChatData,
};
