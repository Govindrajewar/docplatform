import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  useCompareTemplateVersions,
  usePublishTemplateVersion,
  useRestoreTemplateVersion,
  useTemplateVersions,
} from '@/features/templates/api';
import { useDesignerStore } from '@/stores/designer.store';

export function VersionHistoryPanel() {
  const templateId = useDesignerStore((s) => s.templateId);
  const currentVersionId = useDesignerStore((s) => s.currentVersionId);
  const load = useDesignerStore((s) => s.load);
  const { data } = useTemplateVersions(templateId ?? undefined, 1, 50);
  const publish = usePublishTemplateVersion();
  const restore = useRestoreTemplateVersion();

  const [compareFrom, setCompareFrom] = useState<string>('');
  const [compareTo, setCompareTo] = useState<string>('');
  const { data: diff } = useCompareTemplateVersions(
    templateId ?? undefined,
    compareFrom || undefined,
    compareTo || undefined,
  );

  if (!templateId) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {data?.items.map((version) => (
          <div
            key={version._id}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium">v{version.versionNumber}</span>{' '}
              {version.isPublished && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                  published
                </span>
              )}
              {version._id === currentVersionId && (
                <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  loaded
                </span>
              )}
              {version.changeNote && (
                <p className="text-xs text-muted-foreground">{version.changeNote}</p>
              )}
            </div>
            <div className="flex gap-2">
              {!version.isPublished && (
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={publish.isPending}
                  onClick={() => publish.mutate({ templateId, versionId: version._id })}
                >
                  Publish
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                isLoading={restore.isPending}
                onClick={() =>
                  restore.mutate(
                    { templateId, versionId: version._id },
                    {
                      onSuccess: (result) =>
                        load(
                          templateId,
                          result.version._id,
                          result.version.versionNumber,
                          result.version.layoutJson,
                        ),
                    },
                  )
                }
              >
                Restore
              </Button>
            </div>
          </div>
        ))}
        {data?.items.length === 0 && (
          <p className="text-sm text-muted-foreground">No versions yet.</p>
        )}
      </div>

      {(publish.isError || restore.isError) && (
        <p className="text-sm text-destructive">
          {((publish.error ?? restore.error) as Error).message}
        </p>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-xs font-medium text-muted-foreground">Compare two versions</p>
        <div className="flex gap-2">
          <select
            className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm"
            value={compareFrom}
            onChange={(e) => setCompareFrom(e.target.value)}
          >
            <option value="">From…</option>
            {data?.items.map((v) => (
              <option key={v._id} value={v._id}>
                v{v.versionNumber}
              </option>
            ))}
          </select>
          <select
            className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm"
            value={compareTo}
            onChange={(e) => setCompareTo(e.target.value)}
          >
            <option value="">To…</option>
            {data?.items.map((v) => (
              <option key={v._id} value={v._id}>
                v{v.versionNumber}
              </option>
            ))}
          </select>
        </div>
        {diff && (
          <div className="rounded-md bg-muted/30 p-3 text-xs">
            <p>
              <span className="font-medium">Added:</span> {diff.added.join(', ') || 'none'}
            </p>
            <p>
              <span className="font-medium">Removed:</span> {diff.removed.join(', ') || 'none'}
            </p>
            <p>
              <span className="font-medium">Modified:</span>{' '}
              {diff.modified.map((m) => `${m.id} (${m.changedKeys.join(', ')})`).join('; ') ||
                'none'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
