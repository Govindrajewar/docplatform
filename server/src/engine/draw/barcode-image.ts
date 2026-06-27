import bwipjs from 'bwip-js';
import QRCode from 'qrcode';

const QR_RENDER_RESOLUTION_PX = 400;
const BARCODE_BCID: Record<string, string> = { code128: 'code128', ean13: 'ean13', upc: 'upca' };

export class QrCodeCapacityExceededError extends Error {
  constructor(byteLength: number, errorCorrectionLevel: string) {
    super(
      `QR code value is ${byteLength} bytes, which exceeds the capacity of error correction level "${errorCorrectionLevel}" — use a shorter value or a lower error correction level`,
    );
  }
}

export async function generateQrCodePng(
  value: string,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H',
  foregroundColor: string,
  backgroundColor: string,
): Promise<Buffer> {
  try {
    return await QRCode.toBuffer(value, {
      type: 'png',
      width: QR_RENDER_RESOLUTION_PX,
      margin: 0,
      errorCorrectionLevel,
      color: { dark: foregroundColor, light: backgroundColor },
    });
  } catch (err) {
    // The underlying library already fails fast rather than producing an unscannable code
    // (PRD 10 §10.5) — this just surfaces the actual byte count in the error for clarity.
    if (err instanceof Error && /too big/i.test(err.message)) {
      throw new QrCodeCapacityExceededError(
        Buffer.byteLength(value, 'utf-8'),
        errorCorrectionLevel,
      );
    }
    throw err;
  }
}

export async function generateBarcodePng(
  value: string,
  symbology: 'code128' | 'ean13' | 'upc',
  showText: boolean,
): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: BARCODE_BCID[symbology] ?? 'code128',
    text: value,
    scale: 3,
    height: 12,
    includetext: showText,
    textxalign: 'center',
  });
}
