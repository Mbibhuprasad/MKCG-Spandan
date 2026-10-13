import { api } from '@/services/api';

export const eventsApi = {
  list: (query) => api.get('/events', query),
  get: (id) => api.get(`/events/${id}`),
  create: (body) => api.post('/events', body),
  remove: (id) => api.delete(`/events/${id}`),
  rsvp: (id, status, guests = 0) => api.put(`/events/${id}/rsvp`, { status, guests }),
  cancelRsvp: (id) => api.delete(`/events/${id}/rsvp`),
  attendees: (id, query) => api.get(`/events/${id}/attendees`, query),
};
