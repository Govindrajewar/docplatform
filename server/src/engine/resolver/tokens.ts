import type { FormatOptions, FormatType } from '@platform/shared';

import type { DataContext } from '../types';

const TOKEN_PATTERN = /\{\{([\w.]+)\}\}/g;

export function getByPath(context: DataContext, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc === null || acc === undefined || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, context);
}

/**
 * Substitutes every `{{path}}` token against the data context. Tokens under `system.*`
 * (page number/count) are left untouched — they're only resolvable once pagination is known,
 * during the draw pass. See PRD 04 §4.7 / 02 §2.5.
 */
export function substituteTokens(template: string, context: DataContext): string {
  return template.replace(TOKEN_PATTERN, (match, path: string) => {
    if (path.startsWith('system.')) return match;
    const value = getByPath(context, path);
    return value === null || value === undefined ? '' : String(value);
  });
}

/** Resolves remaining `{{system.*}}` placeholders once the page plan is finalized. */
export function substituteSystemTokens(
  text: string,
  pageNumber: number,
  pageCount: number,
): string {
  return text
    .replace(/\{\{system\.pageNumber\}\}/g, String(pageNumber))
    .replace(/\{\{system\.pageCount\}\}/g, String(pageCount));
}

/**
 * Formats using UTC getters, not local-timezone ones — a date-only value like `"2026-06-27"`
 * parses to UTC midnight, and reading it back with local getters can shift the displayed day by
 * one depending on the server's timezone (e.g. anything west of UTC). Statement dates must be
 * exact regardless of where the rendering server happens to run.
 */
function formatDate(value: Date, pattern: string): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const replacements: Record<string, string> = {
    YYYY: String(value.getUTCFullYear()),
    MM: pad(value.getUTCMonth() + 1),
    DD: pad(value.getUTCDate()),
    HH: pad(value.getUTCHours()),
    mm: pad(value.getUTCMinutes()),
    ss: pad(value.getUTCSeconds()),
  };
  return Object.entries(replacements).reduce(
    (acc, [token, replacement]) => acc.replace(token, replacement),
    pattern,
  );
}

/** Renders a resolved value through its declared formatter — see PRD 04 §4.4 / §4.5. */
export function formatValue(
  value: unknown,
  format: FormatType | string,
  options: FormatOptions & { pattern?: string } = {},
): string {
  if (value === null || value === undefined || value === '') return '';

  switch (format) {
    case 'number': {
      const num = Number(value);
      if (Number.isNaN(num)) return String(value);
      return new Intl.NumberFormat(options.locale ?? 'en-US', {
        minimumFractionDigits: options.decimalPlaces ?? 0,
        maximumFractionDigits: options.decimalPlaces ?? 2,
      }).format(num);
    }
    case 'currency': {
      const num = Number(value);
      if (Number.isNaN(num)) return String(value);
      return new Intl.NumberFormat(options.locale ?? 'en-US', {
        style: 'currency',
        currency: options.currencyCode ?? 'USD',
        minimumFractionDigits: options.decimalPlaces ?? 2,
        maximumFractionDigits: options.decimalPlaces ?? 2,
      }).format(num);
    }
    case 'percentage': {
      const num = Number(value);
      if (Number.isNaN(num)) return String(value);
      return `${num.toFixed(options.decimalPlaces ?? 0)}%`;
    }
    case 'date': {
      const date = value instanceof Date ? value : new Date(value as string);
      if (Number.isNaN(date.getTime())) return String(value);
      return formatDate(date, options.pattern ?? 'YYYY-MM-DD');
    }
    default:
      return String(value);
  }
}
