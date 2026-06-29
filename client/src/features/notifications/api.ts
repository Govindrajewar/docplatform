import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse, NotificationType, PaginationMeta } from '@platform/shared';

import { api } from '@/lib/axios';

export interface NotificationItem {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

async function unwrapList(
  promise: Promise<{ data: ApiResponse<NotificationItem[]> & { meta?: PaginationMeta } }>,
): Promise<{ items: NotificationItem[]; meta?: PaginationMeta }> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return { items: data.data, meta: data.meta };
}

export function useNotifications(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['notifications', page, limit],
    queryFn: () => unwrapList(api.get('/notifications', { params: { page, limit } })),
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => unwrap<{ count: number }>(api.get('/notifications/unread-count')),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap<NotificationItem>(api.post(`/notifications/${id}/read`)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap<{ message: string }>(api.post('/notifications/read-all')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
