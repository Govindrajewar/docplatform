import { useState } from 'react';
import type { DocumentStatus } from '@platform/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  openDocumentPdf,
  useDeleteDocument,
  useDocuments,
  useRegenerateDocument,
} from '@/features/documents/api';
import { useTemplates } from '@/features/templates/api';

const STATUS_OPTIONS: { value: DocumentStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'generating', label: 'Generating' },
  { value: 'generated', label: 'Generated' },
  { value: 'failed', label: 'Failed' },
];

export function DocumentsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<DocumentStatus | ''>('');
  const { data, isLoading } = useDocuments(page, 20, { status: status || undefined });
  const { data: templates } = useTemplates(1, 100);
  const regenerate = useRegenerateDocument();
  const remove = useDeleteDocument();

  const templateNameById = new Map(templates?.items.map((t) => [t._id, t.name]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-muted-foreground">Every document generated from a template.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>All documents ({data?.meta?.total ?? 0})</CardTitle>
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as DocumentStatus | '');
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2">Template</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Created</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {data?.items.map((d) => (
                  <tr key={d._id} className="border-b border-border last:border-0">
                    <td className="py-2">{templateNameById.get(d.templateId) ?? d.templateId}</td>
                    <td className="py-2">
                      <span className="capitalize">{d.status}</span>
                      {d.status === 'failed' && d.failureReason && (
                        <p className="text-xs text-destructive">{d.failureReason}</p>
                      )}
                    </td>
                    <td className="py-2">{new Date(d.createdAt).toLocaleString()}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {d.status === 'generated' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void openDocumentPdf(d._id)}
                          >
                            Download
                          </Button>
                        )}
                        {(d.status === 'failed' || d.status === 'generated') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => regenerate.mutate(d._id)}
                          >
                            Regenerate
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => remove.mutate(d._id)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      No documents yet — generate one from a template.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
