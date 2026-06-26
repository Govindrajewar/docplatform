import type { LoginInput, RegisterInput, ResetPasswordInput } from '@platform/shared';

import { logger } from '../../config/logger';
import { AppError } from '../../utils/app-error';
import { organizationsRepository } from '../organizations/organizations.repository';
import { rolesRepository } from '../roles/roles.repository';
import { toPublicUser, type PublicUser } from '../users/users.mapper';
import { usersRepository } from '../users/users.repository';

import { comparePassword, hashPassword } from './password';
import {
  generatePasswordResetToken,
  generateRefreshToken,
  hashToken,
  signAccessToken,
  type AccessTokenClaims,
} from './tokens';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const GENERIC_LOGIN_ERROR = 'Invalid email or password';

interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function buildAccessTokenClaims(
  userId: string,
  organizationId: string,
  roleId: string,
): Promise<AccessTokenClaims> {
  const role = await rolesRepository.findById(roleId);
  if (!role) throw new AppError('INTERNAL_ERROR', 'User role could not be resolved');
  return {
    sub: userId,
    organizationId,
    roleId,
    roleName: role.name,
    permissions: role.permissions as AccessTokenClaims['permissions'],
  };
}

export const authService = {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await usersRepository.findByEmailWithSecrets(input.email);
    if (existing) {
      throw new AppError('CONFLICT', 'An account with this email already exists');
    }

    let slug = slugify(input.organizationName);
    if (await organizationsRepository.findBySlug(slug)) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
    }

    const adminRole = await rolesRepository.findByName('admin');
    if (!adminRole) {
      throw new AppError('INTERNAL_ERROR', 'System roles are not seeded — run the seed script');
    }

    const organization = await organizationsRepository.create({
      name: input.organizationName,
      slug,
    });
    const passwordHash = await hashPassword(input.password);
    const user = await usersRepository.create({
      organizationId: organization._id.toString(),
      name: input.name,
      email: input.email,
      passwordHash,
      roleId: adminRole._id.toString(),
    });

    return issueSession(user._id.toString(), organization._id.toString(), adminRole._id.toString());
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await usersRepository.findByEmailWithSecrets(input.email);
    if (!user) throw new AppError('UNAUTHORIZED', GENERIC_LOGIN_ERROR);

    if (user.status === 'suspended' || user.status === 'deleted') {
      throw new AppError('ACCOUNT_SUSPENDED', 'This account has been suspended');
    }

    const organization = await organizationsRepository.findById(user.organizationId.toString());
    if (!organization || !organization.isActive) {
      throw new AppError('ORGANIZATION_INACTIVE', 'This organization is inactive');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      // Don't reveal lockout state distinctly from a wrong password — see PRD 10 §10.1.
      throw new AppError('UNAUTHORIZED', GENERIC_LOGIN_ERROR);
    }

    const passwordValid = await comparePassword(input.password, user.passwordHash);
    if (!passwordValid) {
      const attempts = user.failedLoginAttempts + 1;
      const lockedUntil =
        attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null;
      await usersRepository.updateById(
        { organizationId: user.organizationId.toString() },
        user._id.toString(),
        { failedLoginAttempts: lockedUntil ? 0 : attempts, lockedUntil },
      );
      throw new AppError('UNAUTHORIZED', GENERIC_LOGIN_ERROR);
    }

    await usersRepository.updateById(
      { organizationId: user.organizationId.toString() },
      user._id.toString(),
      { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    );

    return issueSession(
      user._id.toString(),
      user.organizationId.toString(),
      user.roleId.toString(),
    );
  },

  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const hash = hashToken(rawRefreshToken);
    const user = await usersRepository.findByRefreshTokenHash(hash);

    if (!user || !user.refreshTokenExpiresAt || user.refreshTokenExpiresAt.getTime() < Date.now()) {
      if (user) {
        // Stale/expired token presented — clear it so it can't be replayed.
        await usersRepository.updateById(
          { organizationId: user.organizationId.toString() },
          user._id.toString(),
          { refreshTokenHash: null, refreshTokenExpiresAt: null },
        );
      }
      throw new AppError('UNAUTHORIZED', 'Refresh token is invalid or expired');
    }

    return issueSession(
      user._id.toString(),
      user.organizationId.toString(),
      user.roleId.toString(),
    );
  },

  async logout(userId: string, organizationId: string): Promise<void> {
    await usersRepository.updateById({ organizationId }, userId, {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });
  },

  async forgotPassword(email: string): Promise<void> {
    const user = await usersRepository.findByEmailWithSecrets(email);
    // Always behave identically whether or not the email exists — see PRD 06 §6.1.3.
    if (!user || user.status !== 'active') return;

    const { token, hash, expiresAt } = generatePasswordResetToken();
    await usersRepository.updateById(
      { organizationId: user.organizationId.toString() },
      user._id.toString(),
      {
        passwordResetTokenHash: hash,
        passwordResetExpiresAt: expiresAt,
      },
    );

    // Email worker lands in Phase 6 (PRD 11 §11.2) — log the link as the dev-mode delivery channel for now.
    logger.info('Password reset link generated', { email: user.email, resetToken: token });
  },

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const hash = hashToken(input.token);
    const user = await usersRepository.findByPasswordResetTokenHash(hash);

    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new AppError('INVALID_TOKEN', 'Password reset token is invalid or expired');
    }

    const passwordHash = await hashPassword(input.newPassword);
    await usersRepository.updateById(
      { organizationId: user.organizationId.toString() },
      user._id.toString(),
      {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    );
  },

  async getMe(organizationId: string, userId: string): Promise<PublicUser> {
    const user = await usersRepository.findById({ organizationId }, userId);
    if (!user) throw new AppError('NOT_FOUND', 'User not found');
    return toPublicUser(user);
  },
};

async function issueSession(
  userId: string,
  organizationId: string,
  roleId: string,
): Promise<AuthResult> {
  const claims = await buildAccessTokenClaims(userId, organizationId, roleId);
  const accessToken = signAccessToken(claims);
  const { token: refreshToken, hash, expiresAt } = generateRefreshToken();

  const updated = await usersRepository.updateById({ organizationId }, userId, {
    refreshTokenHash: hash,
    refreshTokenExpiresAt: expiresAt,
  });
  if (!updated) throw new AppError('INTERNAL_ERROR', 'Failed to persist session');

  return { user: toPublicUser(updated), accessToken, refreshToken };
}
