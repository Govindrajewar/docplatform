import { create } from 'zustand';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  role: string | null;
  permissions: string[];
  setSession: (session: {
    accessToken: string;
    user: AuthUser;
    role?: string;
    permissions?: string[];
  }) => void;
  clearSession: () => void;
}

/**
 * Access token lives in memory only (never localStorage/sessionStorage) — an XSS payload that
 * can run JS can already do anything in-page, but it can't read this across a page reload or
 * exfiltrate it from storage. See PRD 08 §8.1.
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  role: null,
  permissions: [],
  setSession: ({ accessToken, user, role, permissions }) =>
    set({ accessToken, user, role: role ?? null, permissions: permissions ?? [] }),
  clearSession: () => set({ accessToken: null, user: null, role: null, permissions: [] }),
}));
