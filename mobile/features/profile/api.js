import { api } from "@/services/api";

// The signed-in doctor's own account. PATCH /doctors/me accepts any subset of
// name, whatsapp, profile, visibility, wizardStep and submit.
export const profileApi = {
  me: () => api.get("/doctors/me"),
  update: (body) => api.patch("/doctors/me", body),
  setPhoto: (mediaId) => api.put("/doctors/me/photo", { mediaId }),
  removePhoto: () => api.delete("/doctors/me/photo"),
  changePassword: (currentPassword, newPassword) =>
    api.patch("/auth/password", { currentPassword, newPassword }),
  dashboard: () => api.get("/dashboard/summary"),
};
