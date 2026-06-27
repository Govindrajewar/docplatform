import { readFileSync } from 'fs';
import path from 'path';

import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import {
  covers,
  FontRegistry,
  splitByCoverage,
  type EmbeddedFont,
} from '../../../src/engine/fonts/font-registry';

// See tests/integration/assets.test.ts for why this borrows a real TTF from bwip-js's own
// bundled fonts rather than shipping a fixture in this repo.
const REAL_TTF_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'node_modules',
  'bwip-js',
  'fonts',
  'OCRA7.ttf',
);

describe('FontRegistry', () => {
  it('resolves the same standard-font request from cache without re-embedding', async () => {
    const pdfDoc = await PDFDocument.create();
    const registry = new FontRegistry(pdfDoc, {});

    const first = await registry.resolve(undefined, 'normal');
    const second = await registry.resolve(undefined, 'normal');
    expect(first.pdfFont).toBe(second.pdfFont);
  });

  it('picks a bold Times-Roman variant for a "times" font name with bold weight', async () => {
    const pdfDoc = await PDFDocument.create();
    const registry = new FontRegistry(pdfDoc, {});

    const entry = await registry.resolve('Times New Roman', 'bold');
    expect(entry.pdfFont.name).toBe('Times-Bold');
  });

  it('treats a numeric weight >= 600 as bold', async () => {
    const pdfDoc = await PDFDocument.create();
    const registry = new FontRegistry(pdfDoc, {});

    const entry = await registry.resolve('Courier', 700);
    expect(entry.pdfFont.name).toBe('Courier-Bold');
  });

  it('embeds a custom font asset and exposes its fontkit handle for coverage checks', async () => {
    const pdfDoc = await PDFDocument.create();
    const buffer = readFileSync(REAL_TTF_PATH);
    const registry = new FontRegistry(pdfDoc, { customFont: { buffer, mimeType: 'font/ttf' } });

    const entry = await registry.resolve('customFont', 'normal');
    expect(entry.fontkitFont).toBeDefined();
  });

  it('falls back to a standard font when the named asset is not in the asset map', async () => {
    const pdfDoc = await PDFDocument.create();
    const registry = new FontRegistry(pdfDoc, {});

    const entry = await registry.resolve('notUploaded', 'normal');
    expect(entry.fontkitFont).toBeUndefined();
  });
});

describe('covers', () => {
  it('approximates standard-font coverage as the WinAnsi/Latin-1 range', async () => {
    const pdfDoc = await PDFDocument.create();
    const registry = new FontRegistry(pdfDoc, {});
    const entry = await registry.resolve(undefined, 'normal');

    expect(covers(entry, 'A'.codePointAt(0)!)).toBe(true);
    expect(covers(entry, 0x4e2d)).toBe(false); // CJK character, outside Latin-1
  });

  it('uses real glyph lookups for a custom embedded font', async () => {
    const pdfDoc = await PDFDocument.create();
    const buffer = readFileSync(REAL_TTF_PATH);
    const registry = new FontRegistry(pdfDoc, { customFont: { buffer, mimeType: 'font/ttf' } });
    const entry = await registry.resolve('customFont', 'normal');

    expect(covers(entry, 'A'.codePointAt(0)!)).toBe(true);
    expect(covers(entry, 0x4e2d)).toBe(false);
  });
});

describe('splitByCoverage', () => {
  it('returns a single run when primary and fallback are the same font', async () => {
    const pdfDoc = await PDFDocument.create();
    const registry = new FontRegistry(pdfDoc, {});
    const font = await registry.resolve(undefined, 'normal');

    expect(splitByCoverage('hello', font, font)).toEqual([{ text: 'hello', font }]);
  });

  it('splits a string into runs at the boundary where coverage changes', async () => {
    const pdfDoc = await PDFDocument.create();
    const buffer = readFileSync(REAL_TTF_PATH);
    const registry = new FontRegistry(pdfDoc, { customFont: { buffer, mimeType: 'font/ttf' } });

    const primary = await registry.resolve('customFont', 'normal');
    const fallback = await registry.getFallback();

    const runs = splitByCoverage('AB中中CD', primary, fallback);
    expect(runs.map((r) => r.text)).toEqual(['AB', '中中', 'CD']);
    expect(runs[0]?.font).toBe(primary);
    expect(runs[1]?.font).toBe(fallback);
    expect(runs[2]?.font).toBe(primary);
  });

  it('handles an all-uncovered string by routing every character to the fallback', async () => {
    const pdfDoc = await PDFDocument.create();
    const registry = new FontRegistry(pdfDoc, {});
    const primary: EmbeddedFont = await registry.resolve(undefined, 'normal');
    const fallback = primary; // standard font has no fontkitFont, so this exercises the WinAnsi path

    const runs = splitByCoverage('A', primary, fallback);
    expect(runs).toEqual([{ text: 'A', font: primary }]);
  });
});
