import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeOverride = 'light' | 'dark' | null;

interface ThemeState {
  /** Explicit user override from the header toggle. `null` defers to the org's Settings theme. */
  override: ThemeOverride;
  /** Resolved light/dark appearance currently applied to the document — derived, not persisted. */
  isDark: boolean;
  setOverride: (override: ThemeOverride) => void;
  setIsDark: (isDark: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      override: null,
      isDark: false,
      setOverride: (override) => set({ override }),
      setIsDark: (isDark) => set({ isDark }),
    }),
    {
      name: 'theme-override',
      partialize: (state) => ({ override: state.override }),
    },
  ),
);
