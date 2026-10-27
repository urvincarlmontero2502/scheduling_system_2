import axios from "axios";

// Base URL: uses VITE_API_URL if set, otherwise defaults directly to your Laravel Herd backend.
const baseURL =
  import.meta.env.VITE_API_URL || "http://scheduler-backend.test/api";

const client = axios.create({
  baseURL,
  headers: {
    Accept: "application/json",
  },
});

// Attach the Sanctum token (stored after login) to every request.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the API ever returns 401 on notifications, silently ignore it
// (token may be from a different environment than the deployed API)
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.config?.url?.includes('/notifications') && error.response?.status === 401) {
      // Suppress 401 for notifications polling — return empty data
      return Promise.resolve({ data: { data: [], meta: { unread_count: 0 } } })
    }
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token")
      localStorage.removeItem("auth_user")
    }
    return Promise.reject(error)
  },
);

export default client;
