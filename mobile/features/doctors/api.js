import { api } from "@/services/api";

// Member directory and portfolios (GET /doctors…). The API applies each
// doctor's visibility choices, so the app only ever receives what it may show.
export const doctorsApi = {
  list: (query) => api.get("/doctors", query),
  filters: () => api.get("/doctors/filters"),
  specialties: (q) => api.get("/doctors/specialties", { q }),
  get: (id) => api.get(`/doctors/${id}`),
};
