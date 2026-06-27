import { z } from 'zod';

import { hexColorSchema, pageSizeSchema } from './common.schema';
import { elementSchema } from './elements.schema';

const elementTreeSchema = z.object({
  height: z.number().nonnegative(),
  elements: z.array(elementSchema).default([]),
  repeatOnEveryPage: z.boolean().default(true),
});

const sectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['static', 'repeatable', 'conditional']).default('static'),
  visibleIf: z.string().nullable().optional(),
  elements: z.array(elementSchema).default([]),
  pageBreakBefore: z.boolean().default(false),
  keepTogether: z.boolean().default(false),
});
export type Section = z.infer<typeof sectionSchema>;

const fieldDefinitionSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  type: z.enum(['text', 'date', 'currency', 'number', 'boolean']).default('text'),
  system: z.boolean().default(false),
  required: z.boolean().default(false),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).nullable().default(null),
  validation: z.object({ pattern: z.string().optional() }).optional(),
});
export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;

export const templateDocumentSchema = z.object({
  page: z.object({
    size: pageSizeSchema.default('A4'),
    orientation: z.enum(['portrait', 'landscape']).default('portrait'),
    marginTop: z.number().nonnegative().default(36),
    marginBottom: z.number().nonnegative().default(36),
    marginLeft: z.number().nonnegative().default(40),
    marginRight: z.number().nonnegative().default(40),
    background: hexColorSchema.nullable().optional(),
  }),
  theme: z.object({
    primaryColor: hexColorSchema.default('#002970'),
    secondaryColor: hexColorSchema.default('#6B7280'),
    fontFamily: z.string().default('Helvetica'),
    baseFontSize: z.number().positive().default(10),
  }),
  header: elementTreeSchema.optional(),
  footer: elementTreeSchema.optional(),
  watermark: z
    .object({
      enabled: z.boolean().default(false),
      text: z.string().default(''),
      opacity: z.number().min(0).max(1).default(0.08),
      rotation: z.number().default(-35),
      fontSize: z.number().positive().default(80),
    })
    .optional(),
  sections: z.array(sectionSchema).default([]),
  fields: z.array(fieldDefinitionSchema).default([]),
});
export type TemplateDocument = z.infer<typeof templateDocumentSchema>;
