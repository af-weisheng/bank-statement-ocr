import axios, { InternalAxiosRequestConfig } from 'axios';

export const TOKEN_KEY       = 'auth_token';
export const ADMIN_TOKEN_KEY = 'admin_token';

// ─── Axios instance ───────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor ──────────────────────────────────────────────────────
// Attach the appropriate Bearer token. Admin endpoints (URL contains "/admin")
// use the admin token; all other endpoints use the user token.

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const isAdminEndpoint = config.url?.includes('/admin') ?? false;
  const token = isAdminEndpoint
    ? localStorage.getItem(ADMIN_TOKEN_KEY)
    : localStorage.getItem(TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor ─────────────────────────────────────────────────────
// On 401: clear the relevant token and redirect to the appropriate login page
// so the user is never left on a protected page with an invalid/expired session.

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401
    ) {
      const isAdminEndpoint = error.config?.url?.includes('/admin') ?? false;
      if (isAdminEndpoint) {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        window.location.href = '/admin/login';
      } else {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
