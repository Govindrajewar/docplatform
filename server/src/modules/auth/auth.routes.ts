import { Router } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@platform/shared';

import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';

import { authController } from './auth.controller';

export const authRouter = Router();

// Broader IP+email throttle, deliberately above the 5-attempt account lockout threshold in
// auth.service.ts — the account lockout is the primary brute-force defense and returns its own
// generic message; this is a backstop against distributed/automated abuse, not a duplicate of it.
const loginRateLimit = rateLimit({
  windowSeconds: 15 * 60,
  max: 20,
  keyPrefix: 'login',
  keyFn: (req) => `${req.ip}:${req.body?.email ?? 'unknown'}`,
});

const forgotPasswordRateLimit = rateLimit({
  windowSeconds: 15 * 60,
  max: 5,
  keyPrefix: 'forgot-password',
  keyFn: (req) => `${req.ip}:${req.body?.email ?? 'unknown'}`,
});

authRouter.post('/register', validate(registerSchema), authController.register);
authRouter.post('/login', loginRateLimit, validate(loginSchema), authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authenticate, authController.logout);
authRouter.post(
  '/forgot-password',
  forgotPasswordRateLimit,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
authRouter.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
authRouter.get('/me', authenticate, authController.me);
