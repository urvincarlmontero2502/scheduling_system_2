import client from "./client";
import { readCache, writeCache, CACHE_KEYS } from "../utils/cache";
import { invalidateCache } from "../utils/cache";

// Cache TTL: 2 minutes for most data
const CACHE_TTL = 1000 * 60 * 2;

// --- Auth -------------------------------------------------------------
export const login = (credentials) => client.post("/login", credentials);
export const getGoogleRedirect = () => client.get("/auth/google");
export const googleCallback = (code) => client.post("/auth/google/callback", { code });
export const completeGoogleRegistration = (tempToken, barangay) =>
  client.post("/auth/google/complete-registration", { temporary_token: tempToken, barangay });
export const forgotPassword = (email) => client.post("/forgot-password", { email });
export const logout = () => client.post("/logout");
export const fetchCurrentUser = () => client.get("/user");
export const updateUser = (payload) => client.put("/user", payload);
export const updateProfileImage = (formData) =>
  client.post("/user/profile-image", formData);
export const changeEmail = (payload) => client.put("/user/email", payload);
export const verifyEmailChange = (token) => client.post("/verify-email-change", { token });
export const updatePassword = (payload) => client.put("/user/password", payload);

// --- Assets / Media ---------------------------------------------------
export const uploadAsset = (file, assetType) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("asset_type", assetType);
  return client.post("/uploads", formData);
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
export const fetchBookings = (params) => {
  if (!params) {
    const cached = readCache(CACHE_KEYS.BOOKINGS, CACHE_TTL);
    if (cached) {
      if (cached.length === 0) {
        invalidateCache(CACHE_KEYS.BOOKINGS);
      } else {
        return Promise.resolve({ data: cached });
      }
    }
  }
  return client.get("/bookings", { params }).then((res) => {
    if (!params) {
      const d = res?.data;
      const data = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
      if (data.length > 0) {
        writeCache(CACHE_KEYS.BOOKINGS, data);
      }
      return { data };
    }
    return res;
  });
};
export const createBooking = (payload) => {
  invalidateCache(CACHE_KEYS.BOOKINGS);
  return client.post("/bookings", payload);
};
export const checkAvailability = (params) => client.get("/bookings/availability", { params });
export const updateBookingStatus = (id, status, extra = {}) =>
  client.patch(`/bookings/${id}/status`, { status, ...extra });

// Invalidate booking cache after mutation
export const invalidateBookingsCache = () => invalidateCache(CACHE_KEYS.BOOKINGS);

// Delete a booking
export const deleteBooking = (id) => client.delete(`/bookings/${id}`);

// --- Resources (facilities & vehicles) ---------------------------------
const extractArray = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};

export const fetchResources = (type) => {
  const cacheKey = type ? `${CACHE_KEYS.RESOURCES}_${type}` : CACHE_KEYS.RESOURCES;
  const cached = readCache(cacheKey, CACHE_TTL);
  if (cached) {
    // Don't serve empty arrays from cache — force a fresh fetch
    if (cached.length === 0) {
      invalidateCache(cacheKey);
    } else {
      return Promise.resolve({ data: cached });
    }
  }
  return client.get("/resources", { params: { type } }).then((res) => {
    const data = extractArray(res);
    // Only cache non-empty results to avoid stale empty-array lock-in
    if (data.length > 0) {
      writeCache(cacheKey, data);
    }
    return { data };
  });
};

export const createResource = (payload) => {
  invalidateCache(CACHE_KEYS.RESOURCES);
  return client.post("/resources", payload);
};

export const updateResource = (id, payload) => {
  invalidateCache(CACHE_KEYS.RESOURCES);
  return client.put(`/resources/${id}`, payload);
};

export const deleteResource = (id) => {
  invalidateCache(CACHE_KEYS.RESOURCES);
  return client.delete(`/resources/${id}`);
};

// Maintenance status toggle
export const setResourceMaintenance = (id) => {
  invalidateCache(CACHE_KEYS.RESOURCES);
  return client.patch(`/resources/${id}/maintenance/on`);
};

export const setResourceAvailable = (id) => {
  invalidateCache(CACHE_KEYS.RESOURCES);
  return client.patch(`/resources/${id}/maintenance/off`);
};

export const checkHealth = () => client.get("/health");
export const getBarangays = () => client.get("/barangays");
export const deleteAccount = () => client.put("/user", { delete_account: true });
