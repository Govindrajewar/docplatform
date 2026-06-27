import type { TableElement, TemplateElement } from '@platform/shared';

import type { EmbeddedFont } from '../fonts/font-registry';
import type { ResolvedTableRow } from '../types';

import type { TableChunk } from './table-paginator';

export interface PositionedElement {
  element: TemplateElement;
  /** Resolved/formatted display text for text-like elements, or resolved `src`/`value` for asset-referencing elements. */
  resolvedText?: string;
  /** Pre-wrapped lines for text-like elements (empty for everything else). */
  lines: string[];
  font?: EmbeddedFont;
  fontSize: number;
  checkboxState?: boolean;
  /** Absolute page-space coordinates, top-down from the page's top-left corner (pt). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedTable {
  element: TableElement;
  chunk: TableChunk;
  grandTotalsRow: Record<string, string>;
  grandTotalsLabel: string | null;
  x: number;
  y: number;
  width: number;
}

export interface PageLayout {
  elements: PositionedElement[];
  tables: PositionedTable[];
}

export interface HeaderFooterLayout {
  elements: PositionedElement[];
  /** Absolute page-space top-down y where this header/footer box begins. */
  top: number;
  height: number;
  repeatOnEveryPage: boolean;
}

export interface DocumentLayout {
  pages: PageLayout[];
  header?: HeaderFooterLayout;
  footer?: HeaderFooterLayout;
}

export type { ResolvedTableRow };
