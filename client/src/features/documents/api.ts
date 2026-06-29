import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiResponse,
  BulkGenerateInput,
  CreateDocumentInput,
  DocumentStatus,
  PaginationMeta,
} from '@platform/shared';

import { api } from '@/lib/axios';

export interface DocumentListItem {
  _id: string;
  templateId: string;
  templateVersionId: string;
  customerId: string | null;
  dataPayload: Record<string, unknown>;
  status: DocumentStatus;
  failureReason: string | null;
  createdAt: string;
}

export interface ImportPreviewResult {
  columns: string[];
  rows: Record<string, string>[];
  suggestedMapping: Record<string, string | null>;
}

export interface BulkGenerateResult {
  batchId: string;
  total: number;
  accepted: number;
  rejected: { row: number; reason: string }[];
}

export interface BatchStatus {
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  failures: { row: number; reason: string }[];
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

async function unwrapList<T>(
  promise: Promise<{ data: ApiResponse<T[]> & { meta?: PaginationMeta } }>,
): Promise<{ items: T[]; meta?: PaginationMeta }> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return { items: data.data, meta: data.meta };
}

export function useDocuments(
  page = 1,
  limit = 20,
  filters: { templateId?: string; customerId?: string; status?: DocumentStatus } = {},
) {
  return useQuery({
    queryKey: ['documents', page, limit, filters],
    queryFn: () =>
      unwrapList<DocumentListItem>(api.get('/documents', { params: { page, limit, ...filters } })),
    // Auto-refresh while anything is still rendering, so status/failure reasons show up without
    // a manual refresh — stops polling once nothing in the current page is mid-generation.
    refetchInterval: (query) =>
      query.state.data?.items.some((d) => d.status === 'generating') ? 3000 : false,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDocumentInput) =>
      unwrap<DocumentListItem>(api.post('/documents', input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useRegenerateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap<DocumentListItem>(api.post(`/documents/${id}/regenerate`)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap<{ message: string }>(api.delete(`/documents/${id}`)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

/** Mirrors `openAssetFile` (features/assets/api.ts) — the PDF route needs the in-memory Bearer
 * token, so a plain `<a href>` would 401; fetch through axios and open as a blob URL instead. */
export async function openDocumentPdf(id: string): Promise<void> {
  const res = await api.get(`/documents/${id}/pdf`, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(res.data as Blob);
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export function useImportPreview() {
  return useMutation({
    mutationFn: ({ templateId, file }: { templateId: string; file: File }) => {
      const formData = new FormData();
      formData.append('templateId', templateId);
      formData.append('file', file);
      return unwrap<ImportPreviewResult>(
        api.post('/documents/import', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }),
      );
    },
  });
}

export function useBulkGenerate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkGenerateInput) =>
      unwrap<BulkGenerateResult>(api.post('/documents/bulk-generate', input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useBatch(batchId: string | undefined) {
  return useQuery({
    queryKey: ['documents', 'batches', batchId],
    queryFn: () => unwrap<BatchStatus>(api.get(`/documents/batches/${batchId}`)),
    enabled: Boolean(batchId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 1500;
      return data.completed + data.failed < data.total ? 1500 : false;
    },
  });
}
