import type { PDFPage } from 'pdf-lib';

import { splitByCoverage, type EmbeddedFont } from '../fonts/font-registry';
import { lineHeightFor } from '../layout/text-measure';

import { hexToRgb } from './colors';
import { toPdfBottomY } from './coordinates';

/** Baseline distance from the top of a line box, as a fraction of font size — a standard
 * approximation since pdf-lib doesn't expose per-font ascent metrics directly. */
const ASCENT_RATIO = 0.8;

export interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Draws pre-wrapped lines with horizontal/vertical alignment and font-fallback glyph coverage. */
export function drawTextLines(
  page: PDFPage,
  pageHeight: number,
  box: TextBox,
  lines: string[],
  font: EmbeddedFont,
  fallback: EmbeddedFont,
  fontSize: number,
  align: 'left' | 'center' | 'right' | 'justify',
  verticalAlign: 'top' | 'middle' | 'bottom',
  color: string | undefined,
  explicitLineHeight?: number,
): void {
  const visibleLines = lines.filter((line) => line.length > 0 || lines.length === 1);
  if (visibleLines.length === 0) return;

  const lh = lineHeightFor(fontSize, explicitLineHeight);
  const blockHeight = visibleLines.length * lh;

  let startTop = box.y;
  if (verticalAlign === 'middle') startTop = box.y + Math.max(box.height - blockHeight, 0) / 2;
  else if (verticalAlign === 'bottom') startTop = box.y + Math.max(box.height - blockHeight, 0);

  const rgbColor = color ? hexToRgb(color) : undefined;

  visibleLines.forEach((line, idx) => {
    if (line.length === 0) return;

    const lineTop = startTop + idx * lh;
    const baselinePdfY = pageHeight - lineTop - fontSize * ASCENT_RATIO;
    const runs = splitByCoverage(line, font, fallback);
    const lineWidth = runs.reduce(
      (sum, run) => sum + run.font.pdfFont.widthOfTextAtSize(run.text, fontSize),
      0,
    );

    let startX = box.x;
    // Justify isn't implemented (no inter-word stretching) and falls back to left alignment —
    // an accepted Phase 3 limitation.
    if (align === 'center') startX = box.x + Math.max(box.width - lineWidth, 0) / 2;
    else if (align === 'right') startX = box.x + Math.max(box.width - lineWidth, 0);

    let cursorX = startX;
    for (const run of runs) {
      page.drawText(run.text, {
        x: cursorX,
        y: baselinePdfY,
        size: fontSize,
        font: run.font.pdfFont,
        color: rgbColor,
      });
      cursorX += run.font.pdfFont.widthOfTextAtSize(run.text, fontSize);
    }
  });
}

export function drawBackgroundFor(
  page: PDFPage,
  pageHeight: number,
  box: TextBox,
  color: string,
): void {
  const bottomY = toPdfBottomY(pageHeight, box.y, box.height);
  page.drawRectangle({
    x: box.x,
    y: bottomY,
    width: box.width,
    height: box.height,
    color: hexToRgb(color),
  });
}
