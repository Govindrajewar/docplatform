import type { Permission } from '@platform/shared';

export interface AuthenticatedUser {
  userId: string;
  organizationId: string;
  roleId: string;
  roleName: string;
  permissions: Permission[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

export {};
