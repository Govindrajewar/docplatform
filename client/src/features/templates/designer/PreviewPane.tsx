import { useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import { Button } from '@/components/ui/button';
import { usePreviewTemplate } from '@/features/templates/api';
import { getDocument } from '@/lib/pdfjs';
import { useDesignerStore } from '@/stores/designer.store';

export function PreviewPane() {
  const templateId = useDesignerStore((s) => s.templateId);
  const layout = useDesignerStore((s) => s.layout);
  const [sampleDataText, setSampleDataText] = useState('{}');
  const [sampleDataError, setSampleDataError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preview = usePreviewTemplate();

  const renderPage = async (doc: PDFDocumentProxy, page: number) => {
    const pdfPage = await doc.getPage(page);
    const viewport = pdfPage.getViewport({ scale: 1 });
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
  };

  const handlePreview = async () => {
    if (!templateId || !layout) return;
    let sampleData: Record<string, unknown>;
    try {
      sampleData = JSON.parse(sampleDataText);
      setSampleDataError(null);
    } catch {
      setSampleDataError('Sample data must be valid JSON');
      return;
    }

    const blob = await preview.mutateAsync({ templateId, layoutJson: layout, sampleData });
    const doc = await getDocument({ data: await blob.arrayBuffer() }).promise;
    setPdf(doc);
    setPageNumber(1);
    await renderPage(doc, 1);
  };

  const goToPage = async (page: number) => {
    if (!pdf || page < 1 || page > pdf.numPages) return;
    setPageNumber(page);
    await renderPage(pdf, page);
  };

  return (
    <div className="flex gap-6">
      <div className="flex w-72 flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Sample data (JSON)</p>
        <textarea
          className="min-h-40 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
          value={sampleDataText}
          onChange={(e) => setSampleDataText(e.target.value)}
        />
        {sampleDataError && <p className="text-xs text-destructive">{sampleDataError}</p>}
        <Button onClick={handlePreview} isLoading={preview.isPending}>
          Render preview
        </Button>
        {preview.isError && (
          <p className="text-xs text-destructive">{(preview.error as Error).message}</p>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center gap-2">
        {pdf && pdf.numPages > 1 && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pageNumber - 1)}
              disabled={pageNumber <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pageNumber} of {pdf.numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pageNumber + 1)}
              disabled={pageNumber >= pdf.numPages}
            >
              Next
            </Button>
          </div>
        )}
        <canvas ref={canvasRef} className="border border-border shadow-sm" />
        {!pdf && (
          <p className="py-12 text-sm text-muted-foreground">
            Click "Render preview" to see this draft rendered by the real PDF engine.
          </p>
        )}
      </div>
    </div>
  );
}
