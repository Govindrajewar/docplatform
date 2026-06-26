import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, PaginationMeta } from '@platform/shared';

import { api } from '@/lib/axios';

export interface AuditLogEntry {
  _id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

async function unwrapList(
  promise: Promise<{ data: ApiResponse<AuditLogEntry[]> & { meta?: PaginationMeta } }>,
): Promise<{ items: AuditLogEntry[]; meta?: PaginationMeta }> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return { items: data.data, meta: data.meta };
}

export function useAuditLogs(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['audit-logs', page, limit],
    queryFn: () => unwrapList(api.get('/audit-logs', { params: { page, limit } })),
  });
}
