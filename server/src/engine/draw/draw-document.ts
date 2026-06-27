import { degrees, PDFDocument, rgb, type PDFPage } from 'pdf-lib';

import { FontRegistry, type EmbeddedFont } from '../fonts/font-registry';
import type { PageGeometry } from '../layout/page-geometry';
import type { DocumentLayout, PositionedElement } from '../layout/types';
import { wrapText } from '../layout/text-measure';
import { substituteSystemTokens } from '../resolver/tokens';
import type { AssetMap, RenderOptions } from '../types';

import { hexToRgb } from './colors';
import { drawPositionedElement } from './draw-element';
import { drawTableChunk } from './draw-table';

/** Re-resolves `{{system.*}}` tokens (left untouched by the resolver stage) now that the final
 * page number/count are known, and re-wraps the line if the substituted text changed its width. */
function resolveSystemTokensForElement(
  pos: PositionedElement,
  pageNumber: number,
  pageCount: number,
): PositionedElement {
  if (!pos.resolvedText?.includes('{{system.')) return pos;

  const resolvedText = substituteSystemTokens(pos.resolvedText, pageNumber, pageCount);
  if (!pos.font) return { ...pos, resolvedText, lines: [resolvedText] };

  const lines = wrapText(resolvedText, pos.font.pdfFont, pos.fontSize, pos.width);
  return { ...pos, resolvedText, lines };
}

/** A watermark wider than the page diagonal at its configured font size is auto-scaled down to
 * fit, rather than clipped — the rotation means its effective footprint never exceeds the
 * diagonal regardless of angle, so the diagonal is a safe (if slightly conservative) bound
 * (PRD 10 §10.5). */
function scaledWatermarkFontSize(
  font: EmbeddedFont,
  watermark: NonNullable<RenderOptions['template']['watermark']>,
  geometry: PageGeometry,
): number {
  const diagonal = Math.sqrt(geometry.pageWidth ** 2 + geometry.pageHeight ** 2);
  const textWidth = font.pdfFont.widthOfTextAtSize(watermark.text, watermark.fontSize);
  if (textWidth <= diagonal) return watermark.fontSize;
  return watermark.fontSize * (diagonal / textWidth) * 0.95;
}

async function drawWatermark(
  page: PDFPage,
  geometry: PageGeometry,
  watermark: NonNullable<RenderOptions['template']['watermark']>,
  fontRegistry: FontRegistry,
): Promise<void> {
  if (!watermark.text) return;
  const font = await fontRegistry.getFallback();
  const fontSize = scaledWatermarkFontSize(font, watermark, geometry);
  const textWidth = font.pdfFont.widthOfTextAtSize(watermark.text, fontSize);

  page.drawText(watermark.text, {
    x: geometry.pageWidth / 2 - textWidth / 2,
    y: geometry.pageHeight / 2,
    size: fontSize,
    font: font.pdfFont,
    color: rgb(0.5, 0.5, 0.5),
    opacity: watermark.opacity,
    rotate: degrees(watermark.rotation),
  });
}

/**
 * The Draw stage of the Resolver -> Layout -> Draw pipeline: takes an already-paginated
 * `DocumentLayout` and renders it into a pdf-lib `PDFDocument`. Deliberately "dumb" — it only
 * draws what the layout stage already decided, except for `{{system.pageNumber}}`/`pageCount}}`
 * tokens, which can only be resolved here once the total page count is known (PRD 04 §4.2).
 */
export async function drawDocument(
  layout: DocumentLayout,
  geometry: PageGeometry,
  options: RenderOptions,
  fontRegistry: FontRegistry,
  pdfDoc: PDFDocument,
): Promise<void> {
  const pageCount = layout.pages.length;
  const assets: AssetMap = options.assets ?? {};
  const { template } = options;

  for (let i = 0; i < layout.pages.length; i += 1) {
    const pageNumber = i + 1;
    const page = pdfDoc.addPage([geometry.pageWidth, geometry.pageHeight]);

    if (template.page.background) {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: geometry.pageWidth,
        height: geometry.pageHeight,
        color: hexToRgb(template.page.background),
      });
    }

    if (layout.header && (pageNumber === 1 || layout.header.repeatOnEveryPage)) {
      for (const el of layout.header.elements) {
        await drawPositionedElement(
          pdfDoc,
          page,
          geometry.pageHeight,
          resolveSystemTokensForElement(el, pageNumber, pageCount),
          assets,
          fontRegistry,
        );
      }
    }

    if (layout.footer && (pageNumber === 1 || layout.footer.repeatOnEveryPage)) {
      for (const el of layout.footer.elements) {
        await drawPositionedElement(
          pdfDoc,
          page,
          geometry.pageHeight,
          resolveSystemTokensForElement(el, pageNumber, pageCount),
          assets,
          fontRegistry,
        );
      }
    }

    const pageLayout = layout.pages[i];
    if (!pageLayout) continue;

    for (const el of pageLayout.elements) {
      await drawPositionedElement(
        pdfDoc,
        page,
        geometry.pageHeight,
        resolveSystemTokensForElement(el, pageNumber, pageCount),
        assets,
        fontRegistry,
      );
    }
    for (const table of pageLayout.tables) {
      await drawTableChunk(page, geometry.pageHeight, table, template.theme, fontRegistry);
    }

    if (template.watermark?.enabled) {
      await drawWatermark(page, geometry, template.watermark, fontRegistry);
    }
  }
}
