import {
  elementSchema,
  templateDocumentSchema,
  type TableElement,
  type TemplateDocument,
  type TemplateElement,
} from '@platform/shared';

export function buildTable(overrides: Record<string, unknown> = {}): TableElement {
  return elementSchema.parse({
    id: 't1',
    type: 'table',
    x: 0,
    y: 0,
    dataSource: 'items',
    columns: [
      { key: 'description', label: 'Description', width: 200 },
      { key: 'amount', label: 'Amount', width: 100, format: 'currency' },
    ],
    ...overrides,
  }) as TableElement;
}

export function buildElement(overrides: Record<string, unknown>): TemplateElement {
  return elementSchema.parse({ id: 'e1', x: 0, y: 0, ...overrides });
}

export function buildTemplate(overrides: Record<string, unknown> = {}): TemplateDocument {
  return templateDocumentSchema.parse({
    page: { size: 'A4', marginTop: 40, marginBottom: 40, marginLeft: 40, marginRight: 40 },
    theme: { baseFontSize: 10 },
    sections: [],
    ...overrides,
  });
}
