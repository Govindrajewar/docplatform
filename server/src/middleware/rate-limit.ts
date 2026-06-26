import type { NextFunction, Request, Response } from 'express';

import { redis } from '../config/redis';
import { AppError } from '../utils/app-error';

interface RateLimitOptions {
  windowSeconds: number;
  max: number;
  /** Builds the Redis key segment identifying the caller, e.g. IP+email for login. Defaults to IP. */
  keyFn?: (req: Request) => string;
  keyPrefix: string;
}

/** Fixed-window counter rate limiter (Redis INCR+EXPIRE) — see PRD 05 §5.14 / 08 §8.1. */
export function rateLimit(options: RateLimitOptions) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const identity = options.keyFn ? options.keyFn(req) : (req.ip ?? 'unknown');
    const key = `ratelimit:${options.keyPrefix}:${identity}`;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, options.windowSeconds);
    }

    if (count > options.max) {
      throw new AppError('RATE_LIMITED', 'Too many requests — please try again later');
    }

    next();
  };
}
