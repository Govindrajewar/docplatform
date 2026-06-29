import { z } from 'zod';

import { templateDocumentSchema } from './template';

export const TEMPLATE_STATUSES = ['draft', 'published', 'archived'] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

// Deliberately a free-form string, not a fixed enum — PRD 01 §1.2's "zero-code document
// onboarding" goal means a brand-new document type must never require a code change.
export const documentTypeSchema = z.string().trim().min(1).max(50);

export const createTemplateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  documentType: documentTypeSchema,
  tags: z.array(z.string().trim().max(50)).default([]),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  documentType: documentTypeSchema.optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
});
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

// `baseVersionNumber` is the version the client last loaded — omitted, the save is unconditional;
// provided and stale, the server rejects with 409 STALE_VERSION (PRD 10 §10.3).
export const saveTemplateVersionSchema = z.object({
  layoutJson: templateDocumentSchema,
  changeNote: z.string().trim().max(500).optional(),
  baseVersionNumber: z.number().int().positive().optional(),
});
export type SaveTemplateVersionInput = z.infer<typeof saveTemplateVersionSchema>;

// `layoutJson` lets the Designer preview an unsaved draft directly (PRD 06 §6.5); omitted, the
// server previews a persisted version instead (`versionId`, or the template's latest).
export const previewTemplateSchema = z.object({
  versionId: z.string().optional(),
  layoutJson: templateDocumentSchema.optional(),
  sampleData: z.record(z.string(), z.unknown()).default({}),
});
export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>;

export const importTemplateBundleSchema = z.object({
  name: z.string().trim().min(2).max(200),
  documentType: documentTypeSchema,
  layoutJson: templateDocumentSchema,
});
export type ImportTemplateBundleInput = z.infer<typeof importTemplateBundleSchema>;
