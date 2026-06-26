import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { useAuthStore } from '@/stores/auth.store';

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // sends the httpOnly refresh-token cookie
});

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const res = await axios.post('/api/v1/auth/refresh', null, { withCredentials: true });
  const { accessToken, user, role, permissions } = res.data.data;
  useAuthStore.getState().setSession({ accessToken, user, role, permissions });
  return accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const code = (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code;
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;

    if (status === 401 && code === 'TOKEN_EXPIRED' && original && !original._retried) {
      original._retried = true;
      try {
        refreshInFlight ??= refreshAccessToken().finally(() => {
          refreshInFlight = null;
        });
        const accessToken = await refreshInFlight;
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().clearSession();
      }
    }

    return Promise.reject(error);
  },
);
