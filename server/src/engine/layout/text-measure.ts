import type { PDFFont } from 'pdf-lib';

/**
 * Greedy word-wrap. Explicit `\n` in the source text always forces a hard line break first;
 * within each resulting paragraph, words are packed until the next word would exceed `maxWidth`.
 * A single word wider than `maxWidth` on its own is not split mid-word — it overflows that line,
 * which is an accepted Phase 3 limitation (no character-level breaking).
 */
export function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }

    const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);

      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }

    if (currentLine) lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

export function lineHeightFor(fontSize: number, explicit?: number): number {
  return explicit ?? fontSize * 1.2;
}

export function measureWrappedHeight(
  lineCount: number,
  fontSize: number,
  explicitLineHeight?: number,
): number {
  return lineCount * lineHeightFor(fontSize, explicitLineHeight);
}
