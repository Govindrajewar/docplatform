import { describe, expect, it } from 'vitest';

import {
  minViableTableHeight,
  paginateTableRows,
} from '../../../src/engine/layout/table-paginator';
import type { ResolvedTableRow } from '../../../src/engine/types';
import { buildTable } from '../../helpers/template-fixtures';

function rows(n: number): ResolvedTableRow[] {
  return Array.from({ length: n }, (_, i) => ({ cells: { description: `Row ${i}` }, raw: { i } }));
}

describe('minViableTableHeight', () => {
  it('is the header row plus one content row, regardless of total row count', () => {
    const table = buildTable({ rowHeight: 20 });
    expect(minViableTableHeight(table, 0)).toBe(40);
    expect(minViableTableHeight(table, 100)).toBe(40);
  });
});

describe('paginateTableRows', () => {
  it('produces a single empty-state chunk when there are no rows', () => {
    const table = buildTable({ rowHeight: 20 });
    const chunks = paginateTableRows(table, [], 500, 500);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ isEmptyState: true, includesHeader: true, rows: [] });
    expect(chunks[0]?.height).toBe(40);
  });

  it('fits every row in a single chunk when there is enough space', () => {
    const table = buildTable({ rowHeight: 20 });
    const chunks = paginateTableRows(table, rows(5), 500, 500);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.rows).toHaveLength(5);
    expect(chunks[0]?.includesHeader).toBe(true);
    expect(chunks[0]?.includesGrandTotals).toBe(false);
  });

  it('reserves space for the grand-totals row on the chunk that ends up being last', () => {
    const table = buildTable({
      rowHeight: 20,
      grandTotals: [{ columnKey: 'amount', label: 'Total' }],
    });
    // header(20) + 5 rows(100) + totals(20) = 140, comfortably under 500.
    const chunks = paginateTableRows(table, rows(5), 500, 500);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.includesGrandTotals).toBe(true);
    expect(chunks[0]?.height).toBe(20 + 5 * 20 + 20);
  });

  it('splits across pages when rows do not fit in the first page available height', () => {
    const table = buildTable({
      rowHeight: 20,
      grandTotals: [{ columnKey: 'amount', label: 'Total' }],
    });
    // First page: header(20) leaves 80 for rows -> 4 rows fit without totals (need 5th to trigger split).
    const chunks = paginateTableRows(table, rows(10), 100, 300);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.includesGrandTotals).toBe(false);
    const totalRowsAcrossChunks = chunks.reduce((sum, c) => sum + c.rows.length, 0);
    expect(totalRowsAcrossChunks).toBe(10);
    expect(chunks[chunks.length - 1]?.includesGrandTotals).toBe(true);
  });

  it('repeats the header on every chunk by default', () => {
    const table = buildTable({ rowHeight: 20 });
    const chunks = paginateTableRows(table, rows(10), 60, 60);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.includesHeader)).toBe(true);
  });

  it('only includes the header on the first chunk when repeatHeaderOnEveryPage is false', () => {
    const table = buildTable({ rowHeight: 20, repeatHeaderOnEveryPage: false });
    const chunks = paginateTableRows(table, rows(10), 60, 60);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.includesHeader).toBe(true);
    expect(chunks.slice(1).every((c) => !c.includesHeader)).toBe(true);
  });

  it('caps rows per chunk at maxRowsPerPage even when more vertical space is available', () => {
    const table = buildTable({ rowHeight: 20, maxRowsPerPage: 3 });
    const chunks = paginateTableRows(table, rows(10), 1000, 1000);

    expect(chunks.every((c) => c.rows.length <= 3)).toBe(true);
    const totalRowsAcrossChunks = chunks.reduce((sum, c) => sum + c.rows.length, 0);
    expect(totalRowsAcrossChunks).toBe(10);
  });

  it('forces exactly one row through per chunk rather than looping forever when the page is too short', () => {
    const table = buildTable({ rowHeight: 20 });
    const chunks = paginateTableRows(table, rows(3), 1, 1);

    expect(chunks.every((c) => c.rows.length === 1)).toBe(true);
    expect(chunks).toHaveLength(3);
  });

  it('produces a trailing totals-only chunk when grand totals could not fit alongside the last rows', () => {
    const table = buildTable({
      rowHeight: 20,
      grandTotals: [{ columnKey: 'amount', label: 'Total' }],
    });
    // Exactly enough room for header + 5 rows, none left over for totals.
    const chunks = paginateTableRows(table, rows(5), 120, 120);

    const last = chunks[chunks.length - 1];
    expect(last?.includesGrandTotals).toBe(true);
    if (chunks.length > 1) {
      expect(last?.rows).toHaveLength(0);
    }
  });
});
