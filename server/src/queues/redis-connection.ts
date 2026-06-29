import type { RedisOptions } from 'ioredis';

import { env } from '../config/env';

/**
 * BullMQ bundles its own nested copy of `ioredis`, which TypeScript treats as a structurally
 * distinct class from the root-level `ioredis` install — passing a constructed `IORedis`
 * instance as `connection` fails to typecheck across the two copies. Passing a plain options
 * object instead sidesteps that, since `RedisOptions` is a plain interface and BullMQ
 * constructs the client itself (with its own bundled `ioredis`).
 *
 * Shared by every BullMQ queue/worker in this codebase (render, email) — nothing here is
 * specific to any one queue.
 */
export function buildQueueConnection(): RedisOptions {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}
