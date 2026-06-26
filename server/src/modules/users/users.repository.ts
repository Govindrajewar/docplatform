import type { PaginationMeta } from '@platform/shared';

import { UserModel, type UserDocument } from '../../models/user.model';

export interface TenantContext {
  organizationId: string;
}

/** Mongoose casts string ids to ObjectId at runtime — this type just describes the caller-facing shape. */
export interface UserUpdateInput {
  name?: string;
  roleId?: string;
  status?: UserDocument['status'];
  passwordHash?: string;
  refreshTokenHash?: string | null;
  refreshTokenExpiresAt?: Date | null;
  passwordResetTokenHash?: string | null;
  passwordResetExpiresAt?: Date | null;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;
}

export const usersRepository = {
  async create(data: {
    organizationId: string;
    name: string;
    email: string;
    passwordHash: string;
    roleId: string;
  }): Promise<UserDocument> {
    const doc = await UserModel.create(data);
    return doc.toObject();
  },

  /** Includes passwordHash — only for the login flow, which must verify the credential. */
  async findByEmailWithSecrets(email: string) {
    return UserModel.findOne({ email }).select('+passwordHash +refreshTokenHash').exec();
  },

  async findById(ctx: TenantContext, userId: string): Promise<UserDocument | null> {
    return UserModel.findOne({ _id: userId, organizationId: ctx.organizationId }).lean();
  },

  async findByRefreshTokenHash(refreshTokenHash: string) {
    return UserModel.findOne({ refreshTokenHash }).select('+refreshTokenHash').exec();
  },

  async findByPasswordResetTokenHash(passwordResetTokenHash: string) {
    return UserModel.findOne({ passwordResetTokenHash }).exec();
  },

  async list(
    ctx: TenantContext,
    { page, limit }: { page: number; limit: number },
  ): Promise<{ items: UserDocument[]; meta: PaginationMeta }> {
    const filter = { organizationId: ctx.organizationId, status: { $ne: 'deleted' } };
    const [items, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  async countActiveByRole(ctx: TenantContext, roleId: string): Promise<number> {
    return UserModel.countDocuments({
      organizationId: ctx.organizationId,
      roleId,
      status: 'active',
    });
  },

  async updateById(
    ctx: TenantContext,
    userId: string,
    update: UserUpdateInput,
  ): Promise<UserDocument | null> {
    return UserModel.findOneAndUpdate({ _id: userId, organizationId: ctx.organizationId }, update, {
      new: true,
    }).lean();
  },

  async softDelete(ctx: TenantContext, userId: string): Promise<UserDocument | null> {
    return this.updateById(ctx, userId, { status: 'deleted' });
  },
};
