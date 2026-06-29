import type { TemplateDocument } from '@platform/shared';

import type { AssetMap } from '../../engine/types';
import { assetsRepository } from '../assets/assets.repository';
import { storageDriver } from '../../storage';
import type { TenantContext } from '../users/users.repository';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const TOKEN_PATTERN = /^\{\{.+\}\}$/;

function asLiteralAssetId(value: unknown): string | null {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value) && !TOKEN_PATTERN.test(value)
    ? value
    : null;
}

/**
 * Literal (non-token) asset references baked directly into the template JSON — an admin picking
 * a fixed logo/signature image or a custom embedded font in the Designer, as opposed to a
 * `{{token}}` that only resolves against per-document data at generation time. Only literal
 * references can be validated at publish time (PRD 10 §10.3) — token-resolved ones depend on
 * data that doesn't exist yet.
 */
export function collectLiteralAssetReferences(layoutJson: TemplateDocument): string[] {
  const ids = new Set<string>();

  const fontId = asLiteralAssetId(layoutJson.theme.fontFamily);
  if (fontId) ids.add(fontId);

  const elementTrees = [layoutJson.header?.elements ?? [], layoutJson.footer?.elements ?? []];
  for (const section of layoutJson.sections) elementTrees.push(section.elements);

  for (const element of elementTrees.flat()) {
    const fontId2 = asLiteralAssetId((element as { font?: unknown }).font);
    if (fontId2) ids.add(fontId2);

    if (element.type === 'image' || element.type === 'signature') {
      const srcId = asLiteralAssetId((element as { src?: unknown }).src);
      if (srcId) ids.add(srcId);
    }
  }

  return [...ids];
}

/** Best-effort id-shaped strings anywhere in the sample data context — covers token-resolved
 * asset references (e.g. `{{organization.logoAssetId}}`) for the preview fast-path, where
 * over-collecting is harmless (`buildAssetMap` silently skips ids that aren't real assets). */
function collectObjectIdStrings(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    if (OBJECT_ID_PATTERN.test(value)) out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectObjectIdStrings(item, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectObjectIdStrings(item, out);
  }
}

export function collectPreviewAssetReferences(
  layoutJson: TemplateDocument,
  sampleData: unknown,
): string[] {
  const ids = new Set(collectLiteralAssetReferences(layoutJson));
  collectObjectIdStrings(sampleData, ids);
  return [...ids];
}

export async function buildAssetMap(ctx: TenantContext, assetIds: string[]): Promise<AssetMap> {
  const map: AssetMap = {};
  await Promise.all(
    assetIds.map(async (id) => {
      const asset = await assetsRepository.findById(ctx, id);
      if (!asset) return;
      const buffer = await storageDriver.read(asset.storageKey);
      map[id] = { buffer, mimeType: asset.mimeType };
    }),
  );
  return map;
}

/** Publish-time guard (PRD 10 §10.3): every literal asset reference in a version must resolve
 * within this org, or publish is blocked with the list of broken references. */
export async function findBrokenAssetReferences(
  ctx: TenantContext,
  layoutJson: TemplateDocument,
): Promise<string[]> {
  const ids = collectLiteralAssetReferences(layoutJson);
  const broken: string[] = [];
  await Promise.all(
    ids.map(async (id) => {
      const asset = await assetsRepository.findById(ctx, id);
      if (!asset) broken.push(id);
    }),
  );
  return broken;
}
