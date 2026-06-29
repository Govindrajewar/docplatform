import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Canvas } from '@/features/templates/designer/Canvas';
import { ElementPalette } from '@/features/templates/designer/ElementPalette';
import { PreviewPane } from '@/features/templates/designer/PreviewPane';
import { PropertyPanel } from '@/features/templates/designer/PropertyPanel';
import { VersionHistoryPanel } from '@/features/templates/designer/VersionHistoryPanel';
import { useSaveTemplateVersion, useTemplate } from '@/features/templates/api';
import { useDesignerStore } from '@/stores/designer.store';

type Tab = 'design' | 'preview' | 'history';

export function TemplateDesignerPage() {
  const { id } = useParams<{ id: string }>();
  const { data: template, isLoading } = useTemplate(id);
  const saveVersion = useSaveTemplateVersion();
  const load = useDesignerStore((s) => s.load);
  const dirty = useDesignerStore((s) => s.dirty);
  const layout = useDesignerStore((s) => s.layout);
  const baseVersionNumber = useDesignerStore((s) => s.baseVersionNumber);
  const addSection = useDesignerStore((s) => s.addSection);
  const [tab, setTab] = useState<Tab>('design');
  const [saveError, setSaveError] = useState<string | null>(null);
  const loadedVersionId = useRef<string | null>(null);

  useEffect(() => {
    if (!id || !template) return;
    // Only seed the store the first time this version is seen — re-running on every refetch
    // would silently clobber whatever the admin is mid-editing in the canvas.
    if (loadedVersionId.current === template.latestVersion._id) return;
    loadedVersionId.current = template.latestVersion._id;
    load(
      id,
      template.latestVersion._id,
      template.latestVersion.versionNumber,
      template.latestVersion.layoutJson,
    );
  }, [id, template, load]);

  const handleSave = () => {
    if (!id || !layout) return;
    setSaveError(null);
    saveVersion.mutate(
      {
        templateId: id,
        input: { layoutJson: layout, baseVersionNumber: baseVersionNumber ?? undefined },
      },
      {
        onSuccess: (version) => {
          useDesignerStore
            .getState()
            .markSaved(version._id, version.versionNumber, version.layoutJson);
        },
        onError: (error) => setSaveError((error as Error).message),
      },
    );
  };

  if (isLoading || !template) {
    return <p className="text-sm text-muted-foreground">Loading template…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/templates" className="text-sm text-muted-foreground hover:underline">
            ← Templates
          </Link>
          <h1 className="text-2xl font-semibold">{template.name}</h1>
          <p className="text-sm text-muted-foreground">
            {template.documentType} · {template.status}
            {dirty && ' · unsaved changes'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSave}
            isLoading={saveVersion.isPending}
            disabled={!dirty}
          >
            Save draft
          </Button>
        </div>
      </div>
      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      <div className="flex gap-2 border-b border-border">
        {(['design', 'preview', 'history'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium capitalize ${
              tab === t
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'design' && (
        <div className="grid grid-cols-[200px_1fr_280px] gap-4">
          <Card>
            <CardContent className="flex flex-col gap-3 p-4">
              <Button size="sm" variant="outline" onClick={addSection}>
                + Add section
              </Button>
              <ElementPalette />
            </CardContent>
          </Card>
          <div className="overflow-auto rounded-md border border-border bg-muted/20 p-6">
            <Canvas />
          </div>
          <Card>
            <CardContent className="p-4">
              <PropertyPanel />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'preview' && (
        <Card>
          <CardContent className="p-6">
            <PreviewPane />
          </CardContent>
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <CardContent className="p-6">
            <VersionHistoryPanel />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
