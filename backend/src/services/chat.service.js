// Chat rules shared by the REST endpoints and the Socket.IO gateway. Every
// function takes the authenticated user and checks membership itself, so no
// caller can read or write a conversation by merely knowing its id.
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const Message = require('../models/Message');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { getEnv } = require('../config/env');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');
const { AUTHOR_FIELDS, authorSummary, whatsappOf } = require('./serializers');
const realtime = require('../realtime/hub');

const { COMMUNITY_KEY } = Conversation;
const COMMUNITY_GROUP = Object.freeze({
  name: 'MKCG Spandan Community',
  description: 'The common room for every member of the community.',
});
const UNREAD_CAP = 99;
const PREVIEW_LENGTH = 140;
const PEER_FIELDS = `${AUTHOR_FIELDS} phone whatsapp visibility profile.city`;

const notFound = () => ApiError.notFound('That conversation could not be found.');
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

function serializeMessage(message) {
  return {
    id: String(message._id),
    conversationId: String(message.conversation),
    body: message.body,
    sender: authorSummary(message.sender),
    clientId: message.clientId || null,
    reactions: serializeReactions(message.reactions),
    createdAt: message.createdAt,
  };
}

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
    .populate({ path: 'sender', select: AUTHOR_FIELDS });
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

async function sendMessage(user, { conversationId, body, clientId }) {
  const { conversation, member } = await requireMembership(conversationId, user);

  if (conversation.type === 'DIRECT') {
    assertDirectEligible(user);
    const peer = await User.findById(peerIdOf(conversation, user._id)).select('status');
    if (!peer || peer.status !== ACCOUNT_STATUS.ACTIVE) {
      throw ApiError.conflict('This member is no longer available.', undefined, 'PEER_UNAVAILABLE');
    }
  }

  // A retry of a message that was already stored returns the stored message.
  if (clientId) {
    const existing = await Message.findOne({ sender: user._id, clientId }).populate({ path: 'sender', select: AUTHOR_FIELDS });
    if (existing) {
      if (String(existing.conversation) !== String(conversation._id)) throw ApiError.conflict('That message was already sent.');
      return { message: serializeMessage(existing), duplicate: true };
    }
  }

  consumeSendQuota(user._id);

  let message;
  try {
    message = await Message.create({ conversation: conversation._id, sender: user._id, body, clientId });
  } catch (err) {
    if (!clientId || !err || err.code !== 11000) throw err;
    const existing = await Message.findOne({ sender: user._id, clientId }).populate({ path: 'sender', select: AUTHOR_FIELDS });
    return { message: serializeMessage(existing), duplicate: true };
  }

  const preview = body.replace(/\s+/g, ' ').slice(0, PREVIEW_LENGTH);
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

  if (conversation.type === 'DIRECT') {
    assertDirectEligible(user);
    const peer = await User.findById(peerIdOf(conversation, user._id)).select('status');
    if (!peer || peer.status !== ACCOUNT_STATUS.ACTIVE) {
      throw ApiError.conflict('This member is no longer available.', undefined, 'PEER_UNAVAILABLE');
    }
  }

  consumeSendQuota(user._id);

  // One atomic update: drop this member's reaction, then add the new one.
  const message = await Message.findOneAndUpdate(
    { _id: messageId, conversation: conversation._id },
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
  if (!message) throw ApiError.notFound('That message could not be found.');

  const out = { conversationId: String(conversation._id), messageId: String(message._id), reactions: serializeReactions(message.reactions) };
  realtime.emitToConversation(conversation._id, 'message:reaction', out);
  return out;
}

/* ───────────── Account deletion ───────────── */

async function refreshLastMessage(conversationId) {
  const latest = await Message.findOne({ conversation: conversationId }).sort({ _id: -1 }).populate({ path: 'sender', select: 'name' });
  const lastMessage = latest
    ? {
        id: latest._id,
        sender: latest.sender ? latest.sender._id : null,
        senderName: latest.sender ? latest.sender.name : '',
        preview: latest.body.replace(/\s+/g, ' ').slice(0, PREVIEW_LENGTH),
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
  sendMessage,
  reactToMessage,
  removeUserChatData,
};
