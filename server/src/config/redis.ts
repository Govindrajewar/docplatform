import Redis from 'ioredis';

import { env } from './env';
import { logger } from './logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => logger.error('Redis connection error', { err }));
redis.on('connect', () => logger.info('Redis connected'));

export async function connectRedis(): Promise<void> {
  if (redis.status === 'ready' || redis.status === 'connecting') return;
  await redis.connect();
}

export function isRedisReady(): boolean {
  return redis.status === 'ready';
}
