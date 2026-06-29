import { Router } from 'express';
import { updateOrganizationSchema } from '@platform/shared';

import { authenticate } from '../../middleware/authenticate';
import { recordAudit } from '../../middleware/audit';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';

import { organizationsController } from './organizations.controller';

export const organizationsRouter = Router();

organizationsRouter.use(authenticate);

// v1 scope: every authenticated user belongs to exactly one organization (their own) — see PRD 03 §3.3.
/**
 * @openapi
 * /organizations/mine:
 *   get:
 *     tags: [Organizations]
 *     summary: Get the caller's own organization
 *     responses:
 *       '200':
 *         description: The organization
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
 */
organizationsRouter.get(
  '/mine',
  requirePermission('organizations:read'),
  organizationsController.getMine,
);

/**
 * @openapi
 * /organizations/mine:
 *   patch:
 *     tags: [Organizations]
 *     summary: Update the caller's organization profile/branding
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 120 }
 *               primaryColor: { type: string, example: '#002970' }
 *               secondaryColor: { type: string, example: '#1F6FEB' }
 *               isActive: { type: boolean }
 *     responses:
 *       '200':
 *         description: Updated organization
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
organizationsRouter.patch(
  '/mine',
  requirePermission('organizations:write'),
  validate(updateOrganizationSchema),
  recordAudit('organization.update', 'organization'),
  organizationsController.updateMine,
);
