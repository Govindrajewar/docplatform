import { z } from 'zod';

import {
  baseElementSchema,
  formatOptionsSchema,
  formatTypeSchema,
  hexColorSchema,
} from './common.schema';

const textElementSchema = baseElementSchema.extend({
  type: z.literal('text'),
  value: z.string(),
  lineHeight: z.number().positive().optional(),
  maxLines: z.number().int().positive().optional(),
  overflow: z.enum(['clip', 'ellipsis', 'wrap']).default('wrap'),
});

const staticTextElementSchema = baseElementSchema.extend({
  type: z.literal('staticText'),
  value: z.string(),
});

const dynamicFieldElementSchema = baseElementSchema.extend({
  type: z.literal('dynamicField'),
  fieldKey: z.string().min(1),
  format: formatTypeSchema.default('text'),
  formatOptions: formatOptionsSchema.optional(),
  requiredFieldBehavior: z.enum(['blank', 'placeholder', 'fail']).default('blank'),
  placeholder: z.string().optional(),
});

const dateElementSchema = baseElementSchema.extend({
  type: z.literal('date'),
  fieldKey: z.string().min(1),
  format: z.string().default('YYYY-MM-DD'),
  timezone: z.string().optional(),
});

const currencyElementSchema = baseElementSchema.extend({
  type: z.literal('currency'),
  fieldKey: z.string().min(1),
  currencyCode: z.string().length(3).optional(),
  decimalPlaces: z.number().int().min(0).max(6).default(2),
  locale: z.string().optional(),
});

const checkboxElementSchema = baseElementSchema.extend({
  type: z.literal('checkbox'),
  fieldKey: z.string().optional(),
  checked: z.union([z.boolean(), z.string()]).default(false),
  checkedGlyph: z.string().default('X'),
  uncheckedGlyph: z.string().default(''),
});

const imageElementSchema = baseElementSchema.extend({
  type: z.literal('image'),
  src: z.string().min(1),
  fit: z.enum(['contain', 'cover', 'stretch']).default('contain'),
});

const dividerElementSchema = baseElementSchema.extend({
  type: z.literal('divider'),
  thickness: z.number().positive().default(1),
  dashed: z.boolean().default(false),
});

const lineElementSchema = baseElementSchema.extend({
  type: z.literal('line'),
  thickness: z.number().positive().default(1),
  dashed: z.boolean().default(false),
});

const rectangleElementSchema = baseElementSchema.extend({
  type: z.literal('rectangle'),
  fill: hexColorSchema.nullable().optional(),
});

const circleElementSchema = baseElementSchema.extend({
  type: z.literal('circle'),
  radius: z.number().positive(),
  fill: hexColorSchema.nullable().optional(),
});

const qrcodeElementSchema = baseElementSchema.extend({
  type: z.literal('qrcode'),
  value: z.string().min(1),
  size: z.number().positive(),
  errorCorrectionLevel: z.enum(['L', 'M', 'Q', 'H']).default('M'),
  foregroundColor: hexColorSchema.default('#000000'),
  backgroundColor: hexColorSchema.default('#FFFFFF'),
});

const barcodeElementSchema = baseElementSchema.extend({
  type: z.literal('barcode'),
  value: z.string().min(1),
  symbology: z.enum(['code128', 'ean13', 'upc']).default('code128'),
  size: z.number().positive(),
  showText: z.boolean().default(true),
});

const signatureElementSchema = baseElementSchema.extend({
  type: z.literal('signature'),
  src: z.string().optional(),
  placeholderLabel: z.string().default('Signature'),
});

const tableColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  width: z.number().positive(),
  align: z.enum(['left', 'center', 'right']).default('left'),
  format: formatTypeSchema.default('text'),
  formatOptions: formatOptionsSchema.optional(),
  runningTotal: z.boolean().default(false),
});
export type TableColumn = z.infer<typeof tableColumnSchema>;

const tableElementSchema = baseElementSchema.extend({
  type: z.literal('table'),
  dataSource: z.string().min(1),
  columns: z.array(tableColumnSchema).min(1),
  headerStyle: z
    .object({
      background: hexColorSchema.optional(),
      color: hexColorSchema.optional(),
      fontWeight: z.union([z.enum(['normal', 'bold']), z.number()]).optional(),
    })
    .default({}),
  rowHeight: z.number().positive().default(20),
  alternatingRowColors: z.tuple([hexColorSchema, hexColorSchema]).optional(),
  borders: z
    .object({
      horizontal: z.boolean().default(true),
      vertical: z.boolean().default(false),
      color: hexColorSchema.default('#E5E7EB'),
    })
    .default({}),
  repeatHeaderOnEveryPage: z.boolean().default(true),
  grandTotals: z.array(z.object({ columnKey: z.string().min(1), label: z.string() })).default([]),
  emptyState: z
    .object({ text: z.string(), fontStyle: z.enum(['normal', 'italic']).default('normal') })
    .optional(),
  maxRowsPerPage: z.number().int().positive().nullable().default(null),
});
export type TableElement = z.infer<typeof tableElementSchema>;

export const elementSchema = z.discriminatedUnion('type', [
  textElementSchema,
  staticTextElementSchema,
  dynamicFieldElementSchema,
  dateElementSchema,
  currencyElementSchema,
  checkboxElementSchema,
  imageElementSchema,
  tableElementSchema,
  dividerElementSchema,
  lineElementSchema,
  rectangleElementSchema,
  circleElementSchema,
  qrcodeElementSchema,
  barcodeElementSchema,
  signatureElementSchema,
]);
export type TemplateElement = z.infer<typeof elementSchema>;
export type ElementType = TemplateElement['type'];
