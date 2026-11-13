import axios, { AxiosError } from 'axios';

export const TOKEN_KEY = 'fintech_token';
export const USER_KEY = 'fintech_user';

const baseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';

export const api = axios.create({
  baseURL,
  timeout: 45000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function handleUnauthorized() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event('fintech:unauthorized'));
}

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) handleUnauthorized();
    return Promise.reject(error);
  }
);

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (error.code === 'ECONNABORTED') return 'The request timed out. Is the backend running?';
    if (!error.response) return 'Cannot reach the backend. Is the server running on port 5000?';
    return `Request failed (${error.response.status}).`;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
