import { api, uploadMedia } from '@/services/api';

// Batch posters (backend/src/routes/poster.routes.js) — the same endpoints and
// records as the website. Every call is scoped to the signed-in doctor by the
// API; another doctor's poster simply answers 404.
export const postersApi = {
  list: () => api.get('/posters'),
  get: (id) => api.get(`/posters/${id}`),
  create: (body) => api.post('/posters', body),
  update: (id, body) => api.patch(`/posters/${id}`, body),
  remove: (id) => api.delete(`/posters/${id}`),
  // Authorises a download of a finished poster and returns the saved poster to draw.
  authorizeExport: (id, format) => api.post(`/posters/${id}/export`, { format }),
  // Poster photos are private `purpose: 'poster'` uploads, attached by id when the poster is saved.
  uploadPhoto: (asset, options) => uploadMedia(asset, 'poster', options),
  // Discards an upload that was replaced before the poster was saved with it.
  discardUpload: (mediaId) => api.delete(`/media/${mediaId}`),
};
