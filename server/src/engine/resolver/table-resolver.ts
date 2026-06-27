import type { TableColumn, TableElement } from '@platform/shared';

import type { DataContext, ResolvedTableRow } from '../types';

import { formatValue, getByPath } from './tokens';

export interface ResolvedTable {
  rows: ResolvedTableRow[];
  /** Formatted grand-totals row, keyed by column key — empty if `table.grandTotals` is empty or there are no rows. */
  grandTotalsRow: Record<string, string>;
  /** Set on the first table column when a grand-totals label should be shown there (see convention note below). */
  grandTotalsLabel: string | null;
}

/** Default hard ceiling on a single table's row count — see PRD 10 §10.4 (100k-row request case). */
export const DEFAULT_MAX_TABLE_ROWS = 50_000;

/** `dataSource` resolved to something other than an array/undefined/null — PRD 10 §10.4 calls
 * for a clear render-time failure here rather than silently coercing to an empty table. */
export class InvalidTableDataError extends Error {
  constructor(dataSource: string, actualType: string) {
    super(
      `Table dataSource "${dataSource}" must resolve to an array, but resolved to ${actualType}`,
    );
  }
}

export class TableRowLimitExceededError extends Error {
  constructor(dataSource: string, actualCount: number, max: number) {
    super(
      `Table dataSource "${dataSource}" has ${actualCount} rows, exceeding the maximum of ${max}`,
    );
  }
}

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Resolves a table's data source against the full data context: formats every cell, accumulates
 * `runningTotal` columns cumulatively across *all* rows (in data-source order, independent of how
 * the layout engine later paginates them), and sums `grandTotals` columns across all rows.
 *
 * Convention for rendering the grand-totals row (PRD 04 §4.5 leaves the exact cell layout
 * unspecified): the *first* `grandTotals` entry's `label` is displayed in the table's first
 * column, and each entry's own `columnKey` cell shows that column's formatted sum. This matches
 * the common "Total | | 1,234.56" layout from the PRD's statement examples.
 */
export function resolveTable(
  table: TableElement,
  context: DataContext,
  maxRows: number = DEFAULT_MAX_TABLE_ROWS,
): ResolvedTable {
  const rawRows = getByPath(context, table.dataSource);
  if (rawRows !== undefined && rawRows !== null && !Array.isArray(rawRows)) {
    throw new InvalidTableDataError(table.dataSource, typeof rawRows);
  }

  const allRows = Array.isArray(rawRows) ? (rawRows as Record<string, unknown>[]) : [];
  if (allRows.length > maxRows) {
    throw new TableRowLimitExceededError(table.dataSource, allRows.length, maxRows);
  }
  const dataRows = allRows;

  const runningSums = new Map<string, number>();
  const grandSums = new Map<string, number>();
  const columnsByKey = new Map<string, TableColumn>(table.columns.map((col) => [col.key, col]));
  const grandTotalKeys = new Set(table.grandTotals.map((entry) => entry.columnKey));

  const rows: ResolvedTableRow[] = dataRows.map((raw) => {
    const cells: Record<string, string> = {};

    for (const column of table.columns) {
      const rawValue = getByPath(raw, column.key);

      if (grandTotalKeys.has(column.key)) {
        grandSums.set(column.key, (grandSums.get(column.key) ?? 0) + toNumber(rawValue));
      }

      if (column.runningTotal) {
        const next = (runningSums.get(column.key) ?? 0) + toNumber(rawValue);
        runningSums.set(column.key, next);
        cells[column.key] = formatValue(next, column.format, column.formatOptions);
      } else {
        cells[column.key] = formatValue(rawValue, column.format, column.formatOptions);
      }
    }

    return { cells, raw };
  });

  const grandTotalsRow: Record<string, string> = {};
  let grandTotalsLabel: string | null = null;

  if (table.grandTotals.length > 0 && rows.length > 0) {
    grandTotalsLabel = table.grandTotals[0]?.label ?? null;
    for (const entry of table.grandTotals) {
      const column = columnsByKey.get(entry.columnKey);
      const sum = grandSums.get(entry.columnKey) ?? 0;
      grandTotalsRow[entry.columnKey] = formatValue(
        sum,
        column?.format ?? 'number',
        column?.formatOptions,
      );
    }
  }

  return { rows, grandTotalsRow, grandTotalsLabel };
}
