import { api } from '@/services/api';

// Memory records. Without `owner`: the community Memories section. With
// `owner`: the Gallery on that doctor's profile — a separate list (items saved
// with showInCommunity: false), never the community memories.
export const memoriesApi = {
  list: (query) => api.get('/memories', query),
  events: () => api.get('/memories/events'),
  get: (id) => api.get(`/memories/${id}`),
  create: (body) => api.post('/memories', body),
  remove: (id) => api.delete(`/memories/${id}`),
};
