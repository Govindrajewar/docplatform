import type { UserDocument } from '../../models/user.model';

export interface PublicUser {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  roleId: string;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
}

/** Strips passwordHash/refreshTokenHash/reset-token fields before any response leaves the API. */
export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    organizationId: user.organizationId.toString(),
    name: user.name,
    email: user.email,
    roleId: user.roleId.toString(),
    status: user.status,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
  };
}
