import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-please-ignore-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-please-ignore-0123456789abcdef';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.CORS_ORIGIN = 'http://localhost:5173';

vi.mock('ioredis', async () => {
  const RedisMock = (await import('ioredis-mock')).default;
  return { default: RedisMock };
});

// Top-level await: must finish (and set MONGODB_URI) before Vitest loads the test file,
// because config/env.ts validates process.env at import time.
const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri();

afterAll(async () => {
  await mongo.stop();
});
