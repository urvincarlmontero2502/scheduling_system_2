import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    Accept: "application/json",
  },
});

const csrfClient = axios.create({ withCredentials: true });
let csrfCookieRequest;

function fetchCsrfCookie() {
  if (!csrfCookieRequest) {
    csrfCookieRequest = csrfClient
      .get("/sanctum/csrf-cookie")
      .catch((error) => {
        csrfCookieRequest = undefined;
        throw error;
      });
  }
  return csrfCookieRequest;
}

client.interceptors.request.use(async (config) => {
  if (["post", "put", "patch", "delete"].includes(config.method?.toLowerCase())) {
    await fetchCsrfCookie();
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.config?.url?.includes('/notifications') && error.response?.status === 401) {
      return Promise.resolve({ data: { data: [], meta: { unread_count: 0 } } })
    }
    if (error.response?.status === 419 && !error.config?._csrfRetry) {
      error.config._csrfRetry = true;
      csrfCookieRequest = undefined;
      await fetchCsrfCookie();
      return client(error.config);
    }
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token")
      localStorage.removeItem("auth_user")
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:unauthorized"))
      }
    }
    return Promise.reject(error)
  },
);

export default client;
