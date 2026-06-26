import { useQuery } from '@tanstack/react-query';
import type { ApiResponse } from '@platform/shared';

import { api } from '@/lib/axios';

export interface SearchResults {
  customers?: Array<{ _id: string; name: string; email?: string }>;
  users?: Array<{ id: string; name: string; email: string }>;
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

export function useGlobalSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => unwrap<SearchResults>(api.get('/search', { params: { q } })),
    enabled: q.trim().length > 1,
  });
}
