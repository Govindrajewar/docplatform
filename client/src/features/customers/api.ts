import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiResponse,
  CreateCustomerInput,
  PaginationMeta,
  UpdateCustomerInput,
} from '@platform/shared';
import { toast } from 'sonner';

import { api } from '@/lib/axios';

export interface CustomerListItem {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: Record<string, string>;
  createdAt: string;
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

async function unwrapList(
  promise: Promise<{ data: ApiResponse<CustomerListItem[]> & { meta?: PaginationMeta } }>,
): Promise<{ items: CustomerListItem[]; meta?: PaginationMeta }> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return { items: data.data, meta: data.meta };
}

export function useCustomers(page = 1, limit = 20, q?: string) {
  return useQuery({
    queryKey: ['customers', page, limit, q],
    queryFn: () => unwrapList(api.get('/customers', { params: { page, limit, q } })),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCustomerInput) =>
      unwrap<CustomerListItem>(api.post('/customers', input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer created');
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCustomerInput }) =>
      unwrap<CustomerListItem>(api.patch(`/customers/${id}`, input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer updated');
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap<{ message: string }>(api.delete(`/customers/${id}`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
    },
  });
}
