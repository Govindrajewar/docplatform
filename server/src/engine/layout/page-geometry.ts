import type { TemplateDocument } from '@platform/shared';

const A4_SIZE = { width: 595.28, height: 841.89 };

const PAGE_SIZES_PT: Record<string, { width: number; height: number }> = {
  A4: A4_SIZE,
  LETTER: { width: 612, height: 792 },
  LEGAL: { width: 612, height: 1008 },
};

export interface PageGeometry {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  headerHeight: number;
  footerHeight: number;
  /** Usable width for body content (page width minus left/right margins). */
  contentWidth: number;
  /** Usable height for body content per page (excludes margins, header, footer). */
  bodyHeight: number;
}

export function resolvePageGeometry(template: TemplateDocument): PageGeometry {
  const { page } = template;
  const base_ = typeof page.size === 'string' ? (PAGE_SIZES_PT[page.size] ?? A4_SIZE) : page.size;

  const [pageWidth, pageHeight] =
    page.orientation === 'landscape'
      ? [Math.max(base_.width, base_.height), Math.min(base_.width, base_.height)]
      : [Math.min(base_.width, base_.height), Math.max(base_.width, base_.height)];

  const headerHeight = template.header?.height ?? 0;
  const footerHeight = template.footer?.height ?? 0;
  const contentWidth = pageWidth - page.marginLeft - page.marginRight;
  const bodyHeight = pageHeight - page.marginTop - page.marginBottom - headerHeight - footerHeight;

  if (contentWidth <= 0 || bodyHeight <= 0) {
    throw new Error('Page margins/header/footer leave no usable content area');
  }

  return {
    pageWidth,
    pageHeight,
    marginTop: page.marginTop,
    marginBottom: page.marginBottom,
    marginLeft: page.marginLeft,
    marginRight: page.marginRight,
    headerHeight,
    footerHeight,
    contentWidth,
    bodyHeight,
  };
}
