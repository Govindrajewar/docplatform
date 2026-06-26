import { z } from 'zod';

import { PAPER_SIZES, THEMES } from '../constants/assets';

export const updateSettingsSchema = z.object({
  theme: z.enum(THEMES).optional(),
  language: z.string().trim().min(2).max(10).optional(),
  defaultCurrency: z.string().length(3).optional(),
  defaultTimezone: z.string().min(1).optional(),
  defaultPaperSize: z.enum(PAPER_SIZES).optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
