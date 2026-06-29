import { create } from 'zustand';
import type { Section, TemplateDocument, TemplateElement } from '@platform/shared';

export type ElementContainer =
  | { kind: 'header' }
  | { kind: 'footer' }
  | { kind: 'section'; sectionId: string };

interface DesignerState {
  templateId: string | null;
  /** The loaded/last-saved version's id and number — distinct from the template's *published*
   * `currentVersionId`, since the designer is usually editing a newer draft on top of it. */
  currentVersionId: string | null;
  baseVersionNumber: number | null;
  layout: TemplateDocument | null;
  selectedElementId: string | null;
  /** Where ElementPalette adds the next new element — independent of which existing element (if
   * any) is currently selected, since selecting an element doesn't always imply you want to add
   * the next one next to it (e.g. nothing may be selected at all). */
  activeContainer: ElementContainer | null;
  dirty: boolean;

  load: (
    templateId: string,
    versionId: string,
    versionNumber: number,
    layout: TemplateDocument,
  ) => void;
  markSaved: (versionId: string, versionNumber: number, layout: TemplateDocument) => void;
  select: (elementId: string | null) => void;
  setActiveContainer: (container: ElementContainer) => void;

  addElement: (container: ElementContainer, element: TemplateElement) => void;
  updateElement: (elementId: string, patch: Partial<TemplateElement>) => void;
  removeElement: (elementId: string) => void;

  addSection: () => void;
  removeSection: (sectionId: string) => void;

  setPage: (patch: Partial<TemplateDocument['page']>) => void;
  setTheme: (patch: Partial<TemplateDocument['theme']>) => void;
}

function cloneLayout(layout: TemplateDocument): TemplateDocument {
  return structuredClone(layout);
}

function elementTreeFor(layout: TemplateDocument, container: ElementContainer): TemplateElement[] {
  if (container.kind === 'header')
    return (layout.header ??= { height: 90, elements: [], repeatOnEveryPage: true }).elements;
  if (container.kind === 'footer')
    return (layout.footer ??= { height: 50, elements: [], repeatOnEveryPage: true }).elements;
  const section = layout.sections.find((s) => s.id === container.sectionId);
  if (!section) throw new Error(`Section "${container.sectionId}" not found`);
  return section.elements;
}

function allContainers(layout: TemplateDocument): TemplateElement[][] {
  const trees = [layout.header?.elements, layout.footer?.elements].filter(
    (t): t is TemplateElement[] => Boolean(t),
  );
  for (const section of layout.sections) trees.push(section.elements);
  return trees;
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
  templateId: null,
  currentVersionId: null,
  baseVersionNumber: null,
  layout: null,
  selectedElementId: null,
  activeContainer: null,
  dirty: false,

  load: (templateId, versionId, versionNumber, layout) =>
    set({
      templateId,
      currentVersionId: versionId,
      baseVersionNumber: versionNumber,
      layout: cloneLayout(layout),
      selectedElementId: null,
      activeContainer: layout.sections[0]
        ? { kind: 'section', sectionId: layout.sections[0].id }
        : null,
      dirty: false,
    }),

  markSaved: (versionId, versionNumber, layout) =>
    set({
      currentVersionId: versionId,
      baseVersionNumber: versionNumber,
      layout: cloneLayout(layout),
      dirty: false,
    }),

  select: (elementId) => set({ selectedElementId: elementId }),
  setActiveContainer: (container) => set({ activeContainer: container }),

  addElement: (container, element) => {
    const layout = get().layout;
    if (!layout) return;
    const next = cloneLayout(layout);
    elementTreeFor(next, container).push(element);
    set({ layout: next, dirty: true, selectedElementId: element.id });
  },

  updateElement: (elementId, patch) => {
    const layout = get().layout;
    if (!layout) return;
    const next = cloneLayout(layout);
    for (const tree of allContainers(next)) {
      const index = tree.findIndex((el) => el.id === elementId);
      if (index !== -1) {
        tree[index] = { ...tree[index], ...patch } as TemplateElement;
        break;
      }
    }
    set({ layout: next, dirty: true });
  },

  removeElement: (elementId) => {
    const layout = get().layout;
    if (!layout) return;
    const next = cloneLayout(layout);
    if (next.header) next.header.elements = next.header.elements.filter((e) => e.id !== elementId);
    if (next.footer) next.footer.elements = next.footer.elements.filter((e) => e.id !== elementId);
    next.sections = next.sections.map((section) => ({
      ...section,
      elements: section.elements.filter((e) => e.id !== elementId),
    }));
    set({
      layout: next,
      dirty: true,
      selectedElementId: get().selectedElementId === elementId ? null : get().selectedElementId,
    });
  },

  addSection: () => {
    const layout = get().layout;
    if (!layout) return;
    const next = cloneLayout(layout);
    const newSection: Section = {
      id: `section-${Date.now().toString(36)}`,
      type: 'static',
      elements: [],
      pageBreakBefore: false,
      keepTogether: false,
    };
    next.sections.push(newSection);
    set({
      layout: next,
      dirty: true,
      activeContainer: { kind: 'section', sectionId: newSection.id },
    });
  },

  removeSection: (sectionId) => {
    const layout = get().layout;
    if (!layout) return;
    const next = cloneLayout(layout);
    next.sections = next.sections.filter((s) => s.id !== sectionId);
    const activeContainer = get().activeContainer;
    set({
      layout: next,
      dirty: true,
      activeContainer:
        activeContainer?.kind === 'section' && activeContainer.sectionId === sectionId
          ? next.sections[0]
            ? { kind: 'section', sectionId: next.sections[0].id }
            : null
          : activeContainer,
    });
  },

  setPage: (patch) => {
    const layout = get().layout;
    if (!layout) return;
    set({ layout: { ...cloneLayout(layout), page: { ...layout.page, ...patch } }, dirty: true });
  },

  setTheme: (patch) => {
    const layout = get().layout;
    if (!layout) return;
    set({ layout: { ...cloneLayout(layout), theme: { ...layout.theme, ...patch } }, dirty: true });
  },
}));

/** Short, readable, collision-resistant enough for a single-template element list (PRD 10 §10.3
 * rejects duplicate ids, so this only needs to avoid colliding within one template's elements). */
export function generateElementId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
