import crypto from 'crypto';

import jwt from 'jsonwebtoken';
import type { Permission } from '@platform/shared';

import { env } from '../../config/env';

export interface AccessTokenClaims {
  sub: string; // userId
  organizationId: string;
  roleId: string;
  roleName: string;
  permissions: Permission[];
}

export function signAccessToken(claims: AccessTokenClaims): string {
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenClaims;
}

/** Refresh tokens are opaque random strings — only their SHA-256 hash is ever persisted (PRD 08 §8.4). */
export function generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(48).toString('hex');
  const hash = hashToken(token);
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
  return { token, hash, expiresAt };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generatePasswordResetToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return { token, hash, expiresAt };
}
