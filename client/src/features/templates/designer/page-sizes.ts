import type { TemplateDocument } from '@platform/shared';

const NAMED_PAGE_SIZES: Record<'A4' | 'LETTER' | 'LEGAL', { width: number; height: number }> = {
  A4: { width: 595, height: 842 },
  LETTER: { width: 612, height: 792 },
  LEGAL: { width: 612, height: 1008 },
};

export function resolvePageSize(size: TemplateDocument['page']['size']): {
  width: number;
  height: number;
} {
  if (typeof size === 'string') return NAMED_PAGE_SIZES[size];
  return size;
}

/** The canvas renders 1 template point == 1 CSS pixel — close enough for design-time editing;
 * the real, pixel-perfect output is whatever the preview/render engine produces server-side. */
export const PT_TO_PX = 1;
