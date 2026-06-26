import { type ReactNode, useEffect, useState } from 'react';

import { api } from '@/lib/axios';
import { useAuthStore } from '@/stores/auth.store';

/**
 * The access token only ever lives in memory, so a hard page reload loses it even though the
 * httpOnly refresh cookie is still valid. On mount, attempt one silent refresh to restore the
 * session before rendering routes — see PRD 06 §6.1.2.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    let cancelled = false;
    api
      .post('/auth/refresh')
      .then((res) => {
        if (!cancelled && res.data.success) setSession(res.data.data);
      })
      .catch(() => {
        /* no valid session — user will land on the login page */
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [setSession]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
