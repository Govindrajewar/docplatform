import { PDFDocument } from 'pdf-lib';

import { drawDocument } from './draw/draw-document';
import { FontRegistry } from './fonts/font-registry';
import { paginateDocument } from './layout/paginate';
import { resolvePageGeometry } from './layout/page-geometry';
import type { RenderOptions } from './types';

/**
 * Renders a template + data context (+ optional binary assets) to a PDF buffer. This is the
 * single public entry point for the rendering engine described in PRD 04/11 Phase 3:
 * `render(layoutJson, dataContext, assets) -> PDF buffer`. Internally it's three strictly
 * separated stages — Resolver (token substitution, formatting, `visibleIf`), Layout (page
 * geometry, text wrapping, section flow, table pagination), and Draw (the only stage that
 * touches pdf-lib) — wired together here.
 */
export async function render(options: RenderOptions): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fontRegistry = new FontRegistry(pdfDoc, options.assets ?? {});

  const layout = await paginateDocument(options, fontRegistry);
  const geometry = resolvePageGeometry(options.template);

  await drawDocument(layout, geometry, options, fontRegistry, pdfDoc);

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
