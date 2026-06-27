import type { TableElement } from '@platform/shared';

import type { ResolvedTableRow } from '../types';

export interface TableChunk {
  /** Data rows rendered in this chunk — empty for an empty-state chunk or a trailing totals-only chunk. */
  rows: ResolvedTableRow[];
  /** Index of `rows[0]` within the table's full resolved row list (for stable keys/debugging). */
  startIndex: number;
  includesHeader: boolean;
  includesGrandTotals: boolean;
  isEmptyState: boolean;
  height: number;
}

/** Minimum vertical space a table needs to *start* on a page: its header row plus at least one
 * content row (or the empty-state row, if there are no rows at all). Below this, the caller
 * should push the whole table to a fresh page rather than starting it here. */
export function minViableTableHeight(table: TableElement, totalRowCount: number): number {
  const headerHeight = table.rowHeight;
  const firstRowHeight = totalRowCount > 0 ? table.rowHeight : table.rowHeight;
  return headerHeight + firstRowHeight;
}

/**
 * Splits a table's resolved rows across pages. `firstPageAvailableHeight` is however much
 * vertical space remains on the page where the table starts (which may be less than a full
 * page, since other elements in the same section can precede it); every subsequent page gets
 * `fullPageAvailableHeight`. The header row repeats on every chunk when
 * `table.repeatHeaderOnEveryPage` is set; the grand-totals row (if any) is only ever attached to
 * the final chunk, reserving space for it ahead of time so it never gets stranded on its own page
 * unnecessarily — see PRD 04 §4.5 / 10 §10.4.
 */
export function paginateTableRows(
  table: TableElement,
  rows: ResolvedTableRow[],
  firstPageAvailableHeight: number,
  fullPageAvailableHeight: number,
): TableChunk[] {
  const headerRowHeight = table.rowHeight;
  const grandTotalsHeight = table.grandTotals.length > 0 ? table.rowHeight : 0;

  if (rows.length === 0) {
    const includesHeader = true;
    const height = headerRowHeight + table.rowHeight;
    return [
      {
        rows: [],
        startIndex: 0,
        includesHeader,
        includesGrandTotals: false,
        isEmptyState: true,
        height,
      },
    ];
  }

  const chunks: TableChunk[] = [];
  let rowIndex = 0;
  let chunkIndex = 0;

  while (rowIndex < rows.length) {
    const isFirstChunk = chunkIndex === 0;
    const availableHeight = isFirstChunk ? firstPageAvailableHeight : fullPageAvailableHeight;
    const includesHeader = isFirstChunk || table.repeatHeaderOnEveryPage;
    const usable = Math.max(availableHeight - (includesHeader ? headerRowHeight : 0), 0);

    const remaining = rows.length - rowIndex;
    const capWithTotals = Math.floor((usable - grandTotalsHeight) / table.rowHeight);
    const capWithoutTotals = Math.floor(usable / table.rowHeight);

    const cappedRemaining = table.maxRowsPerPage
      ? Math.min(remaining, table.maxRowsPerPage)
      : remaining;

    let rowsThisChunk: number;
    let includesGrandTotals: boolean;

    if (cappedRemaining <= Math.max(capWithTotals, 0)) {
      rowsThisChunk = cappedRemaining;
      includesGrandTotals = grandTotalsHeight > 0;
    } else {
      rowsThisChunk = Math.max(capWithoutTotals, 0);
      if (table.maxRowsPerPage) rowsThisChunk = Math.min(rowsThisChunk, table.maxRowsPerPage);
      includesGrandTotals = false;
    }

    // Pathological case: not even one row fits in the available height (e.g. a very short page).
    // Force exactly one row through rather than looping forever; it will visually overflow.
    if (rowsThisChunk === 0) rowsThisChunk = 1;

    const chunkRows = rows.slice(rowIndex, rowIndex + rowsThisChunk);
    const height =
      (includesHeader ? headerRowHeight : 0) +
      chunkRows.length * table.rowHeight +
      (includesGrandTotals ? grandTotalsHeight : 0);

    chunks.push({
      rows: chunkRows,
      startIndex: rowIndex,
      includesHeader,
      includesGrandTotals,
      isEmptyState: false,
      height,
    });

    rowIndex += rowsThisChunk;
    chunkIndex += 1;
  }

  const last = chunks[chunks.length - 1];
  if (grandTotalsHeight > 0 && last && !last.includesGrandTotals) {
    chunks.push({
      rows: [],
      startIndex: rows.length,
      includesHeader: table.repeatHeaderOnEveryPage,
      includesGrandTotals: true,
      isEmptyState: false,
      height: (table.repeatHeaderOnEveryPage ? headerRowHeight : 0) + grandTotalsHeight,
    });
  }

  return chunks;
}
