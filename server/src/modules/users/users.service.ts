import type { CreateUserInput, PaginationMeta, UpdateUserInput } from '@platform/shared';

import { logger } from '../../config/logger';
import { AppError } from '../../utils/app-error';
import type { AuthenticatedUser } from '../../types/express';
import { generatePasswordResetToken } from '../auth/tokens';
import { hashPassword } from '../auth/password';
import { rolesRepository } from '../roles/roles.repository';

import { toPublicUser, type PublicUser } from './users.mapper';
import { usersRepository, type TenantContext } from './users.repository';

async function assertNotDemotingLastAdmin(
  ctx: TenantContext,
  currentRoleId: string,
  nextRoleId: string | undefined,
): Promise<void> {
  if (!nextRoleId || nextRoleId === currentRoleId) return;

  const currentRole = await rolesRepository.findById(currentRoleId);
  if (currentRole?.name !== 'admin') return;

  const adminCount = await usersRepository.countActiveByRole(ctx, currentRoleId);
  if (adminCount <= 1) {
    throw new AppError('LAST_ADMIN', 'An organization must always retain at least one Admin');
  }
}

export const usersService = {
  async list(
    ctx: TenantContext,
    page: number,
    limit: number,
  ): Promise<{ items: PublicUser[]; meta: PaginationMeta }> {
    const { items, meta } = await usersRepository.list(ctx, { page, limit });
    return { items: items.map(toPublicUser), meta };
  },

  async get(ctx: TenantContext, userId: string): Promise<PublicUser> {
    const user = await usersRepository.findById(ctx, userId);
    if (!user) throw new AppError('NOT_FOUND', 'User not found');
    return toPublicUser(user);
  },

  async create(actor: AuthenticatedUser, input: CreateUserInput): Promise<PublicUser> {
    if (actor.roleName === 'manager' && input.role === 'admin') {
      throw new AppError('FORBIDDEN', 'Managers cannot grant the Admin role');
    }

    const existing = await usersRepository.findByEmailWithSecrets(input.email);
    if (existing) throw new AppError('CONFLICT', 'An account with this email already exists');

    const role = await rolesRepository.findByName(input.role);
    if (!role) throw new AppError('INTERNAL_ERROR', `Role "${input.role}" is not seeded`);

    const temporaryPassword = await hashPassword(generatePasswordResetToken().token);
    const user = await usersRepository.create({
      organizationId: actor.organizationId,
      name: input.name,
      email: input.email,
      passwordHash: temporaryPassword,
      roleId: role._id.toString(),
    });

    const { token, hash, expiresAt } = generatePasswordResetToken();
    await usersRepository.updateById(
      { organizationId: actor.organizationId },
      user._id.toString(),
      {
        status: 'invited',
        passwordResetTokenHash: hash,
        passwordResetExpiresAt: expiresAt,
      },
    );

    // Email worker lands in Phase 6 (PRD 11 §11.2) — log the invite link as the dev-mode delivery channel.
    logger.info('User invited — set-password link generated', {
      email: user.email,
      resetToken: token,
    });

    return toPublicUser({ ...user, status: 'invited' });
  },

  async update(
    actor: AuthenticatedUser,
    userId: string,
    input: UpdateUserInput,
  ): Promise<PublicUser> {
    const ctx: TenantContext = { organizationId: actor.organizationId };
    const target = await usersRepository.findById(ctx, userId);
    if (!target) throw new AppError('NOT_FOUND', 'User not found');

    if (actor.roleName === 'manager' && input.role === 'admin') {
      throw new AppError('FORBIDDEN', 'Managers cannot grant the Admin role');
    }

    let nextRoleId: string | undefined;
    if (input.role) {
      const role = await rolesRepository.findByName(input.role);
      if (!role) throw new AppError('INTERNAL_ERROR', `Role "${input.role}" is not seeded`);
      nextRoleId = role._id.toString();
      await assertNotDemotingLastAdmin(ctx, target.roleId.toString(), nextRoleId);
    }

    if (input.status === 'suspended' || input.status === 'deleted') {
      const currentRole = await rolesRepository.findById(target.roleId.toString());
      if (currentRole?.name === 'admin') {
        const adminCount = await usersRepository.countActiveByRole(ctx, target.roleId.toString());
        if (adminCount <= 1) {
          throw new AppError(
            'LAST_ADMIN',
            'An organization must always retain at least one active Admin',
          );
        }
      }
    }

    const updated = await usersRepository.updateById(ctx, userId, {
      ...(input.name ? { name: input.name } : {}),
      ...(nextRoleId ? { roleId: nextRoleId } : {}),
      ...(input.status ? { status: input.status } : {}),
    });
    if (!updated) throw new AppError('NOT_FOUND', 'User not found');
    return toPublicUser(updated);
  },

  async remove(actor: AuthenticatedUser, userId: string): Promise<void> {
    await this.update(actor, userId, { status: 'deleted' });
  },
};
