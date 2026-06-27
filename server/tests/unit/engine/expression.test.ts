import { describe, expect, it } from 'vitest';

import { evaluateVisibleIf } from '../../../src/engine/resolver/expression';

describe('evaluateVisibleIf', () => {
  it('evaluates a simple token comparison', () => {
    expect(evaluateVisibleIf('{{status}} == "active"', { status: 'active' })).toBe(true);
    expect(evaluateVisibleIf('{{status}} == "active"', { status: 'inactive' })).toBe(false);
  });

  it('evaluates numeric comparisons', () => {
    expect(evaluateVisibleIf('{{balance}} > 100', { balance: 150 })).toBe(true);
    expect(evaluateVisibleIf('{{balance}} > 100', { balance: 50 })).toBe(false);
    expect(evaluateVisibleIf('{{balance}} >= 100', { balance: 100 })).toBe(true);
    expect(evaluateVisibleIf('{{balance}} <= 100', { balance: 100 })).toBe(true);
    expect(evaluateVisibleIf('{{balance}} < 100', { balance: 100 })).toBe(false);
  });

  it('evaluates &&, ||, and ! with correct precedence', () => {
    expect(evaluateVisibleIf('{{a}} == 1 && {{b}} == 2', { a: 1, b: 2 })).toBe(true);
    expect(evaluateVisibleIf('{{a}} == 1 && {{b}} == 2', { a: 1, b: 3 })).toBe(false);
    expect(evaluateVisibleIf('{{a}} == 1 || {{b}} == 2', { a: 0, b: 2 })).toBe(true);
    expect(evaluateVisibleIf('!({{a}} == 1)', { a: 1 })).toBe(false);
    expect(evaluateVisibleIf('!({{a}} == 1)', { a: 2 })).toBe(true);
  });

  it('respects parentheses for grouping', () => {
    expect(
      evaluateVisibleIf('({{a}} == 1 || {{a}} == 2) && {{b}} == true', { a: 2, b: true }),
    ).toBe(true);
  });

  it('treats a missing token as null', () => {
    expect(evaluateVisibleIf('{{missing}} == null', {})).toBe(true);
  });

  it('handles boolean and null literals', () => {
    expect(evaluateVisibleIf('true && !false', {})).toBe(true);
    expect(evaluateVisibleIf('{{flag}} != null', { flag: null })).toBe(false);
  });

  it('never executes injected code — malformed/malicious input throws instead of running', () => {
    expect(() => evaluateVisibleIf('{{a}}; process.exit(1)', { a: 1 })).toThrow();
    expect(() => evaluateVisibleIf('require("fs")', {})).toThrow();
  });

  it('throws on a syntactically invalid expression rather than silently passing', () => {
    expect(() => evaluateVisibleIf('{{a}} ===', { a: 1 })).toThrow();
    expect(() => evaluateVisibleIf('((true)', {})).toThrow();
  });
});
