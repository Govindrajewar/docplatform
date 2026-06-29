import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';

import { AuthBootstrap } from './AuthBootstrap';
import { router } from './router';

import { useThemeSync } from '@/hooks/useThemeSync';
import { queryClient } from '@/lib/query-client';

function ThemeSync() {
  useThemeSync();
  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <AuthBootstrap>
        <RouterProvider router={router} />
      </AuthBootstrap>
      <Toaster richColors position="top-right" closeButton />
    </QueryClientProvider>
  );
}
