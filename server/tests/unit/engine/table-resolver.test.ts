import { describe, expect, it } from 'vitest';

import {
  InvalidTableDataError,
  resolveTable,
  TableRowLimitExceededError,
} from '../../../src/engine/resolver/table-resolver';
import { buildTable } from '../../helpers/template-fixtures';

describe('resolveTable', () => {
  it('formats each cell according to its column format', () => {
    const table = buildTable();
    const resolved = resolveTable(table, { items: [{ description: 'Widget', amount: 19.99 }] });

    expect(resolved.rows).toHaveLength(1);
    expect(resolved.rows[0]?.cells.description).toBe('Widget');
    expect(resolved.rows[0]?.cells.amount).toBe('$19.99');
  });

  it('returns an empty row list when the data source is missing entirely', () => {
    expect(resolveTable(buildTable(), {}).rows).toEqual([]);
    expect(resolveTable(buildTable(), { items: null }).rows).toEqual([]);
  });

  it('throws InvalidTableDataError when the data source resolves to a non-array', () => {
    expect(() => resolveTable(buildTable(), { items: 'not-an-array' })).toThrow(
      InvalidTableDataError,
    );
    expect(() => resolveTable(buildTable(), { items: { not: 'an array' } })).toThrow(
      InvalidTableDataError,
    );
  });

  it('accumulates a runningTotal column cumulatively across all rows, in data-source order', () => {
    const table = buildTable({
      columns: [
        { key: 'description', label: 'Description', width: 200 },
        { key: 'amount', label: 'Amount', width: 100, format: 'currency', runningTotal: true },
      ],
    });
    const resolved = resolveTable(table, {
      items: [
        { description: 'A', amount: 10 },
        { description: 'B', amount: 5 },
        { description: 'C', amount: -2 },
      ],
    });

    expect(resolved.rows.map((r) => r.cells.amount)).toEqual(['$10.00', '$15.00', '$13.00']);
  });

  it('sums grandTotals columns across the full dataset and exposes the first label', () => {
    const table = buildTable({ grandTotals: [{ columnKey: 'amount', label: 'Total' }] });
    const resolved = resolveTable(table, {
      items: [
        { description: 'A', amount: 10 },
        { description: 'B', amount: 5.5 },
      ],
    });

    expect(resolved.grandTotalsLabel).toBe('Total');
    expect(resolved.grandTotalsRow.amount).toBe('$15.50');
  });

  it('omits the grand-totals row entirely when there are no rows', () => {
    const table = buildTable({ grandTotals: [{ columnKey: 'amount', label: 'Total' }] });
    const resolved = resolveTable(table, { items: [] });

    expect(resolved.grandTotalsLabel).toBeNull();
    expect(resolved.grandTotalsRow).toEqual({});
  });

  it('treats a non-numeric raw value as 0 for running/grand totals without throwing', () => {
    const table = buildTable({
      columns: [
        { key: 'description', label: 'Description', width: 200 },
        { key: 'amount', label: 'Amount', width: 100, format: 'currency', runningTotal: true },
      ],
      grandTotals: [{ columnKey: 'amount', label: 'Total' }],
    });
    const resolved = resolveTable(table, {
      items: [
        { description: 'A', amount: 'oops' },
        { description: 'B', amount: 5 },
      ],
    });

    expect(resolved.rows.map((r) => r.cells.amount)).toEqual(['$0.00', '$5.00']);
    expect(resolved.grandTotalsRow.amount).toBe('$5.00');
  });

  it('accepts a dataset within the maxRows ceiling', () => {
    const table = buildTable();
    const resolved = resolveTable(table, { items: [{ amount: 10 }, { amount: 20 }] }, 2);
    expect(resolved.rows).toHaveLength(2);
  });

  it('rejects (rather than silently truncating) a dataset exceeding maxRows, naming the actual count', () => {
    const table = buildTable();
    expect(() =>
      resolveTable(table, { items: [{ amount: 10 }, { amount: 20 }, { amount: 30 }] }, 2),
    ).toThrow(TableRowLimitExceededError);
    try {
      resolveTable(table, { items: [{ amount: 10 }, { amount: 20 }, { amount: 30 }] }, 2);
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).toContain('3');
      expect((err as Error).message).toContain('2');
    }
  });

  it('applies a default 50,000-row ceiling when maxRows is not specified', () => {
    const table = buildTable();
    const tooMany = Array.from({ length: 50_001 }, (_, i) => ({ amount: i }));
    expect(() => resolveTable(table, { items: tooMany })).toThrow(TableRowLimitExceededError);
  });
});
