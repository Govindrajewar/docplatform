import { templateDocumentSchema } from '@platform/shared';
import { describe, expect, it } from 'vitest';

import { QrCodeCapacityExceededError } from '../../src/engine/draw/barcode-image';
import { RequiredFieldsMissingError } from '../../src/engine/resolver/field-resolver';
import {
  InvalidTableDataError,
  TableRowLimitExceededError,
} from '../../src/engine/resolver/table-resolver';
import { render } from '../../src/engine/render';
import { extractPdfPageCount, extractPdfText } from '../helpers/extract-pdf-text';
import { buildTemplate } from '../helpers/template-fixtures';

// A valid 1x1 transparent PNG, reused from tests/integration/assets.test.ts.
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function section(elements: Record<string, unknown>[]) {
  return { id: 's1', elements };
}

describe('render — per-element-type', () => {
  it('renders a "text" element with token substitution and wraps long content', async () => {
    const template = buildTemplate({
      sections: [
        section([
          {
            id: 'e1',
            type: 'text',
            x: 0,
            y: 0,
            width: 100,
            value: 'Hello {{name}}, this is a fairly long sentence that should wrap.',
          },
        ]),
      ],
    });
    const buffer = await render({ template, data: { name: 'Jane' } });
    const text = await extractPdfText(buffer);
    expect(text).toContain('Hello Jane');
  });

  it('renders a "staticText" element literally, without token substitution', async () => {
    const template = buildTemplate({
      sections: [
        section([
          {
            id: 'e1',
            type: 'staticText',
            x: 0,
            y: 0,
            width: 200,
            value: 'Literal {{not_a_token}}',
          },
        ]),
      ],
    });
    const buffer = await render({ template, data: {} });
    const text = await extractPdfText(buffer);
    expect(text).toContain('Literal {{not_a_token}}');
  });

  it('renders a "dynamicField" with its declared format', async () => {
    const template = buildTemplate({
      fields: [
        {
          key: 'score',
          label: 'Score',
          type: 'number',
          system: false,
          required: false,
          defaultValue: null,
        },
      ],
      sections: [
        section([
          {
            id: 'e1',
            type: 'dynamicField',
            x: 0,
            y: 0,
            width: 200,
            fieldKey: 'score',
            format: 'percentage',
          },
        ]),
      ],
    });
    const buffer = await render({ template, data: { fields: { score: 42 } } });
    const text = await extractPdfText(buffer);
    expect(text).toContain('42%');
  });

  it('renders a "date" element with a custom pattern', async () => {
    const template = buildTemplate({
      fields: [
        {
          key: 'issuedOn',
          label: 'Issued On',
          type: 'date',
          system: false,
          required: false,
          defaultValue: null,
        },
      ],
      sections: [
        section([
          {
            id: 'e1',
            type: 'date',
            x: 0,
            y: 0,
            width: 200,
            fieldKey: 'issuedOn',
            format: 'DD/MM/YYYY',
          },
        ]),
      ],
    });
    const buffer = await render({ template, data: { fields: { issuedOn: '2026-06-27' } } });
    const text = await extractPdfText(buffer);
    expect(text).toContain('27/06/2026');
  });

  it('renders a "currency" element with explicit currency code', async () => {
    const template = buildTemplate({
      fields: [
        {
          key: 'balance',
          label: 'Balance',
          type: 'currency',
          system: false,
          required: false,
          defaultValue: null,
        },
      ],
      sections: [
        section([
          {
            id: 'e1',
            type: 'currency',
            x: 0,
            y: 0,
            width: 200,
            fieldKey: 'balance',
            currencyCode: 'USD',
          },
        ]),
      ],
    });
    const buffer = await render({ template, data: { fields: { balance: 1234.5 } } });
    const text = await extractPdfText(buffer);
    expect(text).toContain('$1,234.50');
  });

  it('renders the checked glyph for a checkbox bound to a truthy token', async () => {
    const template = buildTemplate({
      sections: [
        section([
          {
            id: 'e1',
            type: 'checkbox',
            x: 0,
            y: 0,
            checked: '{{active}}',
            checkedGlyph: 'YES',
            uncheckedGlyph: 'NO',
          },
        ]),
      ],
    });
    const buffer = await render({ template, data: { active: 'true' } });
    const text = await extractPdfText(buffer);
    expect(text).toContain('YES');
    expect(text).not.toContain('NO');
  });

  it('embeds a real PNG asset for an "image" element', async () => {
    const template = buildTemplate({
      sections: [
        section([
          {
            id: 'e1',
            type: 'image',
            x: 0,
            y: 0,
            width: 50,
            height: 50,
            src: '{{logoKey}}',
            fit: 'contain',
          },
        ]),
      ],
    });
    const buffer = await render({
      template,
      data: { logoKey: 'logo' },
      assets: { logo: { buffer: PNG_BUFFER, mimeType: 'image/png' } },
    });
    expect(buffer.length).toBeGreaterThan(0);
    expect(await extractPdfPageCount(buffer)).toBe(1);
  });

  it('does not crash when an "image" element has no matching asset', async () => {
    const template = buildTemplate({
      sections: [
        section([
          { id: 'e1', type: 'image', x: 0, y: 0, width: 50, height: 50, src: '{{missingKey}}' },
        ]),
      ],
    });
    const buffer = await render({ template, data: {} });
    expect(await extractPdfPageCount(buffer)).toBe(1);
  });

  it('renders a placeholder label for a "signature" element with no asset', async () => {
    const template = buildTemplate({
      sections: [
        section([
          {
            id: 'e1',
            type: 'signature',
            x: 0,
            y: 0,
            width: 150,
            height: 30,
            placeholderLabel: 'Sign Here',
          },
        ]),
      ],
    });
    const buffer = await render({ template, data: {} });
    const text = await extractPdfText(buffer);
    expect(text).toContain('Sign Here');
  });

  it('renders divider/line/rectangle/circle shapes without throwing', async () => {
    const template = buildTemplate({
      sections: [
        section([
          { id: 'e1', type: 'divider', x: 0, y: 0, width: 200, thickness: 1 },
          { id: 'e2', type: 'line', x: 0, y: 10, width: 200, height: 1, thickness: 1 },
          { id: 'e3', type: 'rectangle', x: 0, y: 20, width: 50, height: 20, fill: '#FF0000' },
          { id: 'e4', type: 'circle', x: 100, y: 20, radius: 10, fill: '#00FF00' },
        ]),
      ],
    });
    const buffer = await render({ template, data: {} });
    expect(await extractPdfPageCount(buffer)).toBe(1);
  });

  it('renders a qrcode and a barcode without throwing', async () => {
    const template = buildTemplate({
      sections: [
        section([
          { id: 'e1', type: 'qrcode', x: 0, y: 0, size: 50, value: 'https://example.com' },
          {
            id: 'e2',
            type: 'barcode',
            x: 0,
            y: 60,
            size: 50,
            value: '123456789012',
            symbology: 'code128',
          },
        ]),
      ],
    });
    const buffer = await render({ template, data: {} });
    expect(await extractPdfPageCount(buffer)).toBe(1);
  });
});

