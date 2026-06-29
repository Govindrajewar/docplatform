import { Router } from 'express';

import { isDatabaseReady } from '../../config/db';
import { isRedisReady } from '../../config/redis';
import { sendSuccess } from '../../utils/api-response';

export const healthRouter = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Liveness check
 *     description: Always returns 200 once the process is up — does not check downstream dependencies.
 *     security: []
 *     responses:
 *       '200':
 *         description: The process is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { status: { type: string, example: ok } } }
 *                 error: { nullable: true, example: null }
 */
healthRouter.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok' });
});

/**
 * @openapi
 * /health/ready:
 *   get:
 *     tags: [Health]
 *     summary: Readiness check
 *     description: Reports whether MongoDB and Redis are both reachable — 503 if either is down.
 *     security: []
 *     responses:
 *       '200':
 *         description: All downstream dependencies are reachable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     status: { type: string, example: ready }
 *                     checks:
 *                       type: object
 *                       properties:
 *                         database: { type: boolean, example: true }
 *                         redis: { type: boolean, example: true }
 *                 error: { nullable: true, example: null }
 *       '503':
 *         description: At least one downstream dependency is unreachable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     status: { type: string, example: not_ready }
 *                     checks:
 *                       type: object
 *                       properties:
 *                         database: { type: boolean, example: true }
 *                         redis: { type: boolean, example: false }
 *                 error: { nullable: true, example: null }
 */
healthRouter.get('/health/ready', (_req, res) => {
  const checks = { database: isDatabaseReady(), redis: isRedisReady() };
  const ready = Object.values(checks).every(Boolean);
  sendSuccess(
    res,
    { status: ready ? 'ready' : 'not_ready', checks },
    { status: ready ? 200 : 503 },
  );
});
