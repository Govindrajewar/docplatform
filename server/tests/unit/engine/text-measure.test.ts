import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  lineHeightFor,
  measureWrappedHeight,
  wrapText,
} from '../../../src/engine/layout/text-measure';

let font: PDFFont;

beforeAll(async () => {
  const pdfDoc = await PDFDocument.create();
  font = await pdfDoc.embedFont(StandardFonts.Helvetica);
});

describe('wrapText', () => {
  it('keeps short text on a single line', () => {
    expect(wrapText('Hello world', font, 10, 200)).toEqual(['Hello world']);
  });

  it('wraps long text across multiple lines without exceeding maxWidth', () => {
    const lines = wrapText('The quick brown fox jumps over the lazy dog', font, 12, 80);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 12)).toBeLessThanOrEqual(80 + 0.01);
    }
  });

  it('honors explicit \\n as a hard line break even when the line would otherwise fit', () => {
    const lines = wrapText('Line one\nLine two', font, 10, 500);
    expect(lines).toEqual(['Line one', 'Line two']);
  });

  it('does not split a single word wider than maxWidth (documented limitation)', () => {
    const lines = wrapText('Supercalifragilisticexpialidocious', font, 12, 10);
    expect(lines).toEqual(['Supercalifragilisticexpialidocious']);
  });

  it('preserves blank lines from consecutive newlines', () => {
    expect(wrapText('A\n\nB', font, 10, 200)).toEqual(['A', '', 'B']);
  });

  it('returns a single empty line for empty input', () => {
    expect(wrapText('', font, 10, 200)).toEqual(['']);
  });
});

describe('lineHeightFor / measureWrappedHeight', () => {
  it('defaults line height to 1.2x font size', () => {
    expect(lineHeightFor(10)).toBe(12);
  });

  it('uses an explicit line height when provided', () => {
    expect(lineHeightFor(10, 20)).toBe(20);
  });

  it('multiplies line count by line height', () => {
    expect(measureWrappedHeight(3, 10)).toBe(36);
    expect(measureWrappedHeight(3, 10, 15)).toBe(45);
  });
});
