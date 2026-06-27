import type { PDFPage } from 'pdf-lib';
import type { Border } from '@platform/shared';

import { hexToRgb } from './colors';
import { toPdfBottomY } from './coordinates';

function dashArrayFor(style: Border['style']): number[] | undefined {
  if (style === 'dashed') return [4, 4];
  if (style === 'dotted') return [1, 2];
  return undefined;
}

export interface BoxGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Draws the generic `background`/`border` decoration shared by every element type. */
export function drawBoxDecorations(
  page: PDFPage,
  pageHeight: number,
  box: BoxGeometry,
  background: string | null | undefined,
  border: Border | undefined,
): void {
  if (!background && !border) return;
  if (box.width <= 0 || box.height <= 0) return;

  const bottomY = toPdfBottomY(pageHeight, box.y, box.height);

  page.drawRectangle({
    x: box.x,
    y: bottomY,
    width: box.width,
    height: box.height,
    color: background ? hexToRgb(background) : undefined,
    borderColor: border ? hexToRgb(border.color) : undefined,
    borderWidth: border?.width,
    borderDashArray: border ? dashArrayFor(border.style) : undefined,
  });
}
