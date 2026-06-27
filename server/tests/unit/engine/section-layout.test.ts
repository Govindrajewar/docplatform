import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { FontRegistry } from '../../../src/engine/fonts/font-registry';
import { layoutElements } from '../../../src/engine/layout/section-layout';
import { buildElement, buildTemplate } from '../../helpers/template-fixtures';

async function layout(
  elements: ReturnType<typeof buildElement>[],
  data: Record<string, unknown> = {},
  missingFields = new Set<string>(),
) {
  const pdfDoc = await PDFDocument.create();
  const fontRegistry = new FontRegistry(pdfDoc, {});
  const template = buildTemplate();
  return layoutElements(elements, data, template, fontRegistry, 500, 0, 0, missingFields);
}

describe('layoutElements — visibility', () => {
  it('skips an element with visibility: hidden', async () => {
    const result = await layout([
      buildElement({ type: 'staticText', value: 'x', visibility: 'hidden' }),
    ]);
    expect(result.elements).toHaveLength(0);
  });

  it('skips an element whose visibleIf evaluates to false', async () => {
    const result = await layout(
      [buildElement({ type: 'staticText', value: 'x', visibleIf: '{{show}} == true' })],
      { show: false },
    );
    expect(result.elements).toHaveLength(0);
  });

  it('keeps an element whose visibleIf evaluates to true', async () => {
    const result = await layout(
      [buildElement({ type: 'staticText', value: 'x', visibleIf: '{{show}} == true' })],
      { show: true },
    );
    expect(result.elements).toHaveLength(1);
  });
});

describe('layoutElements — zIndex draw order', () => {
  it('sorts by zIndex ascending', async () => {
    const result = await layout([
      buildElement({ id: 'a', type: 'staticText', value: 'a', zIndex: 5 }),
      buildElement({ id: 'b', type: 'staticText', value: 'b', zIndex: 1 }),
      buildElement({ id: 'c', type: 'staticText', value: 'c', zIndex: 3 }),
    ]);
    expect(result.elements.map((p) => p.element.id)).toEqual(['b', 'c', 'a']);
  });

  it('preserves original array order as a stable tiebreaker for equal zIndex', async () => {
    const result = await layout([
      buildElement({ id: 'first', type: 'staticText', value: 'a', zIndex: 0 }),
      buildElement({ id: 'second', type: 'staticText', value: 'b', zIndex: 0 }),
      buildElement({ id: 'third', type: 'staticText', value: 'c', zIndex: 0 }),
    ]);
    expect(result.elements.map((p) => p.element.id)).toEqual(['first', 'second', 'third']);
  });
});

describe('layoutElements — required field behavior', () => {
  const fields = [
    {
      key: 'accountNumber',
      label: 'Account Number',
      type: 'text',
      system: false,
      required: true,
      defaultValue: null,
    },
  ];

  it('blank behavior (default) renders an empty string and records nothing', async () => {
    const missingFields = new Set<string>();
    const pdfDoc = await PDFDocument.create();
    const fontRegistry = new FontRegistry(pdfDoc, {});
    const template = buildTemplate({ fields });
    const result = await layoutElements(
      [buildElement({ type: 'dynamicField', fieldKey: 'accountNumber' })],
      {},
      template,
      fontRegistry,
      500,
      0,
      0,
      missingFields,
    );
    expect(result.elements[0]?.resolvedText).toBe('');
    expect(missingFields.size).toBe(0);
  });

  it('placeholder behavior renders the configured placeholder', async () => {
    const pdfDoc = await PDFDocument.create();
    const fontRegistry = new FontRegistry(pdfDoc, {});
    const template = buildTemplate({ fields });
    const result = await layoutElements(
      [
        buildElement({
          type: 'dynamicField',
          fieldKey: 'accountNumber',
          requiredFieldBehavior: 'placeholder',
          placeholder: 'N/A',
        }),
      ],
      {},
      template,
      fontRegistry,
      500,
      0,
      0,
      new Set(),
    );
    expect(result.elements[0]?.resolvedText).toBe('N/A');
  });

  it('fail behavior records the field key into the shared collector instead of throwing immediately', async () => {
    const missingFields = new Set<string>();
    const pdfDoc = await PDFDocument.create();
    const fontRegistry = new FontRegistry(pdfDoc, {});
    const template = buildTemplate({ fields });
    const result = await layoutElements(
      [
        buildElement({
          type: 'dynamicField',
          fieldKey: 'accountNumber',
          requiredFieldBehavior: 'fail',
        }),
      ],
      {},
      template,
      fontRegistry,
      500,
      0,
      0,
      missingFields,
    );
    expect(missingFields.has('accountNumber')).toBe(true);
    expect(result.elements).toHaveLength(1); // layout still completes — the caller decides when to abort
  });
});

describe('layoutElements — value resolution', () => {
  it('substitutes tokens in a "text" element but not in a "staticText" element', async () => {
    const result = await layout(
      [
        buildElement({ id: 'a', type: 'text', value: 'Hi {{name}}' }),
        buildElement({ id: 'b', type: 'staticText', value: 'Hi {{name}}' }),
      ],
      { name: 'Jane' },
    );
    expect(result.elements.find((p) => p.element.id === 'a')?.resolvedText).toBe('Hi Jane');
    expect(result.elements.find((p) => p.element.id === 'b')?.resolvedText).toBe('Hi {{name}}');
  });

  it('resolves a checkbox token to a boolean state and the right glyph', async () => {
    const result = await layout(
      [
        buildElement({
          type: 'checkbox',
          checked: '{{active}}',
          checkedGlyph: 'Y',
          uncheckedGlyph: 'N',
        }),
      ],
      { active: 'true' },
    );
    expect(result.elements[0]?.checkboxState).toBe(true);
    expect(result.elements[0]?.resolvedText).toBe('Y');
  });
});
