import { api } from '@/services/api';

export const eventsApi = {
  list: (query) => api.get('/events', query),
  get: (id) => api.get(`/events/${id}`),
  create: (body) => api.post('/events', body),
  remove: (id) => api.delete(`/events/${id}`),
  rsvp: (id, status, guests = 0) => api.put(`/events/${id}/rsvp`, { status, guests }),
  cancelRsvp: (id) => api.delete(`/events/${id}/rsvp`),
  attendees: (id, query) => api.get(`/events/${id}/attendees`, query),
  // Travel schedules: everyone attending, and the signed-in doctor's own plan.
  schedule: (id, query) => api.get(`/events/${id}/schedule`, query),
  saveTravel: (id, body) => api.put(`/events/${id}/schedule`, body),
  removeTravel: (id) => api.delete(`/events/${id}/schedule`),
};
