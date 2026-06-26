import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  ApiResponse,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@platform/shared';

import { api } from '@/lib/axios';
import { useAuthStore, type AuthUser } from '@/stores/auth.store';

interface AuthSessionData {
  user: AuthUser;
  accessToken: string;
  role?: string;
  permissions?: string[];
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (input: LoginInput) => unwrap<AuthSessionData>(api.post('/auth/login', input)),
    onSuccess: (data) => setSession(data),
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      unwrap<AuthSessionData>(api.post('/auth/register', input)),
    onSuccess: (data) => setSession(data),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      unwrap<{ message: string }>(api.post('/auth/forgot-password', input)),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      unwrap<{ message: string }>(api.post('/auth/reset-password', input)),
  });
}

export function useLogout() {
  const clearSession = useAuthStore((s) => s.clearSession);
  return useMutation({
    mutationFn: () => unwrap<{ message: string }>(api.post('/auth/logout')),
    onSuccess: () => clearSession(),
  });
}

export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () =>
      unwrap<{ user: AuthUser; role: string; permissions: string[] }>(api.get('/auth/me')),
    enabled,
    retry: false,
  });
}
