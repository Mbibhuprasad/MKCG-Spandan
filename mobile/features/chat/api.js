import { api, uploadFile } from '@/services/api';
import { API_URL } from '@/services/config';

// The reactions a doctor can add to a message (REACTIONS in backend/src/models/Message.js).
export const REACTIONS = ['👍', '❤️', '😂', '😊', '😮', '😢', '🙏'];

// REST side of chat (backend/src/routes/chat.routes.js). Every call is checked
// against the caller's conversation membership on the server; the app never
// decides who may read what.
export const chatApi = {
  conversations: (type) => api.get('/chat/conversations', { type }),
  unreadCount: () => api.get('/chat/unread-count'),
  openDirect: (doctorId) => api.post('/chat/direct', { doctorId }),
  conversation: (id) => api.get(`/chat/conversations/${id}`),
  // Newest page first; `before` is the id of the oldest message already loaded.
  messages: (id, { before, limit = 30 } = {}) => api.get(`/chat/conversations/${id}/messages`, { before, limit }),
  // `clientId` makes a retry safe: the server stores the message once. A photo
  // message sends the `mediaId` from uploadImage, with an optional caption as `body`.
  send: (id, body, clientId, mediaId) => api.post(`/chat/conversations/${id}/messages`, { body, clientId, mediaId }),
  markRead: (id) => api.post(`/chat/conversations/${id}/read`),
  // Sets this doctor's reaction to a message; '' removes it.
  react: (id, messageId, emoji) => api.put(`/chat/conversations/${id}/messages/${messageId}/reaction`, { emoji }),
  // "Delete for everyone" — only the sender's own messages.
  remove: (id, messageId) => api.delete(`/chat/conversations/${id}/messages/${messageId}`),
  // Uploads a picked photo for this conversation; resolves with { id, previewUrl, … }.
  uploadImage: (id, asset, options) => uploadFile(`/chat/conversations/${id}/images`, asset, {}, options),
  // The original photo of an image message (needs the bearer token).
  imageUrl: (id, messageId) => `${API_URL}/chat/conversations/${id}/messages/${messageId}/image`,
};

// One line for conversation lists and alerts.
export function messagePreview(message) {
  if (!message) return '';
  if (message.deleted) return 'This message was deleted';
  const text = String(message.body || '').replace(/\s+/g, ' ').trim();
  if (message.type === 'IMAGE') return text ? `📷 ${text}` : '📷 Photo';
  return text;
}
