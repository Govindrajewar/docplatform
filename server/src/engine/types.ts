import type { TemplateDocument } from '@platform/shared';

export type { TemplateDocument, TemplateElement } from '@platform/shared';

/** Arbitrary JSON-like data the template's tokens resolve against — see PRD 04 §4.7. */
export type DataContext = Record<string, unknown>;

/** Binary assets referenced by the template (logo, fonts, signature images), keyed by assetId. */
export interface EngineAsset {
  buffer: Buffer;
  mimeType: string;
}
export type AssetMap = Record<string, EngineAsset>;

export interface RenderOptions {
  template: TemplateDocument;
  data: DataContext;
  assets?: AssetMap;
  /** Hard ceiling on emitted pages — exceeding it aborts the render (PRD 10 §10.5). */
  maxPages?: number;
  /** Hard ceiling on a single table's row count (PRD 10 §10.4). */
  maxTableRows?: number;
}

export interface ResolvedTableRow {
  cells: Record<string, string>;
  raw: Record<string, unknown>;
}
