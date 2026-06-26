import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid 6-digit hex color, e.g. #002970');

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and hyphens')
    .min(2)
    .max(60),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  defaultCurrency: z.string().length(3).optional(),
  defaultTimezone: z.string().min(1).optional(),
  defaultPaperSize: z.enum(['A4', 'LETTER', 'LEGAL']).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
