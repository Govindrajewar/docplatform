import fs from 'fs/promises';
import path from 'path';

import { env } from '../config/env';

import type { StorageDriver } from './storage-driver';

/**
 * Resolves `key` under the storage root and rejects anything that escapes it — keys are always
 * server-generated (UUID-based), but this is a cheap backstop against path traversal (PRD 08 §8.1).
 */
function resolveSafePath(key: string): string {
  const root = path.resolve(env.STORAGE_LOCAL_PATH);
  const fullPath = path.resolve(root, key);
  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
    throw new Error(`Storage key escapes the storage root: ${key}`);
  }
  return fullPath;
}

/** Dev-mode adapter; the prod swap is an S3-compatible driver behind the same interface (PRD 09 §9.2). */
export const localStorageDriver: StorageDriver = {
  async save(key, buffer) {
    const fullPath = resolveSafePath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
  },

  async read(key) {
    return fs.readFile(resolveSafePath(key));
  },

  async delete(key) {
    await fs.rm(resolveSafePath(key), { force: true });
  },
};
