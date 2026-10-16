// Website side of chat: the same API and Socket.IO gateway as the Android app.
//
//  • Every change (send, react, delete, read) goes through the REST API with the
//    session cookie and the CSRF token, exactly like the rest of the site.
//  • The socket only RECEIVES live events. The gateway never reads cookies, so
//    each (re)connection first exchanges the session for a one-time ticket
//    (POST /chat/socket-ticket) and presents that in the handshake.
//  • The socket connects straight to the API origin (Next.js rewrites cannot
//    carry WebSockets); see next.config.mjs for the address and the CSP entry.
import { io } from 'socket.io-client';
import { ApiError, api, uploadFile } from './api';
import { API_PREFIX } from './api-config.mjs';

// The reactions a member can add (REACTIONS in backend/src/models/Message.js).
export const REACTIONS = ['👍', '❤️', '😂', '😊', '😮', '😢', '🙏'];

// Same limits the API enforces (MAX_IMAGE_MB, fileSignature.js).
export const CHAT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const SOCKET_ORIGIN = process.env.NEXT_PUBLIC_CHAT_SOCKET_ORIGIN || '';

export const chatApi = {
  conversations: () => api.get('/chat/conversations'),
  conversation: (id) => api.get(`/chat/conversations/${id}`),
  openDirect: (doctorId) => api.post('/chat/direct', { doctorId }),
  messages: (id, { before, limit = 30 } = {}) => api.get(`/chat/conversations/${id}/messages`, { before, limit }),
  send: (id, { body, clientId, mediaId }) => api.post(`/chat/conversations/${id}/messages`, { body, clientId, mediaId }),
  markRead: (id) => api.post(`/chat/conversations/${id}/read`),
  react: (id, messageId, emoji) => api.put(`/chat/conversations/${id}/messages/${messageId}/reaction`, { emoji }),
  remove: (id, messageId) => api.delete(`/chat/conversations/${id}/messages/${messageId}`),
  uploadImage: (id, file, options) => uploadFile(`/chat/conversations/${id}/images`, {}, file, options),
};

// One line for conversation lists.
export function messagePreview(message) {
  if (!message) return '';
  if (message.deleted) return 'This message was deleted';
  const text = String(message.body || '').replace(/\s+/g, ' ').trim();
  if (message.type === 'IMAGE') return text ? `📷 ${text}` : '📷 Photo';
  return text;
}

// The reactions after `userId` sets `emoji` ('' removes theirs): one per person.
export function withReaction(reactions = [], userId, emoji) {
  const next = reactions
    .map((group) => ({ ...group, userIds: group.userIds.filter((id) => id !== userId) }))
    .filter((group) => group.userIds.length);
  if (!emoji) return next;
  const at = next.findIndex((group) => group.emoji === emoji);
  if (at === -1) return [...next, { emoji, userIds: [userId] }];
  return next.map((group, i) => (i === at ? { ...group, userIds: [...group.userIds, userId] } : group));
}

export const myReactionOf = (message, userId) => {
  const group = (message.reactions || []).find((g) => g.userIds.includes(userId));
  return group ? group.emoji : '';
};

const versionKey = (message) => JSON.stringify([message.reactions || [], Boolean(message.deleted)]);

// Merges messages into an oldest → newest list without ever showing one twice:
// a message is matched by its server id or by the clientId this page gave it.
export function mergeMessages(current, incoming) {
  let list = current;
  for (const message of incoming) {
    const at = list.findIndex((m) => m.id === message.id || (message.clientId && m.clientId === message.clientId));
    if (at === -1) list = [...list, message];
    else if (list[at].status || list[at].id !== message.id || versionKey(list[at]) !== versionKey(message)) {
      list = list.map((m, i) => (i === at ? message : m));
    }
  }
  return list === current ? current : [...list].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export function newClientId() {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : '';
  return `web${Date.now().toString(36)}${random || Math.random().toString(36).slice(2)}`.slice(0, 40);
}

// Opens the live connection. Returns null when the site was built without a
// socket address (the page then refreshes over REST instead).
export function createChatSocket() {
  if (!SOCKET_ORIGIN) return null;
  return io(SOCKET_ORIGIN, {
    path: '/socket.io',
    transports: ['websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000,
    timeout: 20000,
    // Called before every connection attempt, so a reconnect gets a fresh ticket.
    auth: (cb) => {
      api
        .post('/chat/socket-ticket', undefined, { silentAuth: true })
        .then(({ data }) => cb({ ticket: data.ticket }))
        .catch(() => cb({}));
    },
  });
}

// Downloads the original photo of a message (streamed by the API only to
// members) and saves it under the filename the API chose.
export async function downloadChatImage(conversationId, message) {
  let response;
  try {
    response = await fetch(`${API_PREFIX}/chat/conversations/${conversationId}/messages/${message.id}/image`, {
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.');
  }
  if (!response.ok) {
    let json = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    const error = json && json.error;
    throw new ApiError(response.status, (error && error.code) || 'ERROR', (error && error.message) || 'The photo could not be downloaded.');
  }
  const disposition = response.headers.get('content-disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match ? match[1] : `mkcgspandan-chat-${message.id}.${(message.image && message.image.format) || 'jpg'}`;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return filename;
}
