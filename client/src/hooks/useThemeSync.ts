import { useEffect } from 'react';

import { useSettings } from '@/features/settings/api';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';

/**
 * Applies the effective theme (explicit local override, else the org's Settings.theme, else
 * 'system') to <html class="dark">. Mounted once in App.tsx so it runs regardless of route,
 * including pre-auth pages where only the local override/system preference is available.
 */
export function useThemeSync() {
  const override = useThemeStore((s) => s.override);
  const setIsDark = useThemeStore((s) => s.setIsDark);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data: settings } = useSettings({ enabled: Boolean(accessToken) });

  useEffect(() => {
    const effective = override ?? settings?.theme ?? 'system';

    const apply = (dark: boolean) => {
      document.documentElement.classList.toggle('dark', dark);
      setIsDark(dark);
    };

    if (effective === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mql.matches);
      const onChange = (e: MediaQueryListEvent) => apply(e.matches);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }

    apply(effective === 'dark');
    return undefined;
  }, [override, settings?.theme, setIsDark]);
}
