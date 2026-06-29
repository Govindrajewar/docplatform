import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, DocumentStatus } from '@platform/shared';

import { api } from '@/lib/axios';
import type { AuditLogEntry } from '@/features/audit-logs/api';
import type { DocumentListItem } from '@/features/documents/api';

export interface DashboardSummary {
  kpis: {
    totalCustomers: number;
    totalTemplates: number;
    publishedTemplates: number;
    totalDocuments: number;
    documentsByStatus: Record<DocumentStatus, number>;
    totalAssets: number;
    assetsStorageBytes: number;
    documentsStorageBytes: number;
    totalStorageBytes: number;
  };
  documentsOverTime: { date: string; count: number }[];
  recentDocuments: DocumentListItem[];
  recentActivity: AuditLogEntry[] | null;
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => unwrap<DashboardSummary>(api.get('/dashboard/summary')),
  });
}
