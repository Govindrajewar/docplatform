import { z } from 'zod';

export const DOCUMENT_STATUSES = ['draft', 'generating', 'generated', 'failed'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const createDocumentSchema = z.object({
  templateId: z.string().min(1),
  customerId: z.string().optional(),
  dataPayload: z.record(z.string(), z.unknown()).default({}),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
