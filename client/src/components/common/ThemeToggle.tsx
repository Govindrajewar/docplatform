import { Moon, Sun } from 'lucide-react';

import { useThemeStore } from '@/stores/theme.store';

export function ThemeToggle() {
  const isDark = useThemeStore((s) => s.isDark);
  const setOverride = useThemeStore((s) => s.setOverride);

  return (
    <button
      type="button"
      onClick={() => setOverride(isDark ? 'light' : 'dark')}
      className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
