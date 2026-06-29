import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiResponse,
  CreateUserInput,
  PaginationMeta,
  UpdateUserInput,
} from '@platform/shared';
import { toast } from 'sonner';

import { api } from '@/lib/axios';

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  status: string;
  roleId: string;
  createdAt: string;
}

async function unwrapList(
  promise: Promise<{ data: ApiResponse<UserListItem[]> & { meta?: PaginationMeta } }>,
): Promise<{ items: UserListItem[]; meta?: PaginationMeta }> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return { items: data.data, meta: data.meta };
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

export function useUsers(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['users', page, limit],
    queryFn: () => unwrapList(api.get('/users', { params: { page, limit } })),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => unwrap<UserListItem>(api.post('/users', input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Invitation sent');
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      unwrap<UserListItem>(api.patch(`/users/${id}`, input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated');
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap<{ message: string }>(api.delete(`/users/${id}`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User removed');
    },
  });
}
