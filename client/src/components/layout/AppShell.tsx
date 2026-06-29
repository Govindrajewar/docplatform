import {
  FileClock,
  FileStack,
  FileText,
  LayoutDashboard,
  Image,
  LogOut,
  Settings,
  Users,
  UsersRound,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { GlobalSearch } from '@/components/common/GlobalSearch';
import { NotificationBell } from '@/components/common/NotificationBell';
import { PageTransition } from '@/components/common/PageTransition';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { cn } from '@/lib/cn';
import { useLogout } from '@/features/auth/api';
import { useAuthStore } from '@/stores/auth.store';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/documents', label: 'Documents', icon: FileStack },
  { to: '/customers', label: 'Customers', icon: UsersRound },
  { to: '/assets', label: 'Assets', icon: Image },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/audit-logs', label: 'Logs', icon: FileClock },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const logout = useLogout();

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="flex w-64 flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center px-6 text-lg font-semibold">DocPlatform</div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  isActive &&
                    'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{role}</p>
          <button
            className="mt-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive"
            onClick={() => logout.mutate()}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-end gap-3 border-b border-border bg-card px-8">
          <GlobalSearch />
          <ThemeToggle />
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <PageTransition />
        </main>
      </div>
    </div>
  );
}
