import { api } from '@/services/api';

// The shared blog records: the same ones the website lists and a doctor's
// portfolio shows (`author` narrows the list to one doctor).
export const blogsApi = {
  list: (query) => api.get('/blogs', query),
  taxonomy: () => api.get('/blogs/taxonomy'),
  bySlug: (slug) => api.get(`/blogs/slug/${slug}`),
  mine: (query) => api.get('/blogs/mine', query),
  create: (body) => api.post('/blogs', body),
  remove: (id) => api.delete(`/blogs/${id}`),
};
