import type { PDFFont } from 'pdf-lib';
import type { TemplateElement } from '@platform/shared';

import { measureWrappedHeight, wrapText } from './text-measure';

const TEXT_LIKE_TYPES = new Set(['text', 'staticText', 'dynamicField', 'date', 'currency']);

export function isTextLike(element: TemplateElement): boolean {
  return TEXT_LIKE_TYPES.has(element.type);
}

export interface TextLayoutResult {
  lines: string[];
  height: number;
}

/** Wraps a text-like element's resolved string and measures the resulting block height. */
export function layoutTextBlock(
  resolvedText: string,
  font: PDFFont,
  fontSize: number,
  width: number,
  options: { lineHeight?: number; maxLines?: number } = {},
): TextLayoutResult {
  let lines = wrapText(resolvedText, font, fontSize, width);
  if (options.maxLines && lines.length > options.maxLines) {
    lines = lines.slice(0, options.maxLines);
  }
  return { lines, height: measureWrappedHeight(lines.length, fontSize, options.lineHeight) };
}

/** Resolves the width an element occupies, given the space remaining in its container. */
export function resolveElementWidth(element: TemplateElement, containerWidth: number): number {
  if (typeof element.width === 'number') return element.width;
  return Math.max(containerWidth - element.x, 0);
}

/**
 * Resolves an element's box height for layout purposes. Text-like elements declared with
 * `height: 'auto'` (or no height at all) use `measuredTextHeight` from {@link layoutTextBlock};
 * every other element type either has an explicit height or a height derivable from its own
 * geometry (circle radius, barcode/qrcode size, line/divider thickness). `image`, `signature`,
 * and `rectangle` have no derivable natural height and must declare one explicitly — they
 * resolve to 0 here, which the caller treats as "occupies no vertical flow space."
 */
export function resolveElementHeight(
  element: TemplateElement,
  measuredTextHeight?: number,
): number {
  if (element.height !== undefined && element.height !== 'auto') return element.height;

  switch (element.type) {
    case 'text':
    case 'staticText':
    case 'dynamicField':
    case 'date':
    case 'currency':
      return measuredTextHeight ?? (element.fontSize ?? 10) * 1.2;
    case 'checkbox':
      return (element.fontSize ?? 10) * 1.2;
    case 'circle':
      return element.radius * 2;
    case 'qrcode':
    case 'barcode':
      return element.size;
    case 'divider':
    case 'line':
      return element.thickness;
    case 'table':
      return 0;
    case 'image':
    case 'signature':
    case 'rectangle':
    default:
      return 0;
  }
}
