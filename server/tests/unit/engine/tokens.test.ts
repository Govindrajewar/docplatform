import { describe, expect, it } from 'vitest';

import {
  formatValue,
  getByPath,
  substituteSystemTokens,
  substituteTokens,
} from '../../../src/engine/resolver/tokens';

describe('getByPath', () => {
  it('resolves a nested dot path', () => {
    expect(getByPath({ customer: { name: 'Jane' } }, 'customer.name')).toBe('Jane');
  });

  it('returns undefined for a missing path', () => {
    expect(getByPath({ customer: {} }, 'customer.name')).toBeUndefined();
  });

  it('returns undefined when traversing through a non-object', () => {
    expect(getByPath({ customer: null }, 'customer.name')).toBeUndefined();
    expect(getByPath({ customer: 'Jane' }, 'customer.name')).toBeUndefined();
  });
});

describe('substituteTokens', () => {
  it('replaces a token with its resolved value', () => {
    expect(substituteTokens('Hello {{customer.name}}', { customer: { name: 'Jane' } })).toBe(
      'Hello Jane',
    );
  });

  it('replaces an unresolvable token with an empty string', () => {
    expect(substituteTokens('Hello {{customer.name}}', {})).toBe('Hello ');
  });

  it('leaves system.* tokens untouched for the draw pass to resolve later', () => {
    expect(substituteTokens('Page {{system.pageNumber}}', {})).toBe('Page {{system.pageNumber}}');
  });

  it('replaces multiple tokens in one string', () => {
    expect(substituteTokens('{{a}}-{{b}}', { a: '1', b: '2' })).toBe('1-2');
  });
});

describe('substituteSystemTokens', () => {
  it('resolves pageNumber and pageCount', () => {
    expect(substituteSystemTokens('Page {{system.pageNumber}} of {{system.pageCount}}', 2, 5)).toBe(
      'Page 2 of 5',
    );
  });
});

describe('formatValue', () => {
  it('returns an empty string for null/undefined/empty values', () => {
    expect(formatValue(null, 'text')).toBe('');
    expect(formatValue(undefined, 'text')).toBe('');
    expect(formatValue('', 'text')).toBe('');
  });

  it('formats numbers with default and explicit decimal places', () => {
    expect(formatValue(1234.5, 'number')).toBe('1,234.5');
    expect(formatValue(1234.5, 'number', { decimalPlaces: 2 })).toBe('1,234.50');
  });

  it('formats currency with currency code and decimal places', () => {
    expect(formatValue(1234.5, 'currency', { currencyCode: 'USD' })).toBe('$1,234.50');
    expect(formatValue(1234.5, 'currency', { currencyCode: 'INR', decimalPlaces: 0 })).toContain(
      '1,235',
    );
  });

  it('falls back to the raw string for a non-numeric value formatted as a number', () => {
    expect(formatValue('abc', 'number')).toBe('abc');
  });

  it('formats percentage values', () => {
    expect(formatValue(42.5, 'percentage')).toBe('43%');
    expect(formatValue(42.5, 'percentage', { decimalPlaces: 1 })).toBe('42.5%');
  });

  it('formats dates with a custom pattern', () => {
    expect(formatValue('2026-06-27', 'date', { pattern: 'DD/MM/YYYY' })).toBe('27/06/2026');
  });

  it('falls back to the raw string for an unparseable date', () => {
    expect(formatValue('not-a-date', 'date')).toBe('not-a-date');
  });

  it('stringifies any other format type as-is', () => {
    expect(formatValue(true, 'text')).toBe('true');
    expect(formatValue(42, 'text')).toBe('42');
  });
});
