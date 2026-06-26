import type { NextFunction, Request, Response } from 'express';
import type { Permission } from '@platform/shared';

import { AppError } from '../utils/app-error';

/** Route-level RBAC gate — see PRD 07 §7.3. Object-level checks (e.g. last-admin guard) live in services. */
export function requirePermission(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required');
    }

    const granted = new Set(req.user.permissions);
    const missing = required.filter((permission) => !granted.has(permission));

    if (missing.length > 0) {
      throw new AppError('FORBIDDEN', `Missing required permission(s): ${missing.join(', ')}`);
    }

    next();
  };
}
