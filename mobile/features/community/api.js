import { api } from '@/services/api';

export const postsApi = {
  list: (query) => api.get('/posts', query),
  get: (id) => api.get(`/posts/${id}`),
  create: (body) => api.post('/posts', body),
  remove: (id) => api.delete(`/posts/${id}`),
};

// targetType: post | blog | memory | event
export const commentsApi = {
  list: (targetType, targetId, query) => api.get('/comments', { targetType, targetId, ...query }),
  create: (targetType, targetId, body) => api.post('/comments', { targetType, targetId, body }),
  remove: (id) => api.delete(`/comments/${id}`),
};

// targetType: post | blog | memory. Both calls are idempotent on the server.
export const likesApi = {
  like: (targetType, targetId) => api.put(`/likes/${targetType}/${targetId}`),
  unlike: (targetType, targetId) => api.delete(`/likes/${targetType}/${targetId}`),
};

export const reportsApi = {
  create: (targetType, targetId, reason, details = '') => api.post('/reports', { targetType, targetId, reason, details }),
};

export const pollsApi = {
  list: (query) => api.get('/polls', query),
  vote: (id, optionIds) => api.post(`/polls/${id}/vote`, { optionIds }),
};