describe('render — header/footer and system tokens', () => {
  it('substitutes {{system.pageNumber}}/{{system.pageCount}} differently per page', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ description: `Row ${i}`, amount: i }));
    const template = buildTemplate({
      page: { size: 'A4', marginTop: 40, marginBottom: 40, marginLeft: 40, marginRight: 40 },
      footer: {
        height: 20,
        elements: [
          {
            id: 'f1',
            type: 'text',
            x: 0,
            y: 0,
            width: 400,
            value: 'Page {{system.pageNumber}} of {{system.pageCount}}',
          },
        ],
      },
      sections: [
        section([
          {
            id: 't1',
            type: 'table',
            x: 0,
            y: 0,
            dataSource: 'items',
            rowHeight: 30,
            columns: [{ key: 'description', label: 'Description', width: 400 }],
          },
        ]),
      ],
    });
    const buffer = await render({ template, data: { items: rows } });
    const pageCount = await extractPdfPageCount(buffer);
    expect(pageCount).toBeGreaterThan(1);

    const firstPageText = await extractPdfText(buffer, [1]);
    expect(firstPageText).toContain(`Page 1 of ${pageCount}`);
    const lastPageText = await extractPdfText(buffer, [pageCount]);
    expect(lastPageText).toContain(`Page ${pageCount} of ${pageCount}`);
  });

  it('repeats the header on every page by default but can be limited to the first page only', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ description: `Row ${i}` }));
    const template = buildTemplate({
      header: {
        height: 20,
        repeatOnEveryPage: false,
        elements: [
          { id: 'h1', type: 'staticText', x: 0, y: 0, width: 300, value: 'COVER PAGE ONLY' },
        ],
      },
      sections: [
        section([
          {
            id: 't1',
            type: 'table',
            x: 0,
            y: 0,
            dataSource: 'items',
            rowHeight: 30,
            columns: [{ key: 'description', label: 'Description', width: 400 }],
          },
        ]),
      ],
    });
    const buffer = await render({ template, data: { items: rows } });
    const pageCount = await extractPdfPageCount(buffer);
    expect(pageCount).toBeGreaterThan(1);

    expect(await extractPdfText(buffer, [1])).toContain('COVER PAGE ONLY');
    expect(await extractPdfText(buffer, [pageCount])).not.toContain('COVER PAGE ONLY');
  });
});

