import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '../config/logger';

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  req.requestId = (req.headers['x-request-id'] as string | undefined) ?? uuidv4();
  res.setHeader('x-request-id', req.requestId);

  const start = Date.now();
  res.on('finish', () => {
    logger.info('request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}
