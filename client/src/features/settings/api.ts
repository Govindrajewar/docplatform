import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse, UpdateSettingsInput } from '@platform/shared';

import { api } from '@/lib/axios';

export interface Settings {
  theme: string;
  language: string;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultPaperSize: string;
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => unwrap<Settings>(api.get('/settings')),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => unwrap<Settings>(api.patch('/settings', input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });
}
