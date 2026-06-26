import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse, UpdateOrganizationInput } from '@platform/shared';

import { api } from '@/lib/axios';

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  primaryColor: string;
  secondaryColor: string;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultPaperSize: string;
  isActive: boolean;
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

export function useMyOrganization() {
  return useQuery({
    queryKey: ['organizations', 'mine'],
    queryFn: () => unwrap<Organization>(api.get('/organizations/mine')),
  });
}

export function useUpdateMyOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOrganizationInput) =>
      unwrap<Organization>(api.patch('/organizations/mine', input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organizations', 'mine'] }),
  });
}
