import { Router } from 'express';
import { updateSettingsSchema } from '@platform/shared';

import { authenticate } from '../../middleware/authenticate';
import { recordAudit } from '../../middleware/audit';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';

import { settingsController } from './settings.controller';

export const settingsRouter = Router();

settingsRouter.use(authenticate);

/**
 * @openapi
 * /settings:
 *   get:
 *     tags: [Settings]
 *     summary: Get the caller's organization preferences
 *     responses:
 *       '200':
 *         description: Settings (defaults are returned if none have been saved yet)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     theme: { type: string, example: light }
 *                     language: { type: string, example: en }
 *                     defaultCurrency: { type: string, example: USD }
 *                     defaultTimezone: { type: string, example: UTC }
 *                     defaultPaperSize: { type: string, example: A4 }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 */
settingsRouter.get('/', requirePermission('settings:read'), settingsController.get);

/**
 * @openapi
 * /settings:
 *   patch:
 *     tags: [Settings]
 *     summary: Update organization preferences
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               theme: { type: string }
 *               language: { type: string, minLength: 2, maxLength: 10 }
 *               defaultCurrency: { type: string, minLength: 3, maxLength: 3, example: USD }
 *               defaultTimezone: { type: string, example: America/New_York }
 *               defaultPaperSize: { type: string, example: A4 }
 *     responses:
 *       '200':
 *         description: Updated settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '422':
 *         $ref: '#/components/responses/ValidationError'
 */
settingsRouter.patch(
  '/',
  requirePermission('settings:write'),
  validate(updateSettingsSchema),
  recordAudit('settings.update', 'organization'),
  settingsController.update,
);
