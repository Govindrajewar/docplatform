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

const templateDocumentShape = z.object({
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

/** Every element `id` in header/footer/sections, in document order — shared by the duplicate-id
 * check below and by the template-diff/asset-reference helpers that walk the same tree shape. */
function allElementIds(doc: z.infer<typeof templateDocumentShape>): string[] {
  const trees = [doc.header?.elements ?? [], doc.footer?.elements ?? []];
  for (const section of doc.sections) trees.push(section.elements);
  return trees.flat().map((element) => element.id);
}

// PRD 10 §10.3: two elements sharing an `id` within one template is rejected at save time, before
// it ever reaches the DB — enforced here so every caller (save, import, restore) gets it for free.
export const templateDocumentSchema = templateDocumentShape.superRefine((doc, ctx) => {
  const seen = new Set<string>();
  for (const id of allElementIds(doc)) {
    if (seen.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate element id "${id}" — element ids must be unique within a template`,
        path: ['sections'],
      });
    }
    seen.add(id);
  }
});
export type TemplateDocument = z.infer<typeof templateDocumentShape>;
