import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
  // A single place that surfaces every mutation's failure as a toast — pages can still render
  // an inline error too (some already do, for form-level context), but no mutation across the
  // app silently fails with no feedback at all.
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    },
  }),
});
