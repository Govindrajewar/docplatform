import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { AppError } from '../utils/app-error';
import { verifyAccessToken } from '../modules/auth/tokens';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('UNAUTHORIZED', 'Missing or malformed Authorization header');
  }

  const token = header.slice('Bearer '.length);

  try {
    const claims = verifyAccessToken(token);
    req.user = {
      userId: claims.sub,
      organizationId: claims.organizationId,
      roleId: claims.roleId,
      roleName: claims.roleName,
      permissions: claims.permissions,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('TOKEN_EXPIRED', 'Access token has expired');
    }
    throw new AppError('UNAUTHORIZED', 'Invalid access token');
  }
}
