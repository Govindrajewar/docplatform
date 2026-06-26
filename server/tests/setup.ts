import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-please-ignore-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-please-ignore-0123456789abcdef';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.CORS_ORIGIN = 'http://localhost:5173';

// Isolate asset-upload tests from the real dev storage/uploads folder.
const testStorageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-platform-test-storage-'));
process.env.STORAGE_LOCAL_PATH = testStorageDir;

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
  await fs.rm(testStorageDir, { recursive: true, force: true });
});
