import { zodResolver } from '@hookform/resolvers/zod';
import { FileText } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { createTemplateSchema, type CreateTemplateInput } from '@platform/shared';

import { EmptyState } from '@/components/common/EmptyState';
import { FadeIn } from '@/components/common/FadeIn';
import { TableSkeleton } from '@/components/common/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useArchiveTemplate,
  useCreateTemplate,
  useDuplicateTemplate,
  useExportTemplate,
  useImportTemplate,
  useTemplates,
} from '@/features/templates/api';

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function TemplatesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useTemplates(page, 20);
  const createTemplate = useCreateTemplate();
  const duplicateTemplate = useDuplicateTemplate();
  const archiveTemplate = useArchiveTemplate();
  const exportTemplate = useExportTemplate();
  const importTemplate = useImportTemplate();
  const importInputRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTemplateInput>({ resolver: zodResolver(createTemplateSchema) });

  const onSubmit = (input: CreateTemplateInput) =>
    createTemplate.mutate(input, { onSuccess: () => reset() });

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    importTemplate.mutate(JSON.parse(text));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="text-muted-foreground">Design document layouts once, generate forever.</p>
        </div>
        <div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = '';
            }}
          />
          <Button
            variant="outline"
            onClick={() => importInputRef.current?.click()}
            isLoading={importTemplate.isPending}
          >
            Import bundle
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create a template</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end"
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="documentType">Document type</Label>
              <Input
                id="documentType"
                placeholder="invoice, account_statement, …"
                {...register('documentType')}
              />
              {errors.documentType && (
                <p className="text-sm text-destructive">{errors.documentType.message}</p>
              )}
            </div>
            <Button type="submit" isLoading={createTemplate.isPending}>
              Create template
            </Button>
          </form>
          {createTemplate.isError && (
            <p className="mt-2 text-sm text-destructive">
              {(createTemplate.error as Error).message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All templates ({data?.meta?.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton cols={4} />
          ) : (
            <FadeIn>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2">Name</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((t) => (
                    <tr key={t._id} className="border-b border-border last:border-0">
                      <td className="py-2">
                        <Link
                          to={`/templates/${t._id}/design`}
                          className="text-primary hover:underline"
                        >
                          {t.name}
                        </Link>
                      </td>
                      <td className="py-2">{t.documentType}</td>
                      <td className="py-2 capitalize">{t.status}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {t.currentVersionId && (
                            <Link
                              to={`/templates/${t._id}/generate`}
                              className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium hover:bg-muted"
                            >
                              Generate
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => duplicateTemplate.mutate(t._id)}
                          >
                            Duplicate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              exportTemplate.mutate(t._id, {
                                onSuccess: (bundle) => downloadJson(`${t.name}.json`, bundle),
                              })
                            }
                          >
                            Export
                          </Button>
                          {t.status !== 'archived' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => archiveTemplate.mutate(t._id)}
                            >
                              Archive
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data?.items.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState
                          icon={FileText}
                          title="No templates yet"
                          description="Create your first template above to start designing documents."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </FadeIn>
          )}
          {data?.meta && data.meta.totalPages > 1 && (
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
