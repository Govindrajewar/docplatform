import type { PDFPage } from 'pdf-lib';
import type { TableColumn, TemplateDocument } from '@platform/shared';

import { FontRegistry, type EmbeddedFont } from '../fonts/font-registry';
import type { PositionedTable } from '../layout/types';

import { hexToRgb } from './colors';
import { toPdfBottomY } from './coordinates';

const CELL_PADDING = 4;
const ASCENT_RATIO = 0.8;

function totalWidth(columns: TableColumn[]): number {
  return columns.reduce((sum, col) => sum + col.width, 0);
}

function drawCellText(
  page: PDFPage,
  rowBottomY: number,
  rowHeight: number,
  colX: number,
  colWidth: number,
  text: string,
  font: EmbeddedFont,
  fontSize: number,
  align: 'left' | 'center' | 'right',
  color: string | undefined,
): void {
  if (!text) return;
  const textWidth = font.pdfFont.widthOfTextAtSize(text, fontSize);
  let textX = colX + CELL_PADDING;
  if (align === 'center') textX = colX + Math.max(colWidth - textWidth, 0) / 2;
  else if (align === 'right') textX = colX + Math.max(colWidth - textWidth - CELL_PADDING, 0);

  const baselineY = rowBottomY + (rowHeight - fontSize) / 2 + fontSize * (ASCENT_RATIO - 0.5);
  page.drawText(text, {
    x: textX,
    y: baselineY,
    size: fontSize,
    font: font.pdfFont,
    color: color ? hexToRgb(color) : undefined,
  });
}

function drawRowBackground(
  page: PDFPage,
  x: number,
  bottomY: number,
  width: number,
  height: number,
  color: string,
): void {
  page.drawRectangle({ x, y: bottomY, width, height, color: hexToRgb(color) });
}

/**
 * Draws one positioned table chunk: the (optional) repeated header row, the chunk's data rows
 * with alternating colors/borders, and the (optional) grand-totals row. Running totals are
 * already baked into each row's formatted cell text by the resolver — this is purely a
 * presentation pass over already-resolved strings. See PRD 04 §4.5 / 10 §10.4.
 */
export async function drawTableChunk(
  page: PDFPage,
  pageHeight: number,
  positioned: PositionedTable,
  theme: TemplateDocument['theme'],
  fontRegistry: FontRegistry,
): Promise<void> {
  const { element: table, chunk } = positioned;
  const fontSize = table.fontSize ?? theme.baseFontSize;
  const bodyFont = await fontRegistry.resolve(table.font, table.fontWeight);
  const headerFont = await fontRegistry.resolve(table.font, table.headerStyle.fontWeight ?? 'bold');
  const width = totalWidth(table.columns);

  let cursorTop = positioned.y;
  const rowBoundaries: number[] = [];

  if (chunk.includesHeader) {
    const bottomY = toPdfBottomY(pageHeight, cursorTop, table.rowHeight);
    if (table.headerStyle.background)
      drawRowBackground(
        page,
        positioned.x,
        bottomY,
        width,
        table.rowHeight,
        table.headerStyle.background,
      );

    let colX = positioned.x;
    for (const column of table.columns) {
      drawCellText(
        page,
        bottomY,
        table.rowHeight,
        colX,
        column.width,
        column.label,
        headerFont,
        fontSize,
        column.align,
        table.headerStyle.color ?? table.color,
      );
      colX += column.width;
    }
    rowBoundaries.push(cursorTop);
    cursorTop += table.rowHeight;
  }

  if (chunk.isEmptyState) {
    if (table.emptyState?.text) {
      const bottomY = toPdfBottomY(pageHeight, cursorTop, table.rowHeight);
      drawCellText(
        page,
        bottomY,
        table.rowHeight,
        positioned.x,
        width,
        table.emptyState.text,
        bodyFont,
        fontSize,
        'left',
        table.color,
      );
    }
    rowBoundaries.push(cursorTop + table.rowHeight);
  } else {
    chunk.rows.forEach((row, idx) => {
      const absoluteIndex = chunk.startIndex + idx;
      const bottomY = toPdfBottomY(pageHeight, cursorTop, table.rowHeight);

      if (table.alternatingRowColors) {
        const color =
          absoluteIndex % 2 === 0 ? table.alternatingRowColors[0] : table.alternatingRowColors[1];
        drawRowBackground(page, positioned.x, bottomY, width, table.rowHeight, color);
      }

      let colX = positioned.x;
      for (const column of table.columns) {
        drawCellText(
          page,
          bottomY,
          table.rowHeight,
          colX,
          column.width,
          row.cells[column.key] ?? '',
          bodyFont,
          fontSize,
          column.align,
          table.color,
        );
        colX += column.width;
      }

      rowBoundaries.push(cursorTop);
      cursorTop += table.rowHeight;
    });
    rowBoundaries.push(cursorTop);
  }

  if (chunk.includesGrandTotals) {
    const bottomY = toPdfBottomY(pageHeight, cursorTop, table.rowHeight);
    let colX = positioned.x;
    table.columns.forEach((column, idx) => {
      const text =
        idx === 0
          ? (positioned.grandTotalsLabel ?? '')
          : (positioned.grandTotalsRow[column.key] ?? '');
      drawCellText(
        page,
        bottomY,
        table.rowHeight,
        colX,
        column.width,
        text,
        headerFont,
        fontSize,
        column.align,
        table.color,
      );
      colX += column.width;
    });
    cursorTop += table.rowHeight;
    rowBoundaries.push(cursorTop);
  }

  if (table.borders.horizontal) {
    for (const top of rowBoundaries) {
      const y = pageHeight - top;
      page.drawLine({
        start: { x: positioned.x, y },
        end: { x: positioned.x + width, y },
        thickness: 0.5,
        color: hexToRgb(table.borders.color),
      });
    }
  }

  if (table.borders.vertical) {
    const topY = pageHeight - positioned.y;
    const bottomY = pageHeight - cursorTop;
    let colX = positioned.x;
    page.drawLine({
      start: { x: colX, y: topY },
      end: { x: colX, y: bottomY },
      thickness: 0.5,
      color: hexToRgb(table.borders.color),
    });
    for (const column of table.columns) {
      colX += column.width;
      page.drawLine({
        start: { x: colX, y: topY },
        end: { x: colX, y: bottomY },
        thickness: 0.5,
        color: hexToRgb(table.borders.color),
      });
    }
  }
}
