import { z } from 'zod';

export const DOCUMENT_STATUSES = ['draft', 'generating', 'generated', 'failed'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const createDocumentSchema = z.object({
  templateId: z.string().min(1),
  customerId: z.string().optional(),
  dataPayload: z.record(z.string(), z.unknown()).default({}),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

// Rejected up front rather than silently truncated (PRD 06 §6.3 / 10 §10.6).
export const MAX_IMPORT_ROWS = 50_000;

// Each row is keyed by a template field's dotted `key` (e.g. "customer.name",
// "document.amount"), already mapped client-side from the suggested mapping returned by
// `/documents/import` — plus an optional reserved `customerId` key to link an existing customer.
export const bulkGenerateSchema = z.object({
  templateId: z.string().min(1),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(MAX_IMPORT_ROWS),
});
export type BulkGenerateInput = z.infer<typeof bulkGenerateSchema>;
