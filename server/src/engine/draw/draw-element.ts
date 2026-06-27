import type { PDFDocument, PDFPage } from 'pdf-lib';
import sharp from 'sharp';

import { FontRegistry } from '../fonts/font-registry';
import type { PositionedElement } from '../layout/types';
import type { AssetMap } from '../types';

import { generateBarcodePng, generateQrCodePng } from './barcode-image';
import { hexToRgb } from './colors';
import { toPdfBottomY } from './coordinates';
import { drawBoxDecorations } from './draw-box';
import { drawTextLines } from './draw-text';
import { computeImageBox } from './image-fit';

const SVG_RASTER_SCALE = 2;

async function embedAssetImage(
  pdfDoc: PDFDocument,
  buffer: Buffer,
  mimeType: string,
  targetWidth: number,
  targetHeight: number,
) {
  if (mimeType === 'image/svg+xml') {
    const png = await sharp(buffer)
      .resize(
        Math.max(Math.round(targetWidth * SVG_RASTER_SCALE), 1),
        Math.max(Math.round(targetHeight * SVG_RASTER_SCALE), 1),
        {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        },
      )
      .png()
      .toBuffer();
    return pdfDoc.embedPng(png);
  }
  if (mimeType === 'image/jpeg') return pdfDoc.embedJpg(buffer);
  return pdfDoc.embedPng(buffer);
}

/** Dispatches a single positioned element to its type-specific draw routine. Text-like elements
 * pass already-substituted `resolvedText`/`lines` (system tokens are re-resolved by the caller
 * before this runs, since the actual page number isn't known until pagination is finalized). */
export async function drawPositionedElement(
  pdfDoc: PDFDocument,
  page: PDFPage,
  pageHeight: number,
  pos: PositionedElement,
  assets: AssetMap,
  fontRegistry: FontRegistry,
): Promise<void> {
  const { element } = pos;
  if (element.visibility === 'hidden') return;

  drawBoxDecorations(page, pageHeight, pos, element.background, element.border);
  if (pos.width <= 0 || pos.height <= 0) return;

  switch (element.type) {
    case 'text':
    case 'staticText':
    case 'dynamicField':
    case 'date':
    case 'currency': {
      const fallback = await fontRegistry.getFallback();
      drawTextLines(
        page,
        pageHeight,
        pos,
        pos.lines,
        pos.font ?? fallback,
        fallback,
        pos.fontSize,
        element.align,
        element.verticalAlign,
        element.color,
        element.type === 'text' ? element.lineHeight : undefined,
      );
      return;
    }
    case 'checkbox': {
      const fallback = await fontRegistry.getFallback();
      drawTextLines(
        page,
        pageHeight,
        pos,
        pos.lines,
        pos.font ?? fallback,
        fallback,
        pos.fontSize,
        element.align,
        element.verticalAlign,
        element.color,
      );
      return;
    }
    case 'divider':
    case 'line': {
      const bottomY = toPdfBottomY(pageHeight, pos.y, pos.height);
      const midY = bottomY + pos.height / 2;
      page.drawLine({
        start: { x: pos.x, y: midY },
        end: { x: pos.x + pos.width, y: midY },
        thickness: element.thickness,
        color: element.color ? hexToRgb(element.color) : undefined,
        dashArray: element.dashed ? [4, 4] : undefined,
      });
      return;
    }
    case 'rectangle': {
      const bottomY = toPdfBottomY(pageHeight, pos.y, pos.height);
      page.drawRectangle({
        x: pos.x,
        y: bottomY,
        width: pos.width,
        height: pos.height,
        color: element.fill ? hexToRgb(element.fill) : undefined,
        borderColor: element.border ? hexToRgb(element.border.color) : undefined,
        borderWidth: element.border?.width,
      });
      return;
    }
    case 'circle': {
      const bottomY = toPdfBottomY(pageHeight, pos.y, pos.height);
      page.drawCircle({
        x: pos.x + element.radius,
        y: bottomY + element.radius,
        size: element.radius,
        color: element.fill ? hexToRgb(element.fill) : undefined,
        borderColor: element.border ? hexToRgb(element.border.color) : undefined,
        borderWidth: element.border?.width,
      });
      return;
    }
    case 'qrcode': {
      const png = await generateQrCodePng(
        pos.resolvedText ?? '',
        element.errorCorrectionLevel,
        element.foregroundColor,
        element.backgroundColor,
      );
      const image = await pdfDoc.embedPng(png);
      const bottomY = toPdfBottomY(pageHeight, pos.y, pos.height);
      page.drawImage(image, { x: pos.x, y: bottomY, width: pos.width, height: pos.height });
      return;
    }
    case 'barcode': {
      const png = await generateBarcodePng(
        pos.resolvedText ?? '',
        element.symbology,
        element.showText,
      );
      const image = await pdfDoc.embedPng(png);
      const bottomY = toPdfBottomY(pageHeight, pos.y, pos.height);
      page.drawImage(image, { x: pos.x, y: bottomY, width: pos.width, height: pos.height });
      return;
    }
    case 'image':
    case 'signature': {
      const assetKey = pos.resolvedText;
      const asset = assetKey ? assets[assetKey] : undefined;

      if (!asset) {
        if (element.type === 'signature') {
          const fallback = await fontRegistry.getFallback();
          drawTextLines(
            page,
            pageHeight,
            pos,
            [element.placeholderLabel],
            pos.font ?? fallback,
            fallback,
            pos.fontSize,
            element.align,
            element.verticalAlign,
            element.color,
          );
        }
        return;
      }

      const image = await embedAssetImage(
        pdfDoc,
        asset.buffer,
        asset.mimeType,
        pos.width,
        pos.height,
      );
      const fit = element.type === 'image' ? element.fit : 'contain';
      const box = computeImageBox(fit, pos.width, pos.height, image.width, image.height);
      const bottomY = toPdfBottomY(pageHeight, pos.y + box.offsetY, box.height);
      page.drawImage(image, {
        x: pos.x + box.offsetX,
        y: bottomY,
        width: box.width,
        height: box.height,
      });
      return;
    }
    case 'table':
      return; // tables are drawn separately via drawTableChunk, never reach here
    default:
      return;
  }
}
