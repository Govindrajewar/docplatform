import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiResponse,
  CreateFieldDefinitionInput,
  UpdateFieldDefinitionInput,
} from '@platform/shared';

import { api } from '@/lib/axios';

export interface FieldDefinitionItem {
  key: string;
  label: string;
  type: 'text' | 'date' | 'currency' | 'number' | 'boolean';
  system: boolean;
  required: boolean;
  defaultValue: string | number | boolean | null;
  _id?: string;
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await promise;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}

export function useFieldDefinitions() {
  return useQuery({
    queryKey: ['field-definitions'],
    queryFn: () => unwrap<FieldDefinitionItem[]>(api.get('/field-definitions')),
  });
}

export function useCreateFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFieldDefinitionInput) =>
      unwrap<FieldDefinitionItem>(api.post('/field-definitions', input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['field-definitions'] }),
  });
}

export function useUpdateFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFieldDefinitionInput }) =>
      unwrap<FieldDefinitionItem>(api.patch(`/field-definitions/${id}`, input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['field-definitions'] }),
  });
}

export function useDeleteFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap<{ message: string }>(api.delete(`/field-definitions/${id}`)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['field-definitions'] }),
  });
}
