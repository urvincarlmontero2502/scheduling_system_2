import client from "./client";

// --- Auth -------------------------------------------------------------
export const login = (credentials) => client.post("/login", credentials);
export const getGoogleRedirect = () => client.get("/auth/google");
export const googleCallback = (code) => client.post("/auth/google/callback", { code });
export const forgotPassword = (email) => client.post("/forgot-password", { email });
export const logout = () => client.post("/logout");
export const fetchCurrentUser = () => client.get("/user");
export const updateUser = (payload) => client.put("/user", payload);
export const updateProfileImage = (formData) => client.post("/user/profile-image", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});
export const changeEmail = (payload) => client.put("/user/email", payload);
export const verifyEmailChange = (token) => client.post("/verify-email-change", { token });
export const updatePassword = (payload) => client.put("/user/password", payload);

// --- Assets / Media ---------------------------------------------------
export const uploadAsset = (file, assetType) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("asset_type", assetType);
  return client.post("/uploads", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const deleteAsset = (path, assetType) =>
  client.delete("/uploads", { data: { path, assetType: assetType } });

export const getAssetUrl = (path) => {
  if (!path) return null;
  // If already a full URL, return as-is
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  // Resolve relative path against backend storage
  const baseUrl = import.meta.env.VITE_API_URL || "http://scheduler-backend.test";
  return `${baseUrl}/storage/uploads/${path}`;
};

// FALLBACK: Generate avatar URL from initials using ui-avatars.com
export const getAvatarFallback = (name, email, size = 64) => {
  const initials = (name || email || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
  const colors = ["blue", "green", "purple", "red", "orange"];
  // Simple hash for deterministic color selection
  let hash = 0;
  for (let i = 0; i < (initials + email).length; i++) {
    hash = (hash * 31 + (initials + email).charCodeAt(i)) | 0;
  }
  const color = colors[Math.abs(hash) % colors.length];
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color}&size=${size}&font-bold=true`;
};

// Helper: try to load an image URL, fall back to generated avatar on error
export const resolveImageUrl = (imagePath, fullName, email, size = 64) => {
  if (!imagePath) {
    return getAvatarFallback(fullName, email, size);
  }
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  return getAssetUrl(imagePath) || getAvatarFallback(fullName, email, size);
};

// --- Bookings -----------------------------------------------------------
export const fetchBookings = (params) => client.get("/bookings", { params });
export const createBooking = (payload) => client.post("/bookings", payload);
export const updateBookingStatus = (id, status) =>
  client.patch(`/bookings/${id}/status`, { status });

// ⚡ ADD THIS MISSING FUNCTION:
export const deleteBooking = (id) => client.delete(`/bookings/${id}`);

// --- Resources (facilities & vehicles) ---------------------------------
export const fetchResources = (type) =>
  client.get("/resources", { params: { type } });

export const createResource = (payload) => client.post("/resources", payload);

export const updateResource = (id, payload) =>
  client.put(`/resources/${id}`, payload);

export const deleteResource = (id) => client.delete(`/resources/${id}`);

// Maintenance status toggle
export const setResourceMaintenance = (id) =>
  client.patch(`/resources/${id}/maintenance/on`);

export const setResourceAvailable = (id) =>
  client.patch(`/resources/${id}/maintenance/off`);

export const checkHealth = () => client.get("/health");
export const getBarangays = () => client.get("/barangays");
export const deleteAccount = () => client.put("/user", { delete_account: true });
