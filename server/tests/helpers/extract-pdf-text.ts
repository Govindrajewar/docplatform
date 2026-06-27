import { PDFParse } from 'pdf-parse';

export async function extractPdfText(buffer: Buffer, pageNumbers?: number[]): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText(pageNumbers ? { partial: pageNumbers } : undefined);
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export async function extractPdfPageCount(buffer: Buffer): Promise<number> {
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo();
    return info.total;
  } finally {
    await parser.destroy();
  }
}
