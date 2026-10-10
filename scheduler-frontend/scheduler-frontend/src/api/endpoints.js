import client from "./client";

// --- Auth -------------------------------------------------------------
export const login = (credentials) => client.post("/login", credentials);
export const forgotPassword = (email) => client.post("/forgot-password", { email });
export const logout = () => client.post("/logout");
export const fetchCurrentUser = () => client.get("/user");
export const updateUser = (payload) => client.put("/user", payload);
export const changeEmail = (payload) => client.put("/user/email", payload);
export const verifyEmailChange = (token) => client.post("/verify-email-change", { token });
export const updatePassword = (payload) => client.put("/user/password", payload);

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
