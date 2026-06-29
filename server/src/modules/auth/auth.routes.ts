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

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new organization and its first Admin user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationName, name, email, password]
 *             properties:
 *               organizationName: { type: string, minLength: 2, maxLength: 120, example: Acme Corp }
 *               name: { type: string, minLength: 2, maxLength: 120, example: Ada Admin }
 *               email: { type: string, format: email, example: ada@acme.test }
 *               password:
 *                 type: string
 *                 minLength: 10
 *                 description: Must contain an uppercase letter, a lowercase letter, and a number
 *                 example: SuperSecret123
 *     responses:
 *       '201':
 *         description: Organization and admin user created; a refresh-token cookie is also set
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { type: object }
 *                     accessToken: { type: string }
 *                 error: { nullable: true, example: null }
 *       '422':
 *         $ref: '#/components/responses/ValidationError'
 */
authRouter.post('/register', validate(registerSchema), authController.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     description: Rate-limited per IP+email (20/15min); the account itself locks for 15 minutes after 5 failed attempts, returning the same generic error either way to avoid enumeration.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: ada@acme.test }
 *               password: { type: string, example: SuperSecret123 }
 *     responses:
 *       '200':
 *         description: Authenticated; a refresh-token cookie is also set
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { type: object }
 *                     accessToken: { type: string }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         description: Invalid credentials, locked account, or suspended account
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       '429':
 *         description: Too many attempts from this IP+email pair
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
authRouter.post('/login', loginRateLimit, validate(loginSchema), authController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange the httpOnly refresh-token cookie for a new access token
 *     description: Reads the refresh token from the `refreshToken` cookie set by register/login — there is no request body. Rotates the refresh token on every call.
 *     security: []
 *     responses:
 *       '200':
 *         description: A new access token (and rotated refresh-token cookie)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { type: object }
 *                     accessToken: { type: string }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         description: No refresh-token cookie, or it is expired/invalid
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
authRouter.post('/refresh', authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Invalidate the current refresh token and clear its cookie
 *     responses:
 *       '200':
 *         description: Logged out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { message: { type: string, example: Logged out } } }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
authRouter.post('/logout', authenticate, authController.logout);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password-reset email
 *     description: Always returns 200 whether or not the email exists, to avoid leaking account existence. Rate-limited per IP+email (5/15min). The email contains a link to `/reset-password?token=...`.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: ada@acme.test }
 *     responses:
 *       '200':
 *         description: Always returned, regardless of whether the email exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string, example: 'If that email exists, a reset link was sent' }
 *                 error: { nullable: true, example: null }
 *       '429':
 *         description: Too many requests from this IP+email pair
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
authRouter.post(
  '/forgot-password',
  forgotPasswordRateLimit,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Set a new password using a reset token
 *     description: The token comes from the forgot-password or invite email link; it also covers an invited user setting their very first password.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, minLength: 10, example: NewSuperSecret456 }
 *     responses:
 *       '200':
 *         description: Password reset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties: { message: { type: string, example: 'Password has been reset' } }
 *                 error: { nullable: true, example: null }
 *       '422':
 *         description: Token is missing, expired, invalid, or the new password fails the strength check
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
authRouter.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current user, their role, and effective permissions
 *     responses:
 *       '200':
 *         description: The authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { type: object }
 *                     role: { type: string, example: admin }
 *                     permissions: { type: array, items: { type: string }, example: ['documents:read', 'documents:generate'] }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
authRouter.get('/me', authenticate, authController.me);
