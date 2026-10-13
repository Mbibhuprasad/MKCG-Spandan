import { api } from '@/services/api';

export const notificationsApi = {
  list: (query) => api.get('/notifications', query),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};
