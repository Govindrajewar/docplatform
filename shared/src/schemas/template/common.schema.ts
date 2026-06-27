import { z } from 'zod';

export const PAGE_SIZE_NAMES = ['A4', 'LETTER', 'LEGAL'] as const;

export const pageSizeSchema = z.union([
  z.enum(PAGE_SIZE_NAMES),
  z.object({ width: z.number().positive(), height: z.number().positive() }),
]);

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 6-digit hex color, e.g. #002970');

const spacingSchema = z.union([
  z.number(),
  z.object({
    top: z.number().default(0),
    right: z.number().default(0),
    bottom: z.number().default(0),
    left: z.number().default(0),
  }),
]);

export const borderSchema = z.object({
  width: z.number().positive(),
  color: hexColorSchema,
  style: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
});

/** `resource.path.to.value` — dot-notation only, no function calls (PRD 04 §4.7). */
export const tokenPathSchema = z.string().regex(/^\{\{[\w.]+\}\}$/);

export const formatTypeSchema = z.enum(['text', 'number', 'currency', 'date', 'percentage']);

export const formatOptionsSchema = z
  .object({
    pattern: z.string().optional(),
    currencyCode: z.string().length(3).optional(),
    decimalPlaces: z.number().int().min(0).max(6).optional(),
    locale: z.string().optional(),
    timezone: z.string().optional(),
  })
  .partial();

export const baseElementSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.union([z.number().positive(), z.literal('auto')]).optional(),
  height: z.union([z.number().positive(), z.literal('auto')]).optional(),
  padding: spacingSchema.optional(),
  margin: spacingSchema.optional(),
  border: borderSchema.optional(),
  borderRadius: z.number().min(0).optional(),
  font: z.string().optional(),
  fontSize: z.number().positive().optional(),
  fontWeight: z.union([z.enum(['normal', 'bold']), z.number()]).optional(),
  color: hexColorSchema.optional(),
  align: z.enum(['left', 'center', 'right', 'justify']).default('left'),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).default('top'),
  background: hexColorSchema.nullable().optional(),
  rotation: z.number().optional(),
  visibility: z.enum(['visible', 'hidden']).default('visible'),
  visibleIf: z.string().nullable().optional(),
  zIndex: z.number().default(0),
});
export type BaseElement = z.infer<typeof baseElementSchema>;
export type Spacing = z.infer<typeof spacingSchema>;
export type Border = z.infer<typeof borderSchema>;
export type FormatType = z.infer<typeof formatTypeSchema>;
export type FormatOptions = z.infer<typeof formatOptionsSchema>;
