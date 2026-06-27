import type { TableElement, TemplateElement } from '@platform/shared';

import { FontRegistry } from '../fonts/font-registry';
import { evaluateVisibleIf } from '../resolver/expression';
import { RequiredFieldsMissingError } from '../resolver/field-resolver';
import { resolveTable } from '../resolver/table-resolver';
import type { RenderOptions } from '../types';

import { resolveElementWidth } from './element-box';
import { resolvePageGeometry, type PageGeometry } from './page-geometry';
import { layoutElements, type LayoutElementsResult } from './section-layout';
import { minViableTableHeight, paginateTableRows } from './table-paginator';
import type { DocumentLayout, HeaderFooterLayout, PageLayout } from './types';

const DEFAULT_MAX_PAGES = 500;

function isTableElement(element: TemplateElement): element is TableElement {
  return element.type === 'table';
}

async function layoutHeaderFooter(
  tree: { height: number; elements: TemplateElement[]; repeatOnEveryPage: boolean } | undefined,
  options: RenderOptions,
  fontRegistry: FontRegistry,
  geometry: PageGeometry,
  top: number,
  missingFields: Set<string>,
): Promise<HeaderFooterLayout | undefined> {
  if (!tree) return undefined;
  const { elements } = await layoutElements(
    tree.elements,
    options.data,
    options.template,
    fontRegistry,
    geometry.contentWidth,
    geometry.marginLeft,
    top,
    missingFields,
  );
  return { elements, top, height: tree.height, repeatOnEveryPage: tree.repeatOnEveryPage };
}

/**
 * Walks the template's sections top-to-bottom and assigns every element (and every table row
 * chunk) an absolute page-space position, splitting across as many pages as needed. This is the
 * Layout stage of the Resolver -> Layout -> Draw pipeline (PRD 04 §4.2): nothing here touches
 * pdf-lib directly, so it can be unit-tested independent of PDF generation.
 *
 * Pagination model: only `table` elements can split across pages. A section with no table is
 * always kept together — if it doesn't fit in the remaining space on the current page, the
 * whole section moves to a fresh page (this also means `section.keepTogether` is implicitly
 * always true for non-table sections; there is no element-level splitting). A section containing
 * a table renders any other elements in that section once, on the page where the table starts,
 * and they are expected to sit above the table (`y < table.y`) — elements positioned below the
 * table within the same section are not supported.
 */
export async function paginateDocument(
  options: RenderOptions,
  fontRegistry: FontRegistry,
): Promise<DocumentLayout> {
  const { template, data } = options;
  const geometry = resolvePageGeometry(template);
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const bodyTop = geometry.marginTop + geometry.headerHeight;

  const missingFields = new Set<string>();

  const header = await layoutHeaderFooter(
    template.header,
    options,
    fontRegistry,
    geometry,
    geometry.marginTop,
    missingFields,
  );
  const footer = await layoutHeaderFooter(
    template.footer,
    options,
    fontRegistry,
    geometry,
    geometry.pageHeight - geometry.marginBottom - (template.footer?.height ?? 0),
    missingFields,
  );

  const pages: PageLayout[] = [{ elements: [], tables: [] }];
  let cursorY = 0;

  const ensureNewPage = (): void => {
    if (pages.length >= maxPages) {
      throw new Error(`Rendering exceeded the maximum page count (${maxPages})`);
    }
    pages.push({ elements: [], tables: [] });
    cursorY = 0;
  };

  const currentPage = (): PageLayout => {
    const page = pages[pages.length - 1];
    if (!page) throw new Error('Internal layout error: no current page');
    return page;
  };

  const layoutAt = (elements: TemplateElement[], offsetY: number): Promise<LayoutElementsResult> =>
    layoutElements(
      elements,
      data,
      template,
      fontRegistry,
      geometry.contentWidth,
      geometry.marginLeft,
      bodyTop + offsetY,
      missingFields,
    );

  for (const section of template.sections) {
    if (section.visibleIf && !evaluateVisibleIf(section.visibleIf, data)) continue;
    if (section.pageBreakBefore && cursorY > 0) ensureNewPage();

    const tableElement = section.elements.find(isTableElement);
    const otherElements = section.elements.filter((el) => !isTableElement(el));

    if (!tableElement) {
      let layout = await layoutAt(otherElements, cursorY);

      if (cursorY > 0 && cursorY + layout.naturalHeight > geometry.bodyHeight) {
        ensureNewPage();
        layout = await layoutAt(otherElements, cursorY);
      }

      currentPage().elements.push(...layout.elements);
      cursorY += layout.naturalHeight;
      continue;
    }

    const resolvedTable = resolveTable(tableElement, data, options.maxTableRows);
    let beforeLayout = await layoutAt(otherElements, cursorY);
    let tableStartOffset = Math.max(tableElement.y, beforeLayout.naturalHeight);
    const minViable = minViableTableHeight(tableElement, resolvedTable.rows.length);

    if (cursorY > 0 && cursorY + tableStartOffset + minViable > geometry.bodyHeight) {
      ensureNewPage();
      beforeLayout = await layoutAt(otherElements, cursorY);
      tableStartOffset = Math.max(tableElement.y, beforeLayout.naturalHeight);
    }

    currentPage().elements.push(...beforeLayout.elements);

    const tableWidth = resolveElementWidth(tableElement, geometry.contentWidth);
    const firstPageAvailable = geometry.bodyHeight - (cursorY + tableStartOffset);
    const chunks = paginateTableRows(
      tableElement,
      resolvedTable.rows,
      firstPageAvailable,
      geometry.bodyHeight,
    );

    chunks.forEach((chunk, idx) => {
      const yOffset = idx === 0 ? cursorY + tableStartOffset : 0;

      currentPage().tables.push({
        element: tableElement,
        chunk,
        grandTotalsRow: resolvedTable.grandTotalsRow,
        grandTotalsLabel: resolvedTable.grandTotalsLabel,
        x: geometry.marginLeft + tableElement.x,
        y: bodyTop + yOffset,
        width: tableWidth,
      });

      cursorY = yOffset + chunk.height;
      if (idx < chunks.length - 1) ensureNewPage();
    });
  }

  if (missingFields.size > 0) {
    throw new RequiredFieldsMissingError(Array.from(missingFields));
  }

  return { pages, header, footer };
}

export { resolvePageGeometry };
export type { PageGeometry };