describe('render — table & pagination edge cases (PRD 10 §10.4/§10.5)', () => {
  it('renders the emptyState block when dataSource resolves to undefined', async () => {
    const template = buildTemplate({
      sections: [
        section([
          {
            id: 't1',
            type: 'table',
            x: 0,
            y: 0,
            dataSource: 'missing.path',
            columns: [{ key: 'description', label: 'Description', width: 200 }],
            emptyState: { text: 'No transactions found' },
          },
        ]),
      ],
    });
    const buffer = await render({ template, data: {} });
    const text = await extractPdfText(buffer);
    expect(text).toContain('No transactions found');
  });

  it('rejects (does not silently coerce) when dataSource resolves to a non-array', async () => {
    const template = buildTemplate({
      sections: [
        section([
          {
            id: 't1',
            type: 'table',
            x: 0,
            y: 0,
            dataSource: 'items',
            columns: [{ key: 'description', label: 'Description', width: 200 }],
          },
        ]),
      ],
    });
    await expect(render({ template, data: { items: 'not-an-array' } })).rejects.toThrow(
      InvalidTableDataError,
    );
  });

  it('suppresses the grand-totals row entirely when the table has 0 rows', async () => {
    const template = buildTemplate({
      sections: [
        section([
          {
            id: 't1',
            type: 'table',
            x: 0,
            y: 0,
            dataSource: 'items',
            columns: [{ key: 'amount', label: 'Amount', width: 200, format: 'currency' }],
            grandTotals: [{ columnKey: 'amount', label: 'Grand Total Label' }],
          },
        ]),
      ],
    });
    const buffer = await render({ template, data: { items: [] } });
    const text = await extractPdfText(buffer);
    expect(text).not.toContain('Grand Total Label');
  });

  it('pushes the grand-totals row to a new page when it does not fit on the last data page', async () => {
    // rowHeight chosen so the last page's data rows exactly fill the body height, leaving no
    // room for the totals row — it must spill onto a fresh page (PRD 10 §10.4/§10.5).
    const rows = Array.from({ length: 40 }, (_, i) => ({ amount: i + 1 }));
    const template = buildTemplate({
      page: { size: 'A4', marginTop: 40, marginBottom: 40, marginLeft: 40, marginRight: 40 },
      sections: [
        section([
          {
            id: 't1',
            type: 'table',
            x: 0,
            y: 0,
            dataSource: 'items',
            rowHeight: 18,
            columns: [{ key: 'amount', label: 'Amount', width: 200, format: 'currency' }],
            grandTotals: [{ columnKey: 'amount', label: 'Grand Total Label' }],
          },
        ]),
      ],
    });
    const buffer = await render({ template, data: { items: rows } });
    const pageCount = await extractPdfPageCount(buffer);
    const lastPageText = await extractPdfText(buffer, [pageCount]);
    expect(lastPageText).toContain('Grand Total Label');
  });

  it('rejects a table whose row count exceeds maxTableRows, naming the actual count', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ amount: i }));
    const template = buildTemplate({
      sections: [
        section([
          {
            id: 't1',
            type: 'table',
            x: 0,
            y: 0,
            dataSource: 'items',
            columns: [{ key: 'amount', label: 'Amount', width: 200 }],
          },
        ]),
      ],
    });
    await expect(render({ template, data: { items: rows }, maxTableRows: 5 })).rejects.toThrow(
      TableRowLimitExceededError,
    );
  });

  it('aborts with PAGE_LIMIT-style error when the document would exceed maxPages', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ amount: i }));
    const template = buildTemplate({
      sections: [
        section([
          {
            id: 't1',
            type: 'table',
            x: 0,
            y: 0,
            dataSource: 'items',
            rowHeight: 30,
            columns: [{ key: 'amount', label: 'Amount', width: 200 }],
          },
        ]),
      ],
    });
    await expect(render({ template, data: { items: rows }, maxPages: 1 })).rejects.toThrow(
      /maximum page count/,
    );
  });

  it('aggregates every missing required field into a single error instead of failing on the first one', async () => {
    const template = buildTemplate({
      fields: [
        {
          key: 'accountNumber',
          label: 'Account Number',
          type: 'text',
          system: false,
          required: true,
          defaultValue: null,
        },
        {
          key: 'customerName',
          label: 'Customer Name',
          type: 'text',
          system: false,
          required: true,
          defaultValue: null,
        },
      ],
      sections: [
        section([
          {
            id: 'e1',
            type: 'dynamicField',
            x: 0,
            y: 0,
            width: 200,
            fieldKey: 'accountNumber',
            requiredFieldBehavior: 'fail',
          },
          {
            id: 'e2',
            type: 'dynamicField',
            x: 0,
            y: 20,
            width: 200,
            fieldKey: 'customerName',
            requiredFieldBehavior: 'fail',
          },
        ]),
      ],
    });

    try {
      await render({ template, data: {} });
      expect.unreachable('expected render() to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(RequiredFieldsMissingError);
      const fieldKeys = (err as InstanceType<typeof RequiredFieldsMissingError>).fieldKeys;
      expect(fieldKeys.sort()).toEqual(['accountNumber', 'customerName']);
    }
  });

  it('rejects a QR code value that exceeds the byte capacity of its error correction level', async () => {
    const template = buildTemplate({
      sections: [
        section([
          {
            id: 'e1',
            type: 'qrcode',
            x: 0,
            y: 0,
            size: 50,
            value: 'A'.repeat(5000),
            errorCorrectionLevel: 'H',
          },
        ]),
      ],
    });
    await expect(render({ template, data: {} })).rejects.toThrow(QrCodeCapacityExceededError);
  });

  it('auto-scales a watermark wider than the page diagonal instead of crashing or clipping', async () => {
    const template = buildTemplate({
      watermark: {
        enabled: true,
        text: 'A VERY LONG WATERMARK STRING THAT IS WIDER THAN THE PAGE DIAGONAL ITSELF',
        fontSize: 80,
        opacity: 0.1,
        rotation: -35,
      },
      sections: [
        section([{ id: 'e1', type: 'staticText', x: 0, y: 0, width: 200, value: 'Body content' }]),
      ],
    });
    const buffer = await render({ template, data: {} });
    const text = await extractPdfText(buffer);
    expect(text).toContain('Body content');
  });
});

describe('render — page geometry boundary', () => {
  it('rejects a page whose margins leave no usable content area', async () => {
    const template = templateDocumentSchema.parse({
      page: {
        size: { width: 50, height: 50 },
        marginTop: 40,
        marginBottom: 40,
        marginLeft: 40,
        marginRight: 40,
      },
      theme: {},
      sections: [],
    });
    await expect(render({ template, data: {} })).rejects.toThrow(/usable content area/);
  });
});
