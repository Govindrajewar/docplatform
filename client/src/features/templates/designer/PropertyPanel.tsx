import type { ChangeEvent } from 'react';
import type { TemplateElement } from '@platform/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFieldDefinitions } from '@/features/field-definitions/api';
import { useDesignerStore } from '@/stores/designer.store';

function findElement(
  layout: ReturnType<typeof useDesignerStore.getState>['layout'],
  id: string,
): TemplateElement | null {
  if (!layout) return null;
  const trees = [layout.header?.elements ?? [], layout.footer?.elements ?? []];
  for (const section of layout.sections) trees.push(section.elements);
  for (const tree of trees) {
    const found = tree.find((el) => el.id === id);
    if (found) return found;
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function PropertyPanel() {
  const layout = useDesignerStore((s) => s.layout);
  const selectedElementId = useDesignerStore((s) => s.selectedElementId);
  const updateElement = useDesignerStore((s) => s.updateElement);
  const removeElement = useDesignerStore((s) => s.removeElement);
  const { data: fields } = useFieldDefinitions();

  if (!selectedElementId) {
    return (
      <p className="text-sm text-muted-foreground">Select an element to edit its properties.</p>
    );
  }
  const element = findElement(layout, selectedElementId);
  if (!element) return null;

  const num = (e: ChangeEvent<HTMLInputElement>) => Number(e.target.value) || 0;
  const patch = (p: Partial<TemplateElement>) => updateElement(element.id, p);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{element.type}</p>
        <Button variant="ghost" size="sm" onClick={() => removeElement(element.id)}>
          Delete
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="X">
          <Input type="number" value={element.x} onChange={(e) => patch({ x: num(e) })} />
        </Field>
        <Field label="Y">
          <Input type="number" value={element.y} onChange={(e) => patch({ y: num(e) })} />
        </Field>
        <Field label="Width">
          <Input
            type="number"
            value={typeof element.width === 'number' ? element.width : ''}
            placeholder="auto"
            onChange={(e) => patch({ width: num(e) })}
          />
        </Field>
        <Field label="Height">
          <Input
            type="number"
            value={typeof element.height === 'number' ? element.height : ''}
            placeholder="auto"
            onChange={(e) => patch({ height: num(e) })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Color">
          <Input
            type="text"
            value={element.color ?? ''}
            placeholder="#000000"
            onChange={(e) => patch({ color: e.target.value || undefined })}
          />
        </Field>
        <Field label="Font size">
          <Input
            type="number"
            value={element.fontSize ?? ''}
            onChange={(e) => patch({ fontSize: num(e) })}
          />
        </Field>
      </div>

      <Field label="Align">
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          value={element.align}
          onChange={(e) => patch({ align: e.target.value as TemplateElement['align'] })}
        >
          {(['left', 'center', 'right', 'justify'] as const).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </Field>

      <TypeSpecificFields
        element={element}
        fieldKeys={fields?.map((f) => f.key) ?? []}
        patch={patch}
      />
    </div>
  );
}

function TypeSpecificFields({
  element,
  fieldKeys,
  patch,
}: {
  element: TemplateElement;
  fieldKeys: string[];
  patch: (p: Partial<TemplateElement>) => void;
}) {
  switch (element.type) {
    case 'text':
    case 'staticText':
      return (
        <Field label="Value">
          <textarea
            className="min-h-20 rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={element.value}
            onChange={(e) => patch({ value: e.target.value })}
          />
        </Field>
      );
    case 'dynamicField':
    case 'date':
    case 'currency':
      return (
        <Field label="Field key">
          <select
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={element.fieldKey}
            onChange={(e) => patch({ fieldKey: e.target.value })}
          >
            <option value={element.fieldKey}>{element.fieldKey}</option>
            {fieldKeys
              .filter((k) => k !== element.fieldKey)
              .map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
          </select>
        </Field>
      );
    case 'image':
    case 'signature':
      return (
        <Field label="Asset id (or {{token}})">
          <Input
            value={element.src ?? ''}
            onChange={(e) => patch({ src: e.target.value })}
            placeholder="Upload on the Assets page, then paste its id here"
          />
        </Field>
      );
    case 'qrcode':
    case 'barcode':
      return (
        <>
          <Field label="Value (or {{token}})">
            <Input value={element.value} onChange={(e) => patch({ value: e.target.value })} />
          </Field>
          <Field label="Size">
            <Input
              type="number"
              value={element.size}
              onChange={(e) => patch({ size: Number(e.target.value) || 1 })}
            />
          </Field>
        </>
      );
    case 'rectangle':
    case 'circle':
      return (
        <Field label="Fill color">
          <Input
            value={element.fill ?? ''}
            onChange={(e) => patch({ fill: e.target.value || null })}
          />
        </Field>
      );
    case 'table':
      return (
        <>
          <Field label="Data source token">
            <Input
              value={element.dataSource}
              onChange={(e) => patch({ dataSource: e.target.value })}
            />
          </Field>
          <Field label="Columns (JSON)">
            <textarea
              className="min-h-32 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
              defaultValue={JSON.stringify(element.columns, null, 2)}
              onBlur={(e) => {
                try {
                  const columns = JSON.parse(e.target.value);
                  patch({ columns });
                } catch {
                  // leave the table's columns untouched until the JSON is valid again
                }
              }}
            />
          </Field>
        </>
      );
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(element.checked)}
            onChange={(e) => patch({ checked: e.target.checked })}
          />
          Checked
        </label>
      );
    case 'divider':
    case 'line':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={element.dashed}
            onChange={(e) => patch({ dashed: e.target.checked })}
          />
          Dashed
        </label>
      );
    default:
      return null;
  }
}
