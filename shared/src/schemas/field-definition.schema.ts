import { z } from 'zod';

import { CUSTOM_FIELD_KEY_PATTERN } from '../constants/system-fields';

const fieldTypeSchema = z.enum(['text', 'date', 'currency', 'number', 'boolean']);

export const createFieldDefinitionSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(CUSTOM_FIELD_KEY_PATTERN, 'Custom field keys must look like "custom.someName"'),
  label: z.string().trim().min(1).max(200),
  type: fieldTypeSchema.default('text'),
  required: z.boolean().default(false),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).nullable().default(null),
  validation: z.object({ pattern: z.string().optional() }).optional(),
});
export type CreateFieldDefinitionInput = z.infer<typeof createFieldDefinitionSchema>;

// Label/validation/required/defaultValue may change after creation; `key` and `type` cannot,
// since both are baked into any template that already references this field (PRD 05 §5.7).
export const updateFieldDefinitionSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  required: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).nullable().optional(),
  validation: z.object({ pattern: z.string().optional() }).optional(),
});
export type UpdateFieldDefinitionInput = z.infer<typeof updateFieldDefinitionSchema>;
