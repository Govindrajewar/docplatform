import { env } from '../config/env';

import { localStorageDriver } from './local-storage.driver';
import type { StorageDriver } from './storage-driver';

function resolveDriver(): StorageDriver {
  switch (env.STORAGE_DRIVER) {
    case 'local':
      return localStorageDriver;
    case 's3':
      throw new Error('S3 storage driver is not implemented yet — see PRD 11 §11.1 (Phase 7)');
  }
}

export const storageDriver = resolveDriver();
export type { StorageDriver } from './storage-driver';
