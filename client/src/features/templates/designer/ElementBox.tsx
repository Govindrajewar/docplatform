import { useRef } from 'react';
import type { TemplateElement } from '@platform/shared';

import { cn } from '@/lib/cn';
import { useDesignerStore } from '@/stores/designer.store';

function elementPreviewLabel(element: TemplateElement): string {
  switch (element.type) {
    case 'text':
    case 'staticText':
      return element.value || '(empty text)';
    case 'dynamicField':
    case 'date':
    case 'currency':
      return `{{${element.fieldKey}}}`;
    case 'checkbox':
      return element.checked ? '☑ checkbox' : '☐ checkbox';
    case 'image':
      return `🖼 ${element.src || '(no asset)'}`;
    case 'signature':
      return `✍ ${element.src || element.placeholderLabel}`;
    case 'qrcode':
      return `▦ QR: ${element.value}`;
    case 'barcode':
      return `▥ Barcode: ${element.value}`;
    case 'table':
      return `▤ Table: ${element.dataSource} (${element.columns.length} cols)`;
    case 'divider':
    case 'line':
      return '';
    case 'rectangle':
    case 'circle':
      return '';
    default:
      // Exhaustive over every element type in the discriminated union — unreachable in practice.
      return (element as unknown as TemplateElement).id;
  }
}

interface ElementBoxProps {
  element: TemplateElement;
}

const MIN_SIZE = 8;

export function ElementBox({ element }: ElementBoxProps) {
  const selectedElementId = useDesignerStore((s) => s.selectedElementId);
  const select = useDesignerStore((s) => s.select);
  const updateElement = useDesignerStore((s) => s.updateElement);
  const dragState = useRef<{ startX: number; startY: number; elX: number; elY: number } | null>(
    null,
  );
  const resizeState = useRef<{ startX: number; startY: number; w: number; h: number } | null>(null);

  const isSelected = selectedElementId === element.id;
  const width = element.width === 'auto' || element.width === undefined ? 120 : element.width;
  const height = element.height === 'auto' || element.height === undefined ? 24 : element.height;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    select(element.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, elX: element.x, elY: element.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    updateElement(element.id, {
      x: Math.round(dragState.current.elX + dx),
      y: Math.round(dragState.current.elY + dy),
    });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragState.current) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      dragState.current = null;
    }
  };

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeState.current = { startX: e.clientX, startY: e.clientY, w: width, h: height };
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeState.current) return;
    const dx = e.clientX - resizeState.current.startX;
    const dy = e.clientY - resizeState.current.startY;
    updateElement(element.id, {
      width: Math.max(MIN_SIZE, Math.round(resizeState.current.w + dx)),
      height: Math.max(MIN_SIZE, Math.round(resizeState.current.h + dy)),
    });
  };

  const endResize = (e: React.PointerEvent) => {
    if (resizeState.current) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      resizeState.current = null;
    }
  };

  const isShape =
    element.type === 'rectangle' || element.type === 'divider' || element.type === 'line';

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      className={cn(
        'absolute cursor-move select-none overflow-hidden border text-[10px] leading-tight',
        isSelected
          ? 'border-primary ring-2 ring-primary/40'
          : 'border-dashed border-muted-foreground/40',
        !isShape && 'bg-white/80 px-1 py-0.5',
      )}
      style={{
        left: element.x,
        top: element.y,
        width,
        height,
        color: element.color,
        background:
          element.type === 'rectangle' || element.type === 'circle'
            ? (element.fill ?? undefined)
            : (element.background ?? undefined),
        borderRadius: element.type === 'circle' ? '50%' : element.borderRadius,
        fontSize: element.fontSize ?? 10,
        fontWeight: element.fontWeight === 'bold' ? 700 : undefined,
        textAlign: element.align,
      }}
      title={element.id}
    >
      {!isShape && <span className="block truncate">{elementPreviewLabel(element)}</span>}
      {isSelected && (
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={endResize}
          className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize bg-primary"
        />
      )}
    </div>
  );
}
