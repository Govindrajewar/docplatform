import type { TemplateDocument, TemplateElement } from '@platform/shared';

export interface TemplateVersionDiff {
  added: string[];
  removed: string[];
  modified: { id: string; changedKeys: string[] }[];
}

function flattenElements(layoutJson: TemplateDocument): Map<string, TemplateElement> {
  const trees = [layoutJson.header?.elements ?? [], layoutJson.footer?.elements ?? []];
  for (const section of layoutJson.sections) trees.push(section.elements);

  const byId = new Map<string, TemplateElement>();
  for (const element of trees.flat()) byId.set(element.id, element);
  return byId;
}

function changedKeysBetween(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) changed.push(key);
  }
  return changed;
}

/**
 * Structural diff keyed by element `id`, not array position — an element that moved AND was
 * restyled is reported once as "modified", never as a delete+add pair (PRD 10 §10.3).
 */
export function diffTemplateVersions(
  from: TemplateDocument,
  to: TemplateDocument,
): TemplateVersionDiff {
  const fromElements = flattenElements(from);
  const toElements = flattenElements(to);

  const added: string[] = [];
  const removed: string[] = [];
  const modified: { id: string; changedKeys: string[] }[] = [];

  for (const [id, element] of toElements) {
    const previous = fromElements.get(id);
    if (!previous) {
      added.push(id);
      continue;
    }
    const changedKeys = changedKeysBetween(
      previous as unknown as Record<string, unknown>,
      element as unknown as Record<string, unknown>,
    );
    if (changedKeys.length > 0) modified.push({ id, changedKeys });
  }

  for (const id of fromElements.keys()) {
    if (!toElements.has(id)) removed.push(id);
  }

  return { added, removed, modified };
}
