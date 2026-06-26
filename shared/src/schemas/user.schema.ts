import { z } from 'zod';

import { SYSTEM_ROLES } from '../constants/roles';

import { emailSchema } from './auth.schema';

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  role: z.enum(SYSTEM_ROLES),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(SYSTEM_ROLES).optional(),
  status: z.enum(['active', 'invited', 'suspended', 'deleted']).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
