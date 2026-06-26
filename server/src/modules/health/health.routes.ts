import { Router } from 'express';

import { isDatabaseReady } from '../../config/db';
import { isRedisReady } from '../../config/redis';
import { sendSuccess } from '../../utils/api-response';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok' });
});

healthRouter.get('/health/ready', (_req, res) => {
  const checks = { database: isDatabaseReady(), redis: isRedisReady() };
  const ready = Object.values(checks).every(Boolean);
  sendSuccess(
    res,
    { status: ready ? 'ready' : 'not_ready', checks },
    { status: ready ? 200 : 503 },
  );
});
