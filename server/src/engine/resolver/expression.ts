import type { DataContext } from '../types';

import { getByPath } from './tokens';

type Literal = string | number | boolean | null;

/**
 * Evaluates a restricted boolean expression grammar: comparisons, &&/||/!, literals, and
 * `{{token}}` references — never `eval`/`new Function` (PRD 04 §4.7, PRD 08 §8.1).
 *
 * Strategy: substitute every `{{path}}` reference with its resolved value as a JSON literal
 * first (safely escaping strings), then parse the now fully-literal expression with a small
 * recursive-descent parser. No identifiers ever reach the parser, so there is nothing to
 * "resolve" dynamically at parse time — it only ever evaluates constant literals/operators.
 */
export function evaluateVisibleIf(expression: string, context: DataContext): boolean {
  const substituted = expression.replace(/\{\{([\w.]+)\}\}/g, (_match, path: string) => {
    const value = getByPath(context, path);
    return JSON.stringify(value === undefined ? null : value);
  });

  const tokens = tokenize(substituted);
  const parser = new Parser(tokens);
  const result = parser.parseOr();
  parser.expectEnd();
  return Boolean(result);
}

type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'TRUE'
  | 'FALSE'
  | 'NULL'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'EQ'
  | 'NEQ'
  | 'GTE'
  | 'LTE'
  | 'GT'
  | 'LT'
  | 'LPAREN'
  | 'RPAREN';

interface Token {
  type: TokenType;
  value?: Literal;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === undefined || /\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN' });
      i += 1;
      continue;
    }
    if (input.startsWith('&&', i)) {
      tokens.push({ type: 'AND' });
      i += 2;
      continue;
    }
    if (input.startsWith('||', i)) {
      tokens.push({ type: 'OR' });
      i += 2;
      continue;
    }
    if (input.startsWith('===', i) || input.startsWith('==', i)) {
      tokens.push({ type: 'EQ' });
      i += input.startsWith('===', i) ? 3 : 2;
      continue;
    }
    if (input.startsWith('!==', i) || input.startsWith('!=', i)) {
      tokens.push({ type: 'NEQ' });
      i += input.startsWith('!==', i) ? 3 : 2;
      continue;
    }
    if (input.startsWith('>=', i)) {
      tokens.push({ type: 'GTE' });
      i += 2;
      continue;
    }
    if (input.startsWith('<=', i)) {
      tokens.push({ type: 'LTE' });
      i += 2;
      continue;
    }
    if (ch === '>') {
      tokens.push({ type: 'GT' });
      i += 1;
      continue;
    }
    if (ch === '<') {
      tokens.push({ type: 'LT' });
      i += 1;
      continue;
    }
    if (ch === '!') {
      tokens.push({ type: 'NOT' });
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let value = '';
      while (j < input.length && input[j] !== quote) {
        value += input[j];
        j += 1;
      }
      tokens.push({ type: 'STRING', value });
      i = j + 1;
      continue;
    }
    if (/[0-9-]/.test(ch)) {
      let j = i;
      while (j < input.length && /[0-9.eE+-]/.test(input[j] ?? '')) j += 1;
      tokens.push({ type: 'NUMBER', value: Number(input.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < input.length && /[a-zA-Z]/.test(input[j] ?? '')) j += 1;
      const word = input.slice(i, j);
      if (word === 'true') tokens.push({ type: 'TRUE', value: true });
      else if (word === 'false') tokens.push({ type: 'FALSE', value: false });
      else if (word === 'null') tokens.push({ type: 'NULL', value: null });
      else throw new Error(`Unexpected identifier "${word}" in visibleIf expression`);
      i = j;
      continue;
    }

    throw new Error(`Unexpected character "${ch}" in visibleIf expression`);
  }

  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(type: TokenType): Token {
    const token = this.tokens[this.pos];
    if (!token || token.type !== type) {
      throw new Error(`Expected ${type} but got ${token?.type ?? 'end of expression'}`);
    }
    this.pos += 1;
    return token;
  }

  expectEnd(): void {
    if (this.pos !== this.tokens.length) {
      throw new Error('Unexpected trailing tokens in visibleIf expression');
    }
  }

  parseOr(): Literal {
    let left = this.parseAnd();
    while (this.peek()?.type === 'OR') {
      this.consume('OR');
      const right = this.parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  private parseAnd(): Literal {
    let left = this.parseNot();
    while (this.peek()?.type === 'AND') {
      this.consume('AND');
      const right = this.parseNot();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  private parseNot(): Literal {
    if (this.peek()?.type === 'NOT') {
      this.consume('NOT');
      return !this.parseNot();
    }
    return this.parseComparison();
  }

  private parseComparison(): Literal {
    const left = this.parsePrimary();
    const comparisonOps: TokenType[] = ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE'];
    const opToken = this.peek();
    if (opToken && comparisonOps.includes(opToken.type)) {
      this.consume(opToken.type);
      const right = this.parsePrimary();
      switch (opToken.type) {
        case 'EQ':
          return left === right;
        case 'NEQ':
          return left !== right;
        case 'GT':
          return Number(left) > Number(right);
        case 'GTE':
          return Number(left) >= Number(right);
        case 'LT':
          return Number(left) < Number(right);
        case 'LTE':
          return Number(left) <= Number(right);
      }
    }
    return left;
  }

  private parsePrimary(): Literal {
    const token = this.peek();
    if (!token) throw new Error('Unexpected end of visibleIf expression');

    if (token.type === 'LPAREN') {
      this.consume('LPAREN');
      const value = this.parseOr();
      this.consume('RPAREN');
      return value;
    }
    if (['NUMBER', 'STRING', 'TRUE', 'FALSE', 'NULL'].includes(token.type)) {
      this.consume(token.type);
      return token.value ?? null;
    }
    throw new Error(`Unexpected token ${token.type} in visibleIf expression`);
  }
}
