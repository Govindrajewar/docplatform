import { elementSchema, type ElementType, type TemplateElement } from '@platform/shared';

import { Button } from '@/components/ui/button';
import { generateElementId, useDesignerStore } from '@/stores/designer.store';

const PALETTE: { type: ElementType; label: string }[] = [
  { type: 'text', label: 'Text' },
  { type: 'staticText', label: 'Static Text' },
  { type: 'dynamicField', label: 'Dynamic Field' },
  { type: 'date', label: 'Date' },
  { type: 'currency', label: 'Currency' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'image', label: 'Image' },
  { type: 'signature', label: 'Signature' },
  { type: 'divider', label: 'Divider' },
  { type: 'rectangle', label: 'Rectangle' },
  { type: 'circle', label: 'Circle' },
  { type: 'qrcode', label: 'QR Code' },
  { type: 'barcode', label: 'Barcode' },
  { type: 'table', label: 'Table' },
];

/** Just enough per type to satisfy the shared zod schema's required fields — `elementSchema.parse`
 * fills in every other default (align, zIndex, etc.) the same way the server would. */
function draftFor(type: ElementType, id: string): unknown {
  const base = { id, x: 10, y: 10 };
  switch (type) {
    case 'text':
      return { ...base, type, value: 'Text', width: 140, height: 'auto' };
    case 'staticText':
      return { ...base, type, value: 'Label', width: 140 };
    case 'dynamicField':
      return { ...base, type, fieldKey: 'customer.name', format: 'text', width: 160 };
    case 'date':
      return { ...base, type, fieldKey: 'document.statementDate', width: 110 };
    case 'currency':
      return { ...base, type, fieldKey: 'document.amount', width: 110 };
    case 'checkbox':
      return { ...base, type, width: 16, height: 16 };
    case 'image':
      return { ...base, type, src: '', width: 80, height: 80 };
    case 'signature':
      return { ...base, type, width: 120, height: 50 };
    case 'divider':
    case 'line':
      return { ...base, type, width: 200, height: 1 };
    case 'rectangle':
      return { ...base, type, width: 100, height: 60, fill: '#E5E7EB' };
    case 'circle':
      return { ...base, type, radius: 30, width: 60, height: 60, fill: '#E5E7EB' };
    case 'qrcode':
      return {
        ...base,
        type,
        value: '{{document.referenceNumber}}',
        size: 80,
        width: 80,
        height: 80,
      };
    case 'barcode':
      return {
        ...base,
        type,
        value: '{{document.referenceNumber}}',
        size: 40,
        width: 160,
        height: 40,
      };
    case 'table':
      return {
        ...base,
        type,
        dataSource: '{{document.lineItems}}',
        columns: [
          { key: 'description', label: 'Description', width: 220 },
          { key: 'amount', label: 'Amount', width: 100, format: 'currency' },
        ],
        width: 320,
        height: 'auto',
      };
    default:
      return base;
  }
}

export function ElementPalette() {
  const activeContainer = useDesignerStore((s) => s.activeContainer);
  const addElement = useDesignerStore((s) => s.addElement);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">
        Adds to: {activeContainer ? containerLabel(activeContainer) : 'select a section first'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PALETTE.map(({ type, label }) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            size="sm"
            disabled={!activeContainer}
            onClick={() => {
              if (!activeContainer) return;
              const element = elementSchema.parse(
                draftFor(type, generateElementId(type)),
              ) as TemplateElement;
              addElement(activeContainer, element);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function containerLabel(container: { kind: string; sectionId?: string }): string {
  if (container.kind === 'header') return 'Header';
  if (container.kind === 'footer') return 'Footer';
  return `Section ${container.sectionId}`;
}
