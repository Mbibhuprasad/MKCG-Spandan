import { api } from '@/services/api';

// The reactions a doctor can add to a message (REACTIONS in backend/src/models/Message.js).
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

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
  // `clientId` makes a retry safe: the server stores the message once.
  send: (id, body, clientId) => api.post(`/chat/conversations/${id}/messages`, { body, clientId }),
  markRead: (id) => api.post(`/chat/conversations/${id}/read`),
  // Sets this doctor's reaction to a message; '' removes it.
  react: (id, messageId, emoji) => api.put(`/chat/conversations/${id}/messages/${messageId}/reaction`, { emoji }),
};
