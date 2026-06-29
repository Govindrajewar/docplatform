import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse, AssetType, PaginationMeta } from '@platform/shared';
import { toast } from 'sonner';

import { api } from '@/lib/axios';

export interface AssetListItem {
  _id: string;
  type: AssetType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

async function unwrapList(
  promise: Promise<{ data: ApiResponse<AssetListItem[]> & { meta?: PaginationMeta } }>,
): Promise<{ items: AssetListItem[]; meta?: PaginationMeta }> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return { items: data.data, meta: data.meta };
}

export function useAssets(page = 1, limit = 20, type?: AssetType) {
  return useQuery({
    queryKey: ['assets', page, limit, type],
    queryFn: () => unwrapList(api.get('/assets', { params: { page, limit, type } })),
  });
}

export function useUploadAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, type }: { file: File; type: AssetType }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      return unwrap<AssetListItem>(
        api.post('/assets', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset uploaded');
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap<{ message: string }>(api.delete(`/assets/${id}`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset deleted');
    },
  });
}

/**
 * The asset-file route requires the in-memory Bearer access token, so a plain `<a href>` to it
 * would 401 (the browser navigation has no Authorization header) — fetch it through the
 * authenticated axios instance instead and open the result as a blob URL.
 */
export async function openAssetFile(id: string): Promise<void> {
  const res = await api.get(`/assets/${id}/file`, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(res.data as Blob);
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
