import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type {
  ApiResponse,
  CreateTemplateInput,
  ImportTemplateBundleInput,
  PaginationMeta,
  SaveTemplateVersionInput,
  TemplateDocument,
  TemplateStatus,
  UpdateTemplateInput,
} from '@platform/shared';

import { api } from '@/lib/axios';

export interface TemplateListItem {
  _id: string;
  name: string;
  documentType: string;
  status: TemplateStatus;
  tags: string[];
  currentVersionId?: string | null;
  createdAt: string;
}

export interface TemplateVersionItem {
  _id: string;
  templateId: string;
  versionNumber: number;
  layoutJson: TemplateDocument;
  changeNote?: string | null;
  isPublished: boolean;
  createdAt: string;
}

export interface TemplateDetail extends TemplateListItem {
  latestVersion: TemplateVersionItem;
}

export interface TemplateVersionDiff {
  added: string[];
  removed: string[];
  modified: { id: string; changedKeys: string[] }[];
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

export function useTemplates(
  page = 1,
  limit = 20,
  filters: { q?: string; documentType?: string; status?: TemplateStatus } = {},
) {
  return useQuery({
    queryKey: ['templates', page, limit, filters],
    queryFn: () =>
      unwrapList<TemplateListItem>(api.get('/templates', { params: { page, limit, ...filters } })),
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: () => unwrap<TemplateDetail>(api.get(`/templates/${id}`)),
    enabled: Boolean(id),
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTemplateInput) =>
      unwrap<TemplateDetail>(api.post('/templates', input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTemplateInput }) =>
      unwrap<TemplateListItem>(api.patch(`/templates/${id}`, input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useArchiveTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap<TemplateListItem>(api.delete(`/templates/${id}`)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useDuplicateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap<TemplateDetail>(api.post(`/templates/${id}/duplicate`)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useExportTemplate() {
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<ImportTemplateBundleInput>(api.post(`/templates/${id}/export`)),
  });
}

export function useImportTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bundle: ImportTemplateBundleInput) =>
      unwrap<TemplateDetail>(api.post('/templates/import', bundle)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useTemplateVersions(templateId: string | undefined, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['templates', templateId, 'versions', page, limit],
    queryFn: () =>
      unwrapList<TemplateVersionItem>(
        api.get(`/templates/${templateId}/versions`, { params: { page, limit } }),
      ),
    enabled: Boolean(templateId),
  });
}

/** Fetches the *published* version specifically (not just the latest draft `useTemplate`
 * returns) — generation validates and renders against `currentVersionId`, so the generate
 * form's fields must come from that exact version, not whatever is newest in the designer. */
export function useTemplateVersion(templateId: string | undefined, versionId: string | undefined) {
  return useQuery({
    queryKey: ['templates', templateId, 'versions', versionId],
    queryFn: () =>
      unwrap<TemplateVersionItem>(api.get(`/templates/${templateId}/versions/${versionId}`)),
    enabled: Boolean(templateId && versionId),
  });
}

export function useSaveTemplateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, input }: { templateId: string; input: SaveTemplateVersionInput }) =>
      unwrap<TemplateVersionItem>(api.post(`/templates/${templateId}/versions`, input)),
    onSuccess: (_data, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    },
  });
}

export function usePublishTemplateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, versionId }: { templateId: string; versionId: string }) =>
      unwrap<TemplateListItem>(api.post(`/templates/${templateId}/versions/${versionId}/publish`)),
    // Publishing changes `status`, which the list page also displays — invalidating only
    // `['templates', templateId]` wouldn't reach the separate `['templates', page, limit, ...]`
    // list query key, since neither is a prefix of the other. Invalidate the whole `['templates']`
    // branch instead, same as create/update/archive/duplicate below.
    onSuccess: (_data, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['templates', templateId, 'versions'] });
    },
  });
}

export function useRestoreTemplateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, versionId }: { templateId: string; versionId: string }) =>
      unwrap<TemplateListItem & { version: TemplateVersionItem }>(
        api.post(`/templates/${templateId}/versions/${versionId}/restore`),
      ),
    onSuccess: (_data, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['templates', templateId, 'versions'] });
    },
  });
}

export function useCompareTemplateVersions(
  templateId: string | undefined,
  from: string | undefined,
  to: string | undefined,
) {
  return useQuery({
    queryKey: ['templates', templateId, 'versions', 'compare', from, to],
    queryFn: () =>
      unwrap<TemplateVersionDiff>(
        api.get(`/templates/${templateId}/versions/compare`, { params: { from, to } }),
      ),
    enabled: Boolean(templateId && from && to),
  });
}

/** Surfaces the JSON error body even though the request asks for a `blob` response (needed to
 * read PDF bytes) — without this, a 422 validation failure would otherwise just look like a
 * corrupt/empty PDF blob to the caller. */
async function readBlobError(error: unknown): Promise<never> {
  if (error instanceof AxiosError && error.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text();
      const parsed = JSON.parse(text) as ApiResponse<unknown>;
      if (!parsed.success) throw new Error(parsed.error.message);
    } catch {
      // fall through to the generic error below if the blob wasn't JSON
    }
  }
  throw error instanceof Error ? error : new Error('Failed to render preview');
}

export function usePreviewTemplate() {
  return useMutation({
    mutationFn: async ({
      templateId,
      layoutJson,
      versionId,
      sampleData,
    }: {
      templateId: string;
      layoutJson?: TemplateDocument;
      versionId?: string;
      sampleData: Record<string, unknown>;
    }) => {
      try {
        const res = await api.post(
          `/templates/${templateId}/preview`,
          { layoutJson, versionId, sampleData },
          { responseType: 'blob' },
        );
        return res.data as Blob;
      } catch (error) {
        return readBlobError(error);
      }
    },
  });
}
