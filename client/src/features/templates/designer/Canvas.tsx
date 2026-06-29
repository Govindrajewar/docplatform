import { ElementBox } from './ElementBox';
import { resolvePageSize } from './page-sizes';

import { useDesignerStore } from '@/stores/designer.store';
import { cn } from '@/lib/cn';

const MIN_SECTION_HEIGHT = 120;

export function Canvas() {
  const layout = useDesignerStore((s) => s.layout);
  const activeContainer = useDesignerStore((s) => s.activeContainer);
  const setActiveContainer = useDesignerStore((s) => s.setActiveContainer);
  const select = useDesignerStore((s) => s.select);
  const removeSection = useDesignerStore((s) => s.removeSection);

  if (!layout) return null;
  const { width } = resolvePageSize(layout.page.size);
  const bodyWidth = width - layout.page.marginLeft - layout.page.marginRight;

  return (
    <div
      className="mx-auto flex flex-col bg-white shadow-md"
      style={{ width }}
      onPointerDown={() => select(null)}
    >
      {layout.header && (
        <div
          className="relative border-b border-dashed border-muted-foreground/30 bg-muted/10"
          style={{
            height: layout.header.height,
            marginLeft: layout.page.marginLeft,
            marginRight: layout.page.marginRight,
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setActiveContainer({ kind: 'header' });
          }}
        >
          <span className="absolute -top-4 left-0 text-[10px] text-muted-foreground">Header</span>
          {layout.header.elements.map((el) => (
            <ElementBox key={el.id} element={el} />
          ))}
        </div>
      )}

      <div
        className="flex flex-col gap-3 py-3"
        style={{ marginLeft: layout.page.marginLeft, marginRight: layout.page.marginRight }}
      >
        {layout.sections.map((section) => {
          const maxY = section.elements.reduce(
            (max, el) =>
              Math.max(
                max,
                el.y + (el.height === 'auto' || el.height === undefined ? 24 : el.height),
              ),
            0,
          );
          const isActive =
            activeContainer?.kind === 'section' && activeContainer.sectionId === section.id;
          return (
            <div
              key={section.id}
              className={cn(
                'relative border',
                isActive ? 'border-primary' : 'border-dashed border-muted-foreground/30',
              )}
              style={{ width: bodyWidth, height: Math.max(MIN_SECTION_HEIGHT, maxY + 16) }}
              onPointerDown={(e) => {
                e.stopPropagation();
                setActiveContainer({ kind: 'section', sectionId: section.id });
              }}
            >
              <div className="absolute -top-5 left-0 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Section: {section.id}</span>
                <button
                  type="button"
                  className="text-destructive hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSection(section.id);
                  }}
                >
                  remove
                </button>
              </div>
              {section.elements.map((el) => (
                <ElementBox key={el.id} element={el} />
              ))}
            </div>
          );
        })}
        {layout.sections.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No sections yet — add one from the panel on the right.
          </p>
        )}
      </div>

      {layout.footer && (
        <div
          className="relative border-t border-dashed border-muted-foreground/30 bg-muted/10"
          style={{
            height: layout.footer.height,
            marginLeft: layout.page.marginLeft,
            marginRight: layout.page.marginRight,
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setActiveContainer({ kind: 'footer' });
          }}
        >
          <span className="absolute -top-4 left-0 text-[10px] text-muted-foreground">Footer</span>
          {layout.footer.elements.map((el) => (
            <ElementBox key={el.id} element={el} />
          ))}
        </div>
      )}
    </div>
  );
}
