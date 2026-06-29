import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate';

import { dashboardController } from './dashboard.controller';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

/**
 * @openapi
 * /dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Aggregate KPI/activity summary
 *     description: Available to every authenticated role. `recentActivity` is only populated when the caller holds `logs:read` (Admin/Manager); otherwise it is `null`.
 *     responses:
 *       '200':
 *         description: The dashboard summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     kpis:
 *                       type: object
 *                       properties:
 *                         totalCustomers: { type: integer }
 *                         totalTemplates: { type: integer }
 *                         publishedTemplates: { type: integer }
 *                         totalDocuments: { type: integer }
 *                         documentsByStatus: { type: object }
 *                         totalAssets: { type: integer }
 *                         assetsStorageBytes: { type: integer }
 *                         documentsStorageBytes: { type: integer }
 *                         totalStorageBytes: { type: integer }
 *                     documentsOverTime:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties: { date: { type: string }, count: { type: integer } }
 *                     recentDocuments: { type: array, items: { type: object } }
 *                     recentActivity:
 *                       type: array
 *                       nullable: true
 *                       items: { type: object }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
dashboardRouter.get('/summary', dashboardController.summary);
