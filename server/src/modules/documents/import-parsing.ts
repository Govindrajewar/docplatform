import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import type { FieldDefinition } from '@platform/shared';

import { AppError } from '../../utils/app-error';

export interface ParsedImport {
  columns: string[];
  rows: Record<string, string>[];
}

function parseCsvFile(buffer: Buffer): ParsedImport {
  const records = parseCsv(buffer.toString('utf-8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  const columns = records.length > 0 ? Object.keys(records[0] as object) : [];
  return { columns, rows: records };
}

/** Header extraction fills a blank header cell with the value to its left, approximating
 * "merged cells flatten to the top-left value repeated" (PRD 10 §10.6) without needing
 * ExcelJS's merge-range bookkeeping for the common horizontally-merged-header case. */
async function parseXlsxFile(buffer: Buffer): Promise<ParsedImport> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled types resolve `Buffer` against a much older nested `@types/node` (pulled
  // in transitively via @fast-csv), which TS treats as structurally distinct from the project's
  // own `Buffer` — casting to whatever `load` actually declares sidesteps the naming clash
  // (Buffer is Buffer at runtime either way).
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError('VALIDATION_ERROR', 'The workbook has no sheets');

  const headerRow = sheet.getRow(1);
  const columns: string[] = [];
  let lastHeader = '';
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    const value = cell.value == null ? '' : String(cell.value).trim();
    lastHeader = value || lastHeader;
    columns.push(lastHeader);
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      record[column] = cell.value == null ? '' : String(cell.value);
    });
    rows.push(record);
  });

  return { columns, rows };
}

function parseJsonFile(buffer: Buffer): ParsedImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer.toString('utf-8'));
  } catch {
    throw new AppError('VALIDATION_ERROR', 'The file is not valid JSON');
  }

  // A single object is treated as "generate one document" (PRD 10 §10.6).
  const records = Array.isArray(parsed) ? parsed : [parsed];
  if (!records.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
    throw new AppError(
      'VALIDATION_ERROR',
      'JSON import must be an array of objects (or a single object)',
    );
  }

  const rows = records as Record<string, string>[];
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return { columns, rows };
}

export async function parseImportFile(buffer: Buffer, filename: string): Promise<ParsedImport> {
  const extension = filename.toLowerCase().split('.').pop() ?? '';

  if (extension === 'csv') return parseCsvFile(buffer);
  if (extension === 'xlsx' || extension === 'xls') return parseXlsxFile(buffer);
  if (extension === 'json') return parseJsonFile(buffer);

  throw new AppError('VALIDATION_ERROR', 'Unsupported file type — expected .csv, .xlsx, or .json');
}

const HEADER_SYNONYMS: Record<string, string> = {
  acctno: 'accountnumber',
  amt: 'amount',
  qty: 'quantity',
  desc: 'description',
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

/** Auto-maps source columns to template fields by normalized header/label/key match plus a
 * small synonym table (PRD 06 §6.3) — a starting suggestion the user confirms/edits, never the
 * final mapping applied silently. */
export function suggestColumnMapping(
  columns: string[],
  fields: readonly FieldDefinition[],
): Record<string, string | null> {
  const candidates = columns.map((column) => ({ column, norm: normalize(column) }));

  const mapping: Record<string, string | null> = {};
  for (const field of fields) {
    const leafKey = field.key.split('.').pop() ?? field.key;
    const targets = new Set([normalize(field.label), normalize(leafKey)]);

    const match = candidates.find((candidate) => {
      const resolved = HEADER_SYNONYMS[candidate.norm] ?? candidate.norm;
      return targets.has(candidate.norm) || targets.has(resolved);
    });
    mapping[field.key] = match?.column ?? null;
  }
  return mapping;
}
