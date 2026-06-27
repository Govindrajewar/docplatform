import fontkitLib from '@pdf-lib/fontkit';
import { type PDFDocument, type PDFFont, StandardFonts } from 'pdf-lib';
import * as fontkit from 'fontkit';

import type { AssetMap } from '../types';

export type FontWeight = 'normal' | 'bold' | number;

export interface EmbeddedFont {
  pdfFont: PDFFont;
  /** Present only for custom-embedded fonts — used for real glyph-coverage checks. */
  fontkitFont?: fontkit.Font;
}

function isBold(weight: FontWeight | undefined): boolean {
  if (weight === 'bold') return true;
  if (typeof weight === 'number') return weight >= 600;
  return false;
}

function standardFontFor(
  fontName: string | undefined,
  weight: FontWeight | undefined,
): StandardFonts {
  const bold = isBold(weight);
  const normalized = (fontName ?? 'helvetica').toLowerCase();

  if (normalized.includes('times'))
    return bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman;
  if (normalized.includes('courier'))
    return bold ? StandardFonts.CourierBold : StandardFonts.Courier;
  return bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
}

/**
 * Resolves template `font` names to embedded PDF fonts. A name is treated as a custom asset
 * reference if it matches a key in `assets` (an uploaded font file); otherwise it falls back to
 * the closest Standard-14 font. See PRD 04 §4.3 ("must resolve to an embedded font asset or
 * bundled system font") and PRD 10 §10.5 (glyph-fallback behavior).
 */
export class FontRegistry {
  private readonly cache = new Map<string, EmbeddedFont>();
  private fallback: EmbeddedFont | null = null;

  constructor(
    private readonly pdfDoc: PDFDocument,
    private readonly assets: AssetMap,
  ) {
    this.pdfDoc.registerFontkit(fontkitLib);
  }

  async resolve(
    fontName: string | undefined,
    weight: FontWeight | undefined,
  ): Promise<EmbeddedFont> {
    const cacheKey = `${fontName ?? 'helvetica'}:${weight ?? 'normal'}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const asset = fontName ? this.assets[fontName] : undefined;
    const entry = asset
      ? await this.embedCustomFont(asset.buffer)
      : await this.embedStandardFont(fontName, weight);

    this.cache.set(cacheKey, entry);
    return entry;
  }

  async getFallback(): Promise<EmbeddedFont> {
    this.fallback ??= await this.embedStandardFont(undefined, 'normal');
    return this.fallback;
  }

  private async embedStandardFont(
    fontName: string | undefined,
    weight: FontWeight | undefined,
  ): Promise<EmbeddedFont> {
    const pdfFont = await this.pdfDoc.embedFont(standardFontFor(fontName, weight));
    return { pdfFont };
  }

  private async embedCustomFont(buffer: Buffer): Promise<EmbeddedFont> {
    const pdfFont = await this.pdfDoc.embedFont(buffer, { subset: true });
    let fontkitFont: fontkit.Font | undefined;
    try {
      const parsed = fontkit.create(buffer);
      fontkitFont = 'fonts' in parsed ? parsed.fonts[0] : parsed;
    } catch {
      fontkitFont = undefined;
    }
    return { pdfFont, fontkitFont };
  }
}

/** WinAnsi/Latin-1 approximation — Standard-14 fonts only cover this repertoire. */
function standardFontCovers(codePoint: number): boolean {
  return codePoint <= 0xff;
}

function customFontCovers(font: fontkit.Font, codePoint: number): boolean {
  try {
    const glyph = font.glyphForCodePoint(codePoint);
    return glyph.id !== 0;
  } catch {
    return false;
  }
}

export function covers(entry: EmbeddedFont, codePoint: number): boolean {
  return entry.fontkitFont
    ? customFontCovers(entry.fontkitFont, codePoint)
    : standardFontCovers(codePoint);
}

export interface TextRun {
  text: string;
  font: EmbeddedFont;
}

/**
 * Splits `text` into runs by glyph coverage, using `fallback` for any run the primary font can't
 * render — e.g. a Latin-only custom font with a stray CJK character. See PRD 10 §10.5.
 */
export function splitByCoverage(
  text: string,
  primary: EmbeddedFont,
  fallback: EmbeddedFont,
): TextRun[] {
  if (primary === fallback) return [{ text, font: primary }];

  const runs: TextRun[] = [];
  let currentFont: EmbeddedFont | null = null;
  let currentText = '';

  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    const font = covers(primary, codePoint) ? primary : fallback;
    if (currentFont && font !== currentFont) {
      runs.push({ text: currentText, font: currentFont });
      currentText = '';
    }
    currentFont = font;
    currentText += char;
  }
  if (currentFont && currentText) runs.push({ text: currentText, font: currentFont });
  return runs;
}
