export const SYSTEM_ROLES = ['admin', 'manager', 'editor', 'viewer'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const PERMISSION_RESOURCES = [
  'templates',
  'documents',
  'customers',
  'organizations',
  'users',
  'roles',
  'assets',
  'settings',
  'logs',
] as const;
export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];

export const PERMISSION_ACTIONS_BY_RESOURCE: Record<PermissionResource, readonly string[]> = {
  templates: ['read', 'write', 'publish', 'delete', 'version'],
  documents: ['read', 'generate', 'delete', 'download'],
  customers: ['read', 'write', 'delete'],
  organizations: ['read', 'write'],
  users: ['read', 'write', 'delete'],
  roles: ['read', 'write'],
  assets: ['read', 'write', 'delete'],
  settings: ['read', 'write'],
  logs: ['read'],
};

/** `resource:action` permission string, e.g. "templates:publish". See PRD 07. */
export type Permission = `${PermissionResource}:${string}`;

function perms(resource: PermissionResource, actions: readonly string[]): Permission[] {
  return actions.map((action) => `${resource}:${action}` as Permission);
}

/** Source of truth for the Role x Permission matrix in PRD 07 §7.2. */
export const ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  admin: PERMISSION_RESOURCES.flatMap((resource) =>
    perms(resource, PERMISSION_ACTIONS_BY_RESOURCE[resource]),
  ),
  manager: [
    ...perms('templates', ['read', 'write', 'publish', 'version']),
    ...perms('documents', ['read', 'generate', 'delete', 'download']),
    ...perms('customers', ['read', 'write']),
    ...perms('organizations', ['read']),
    ...perms('users', ['read', 'write']),
    ...perms('roles', ['read']),
    ...perms('assets', ['read', 'write']),
    ...perms('settings', ['read']),
    ...perms('logs', ['read']),
  ],
  editor: [
    ...perms('templates', ['read']),
    ...perms('documents', ['read', 'generate', 'download']),
    ...perms('customers', ['read']),
    ...perms('organizations', ['read']),
    ...perms('assets', ['read']),
    ...perms('settings', ['read']),
  ],
  viewer: [
    ...perms('templates', ['read']),
    ...perms('documents', ['read', 'download']),
    ...perms('customers', ['read']),
    ...perms('organizations', ['read']),
    ...perms('assets', ['read']),
    ...perms('settings', ['read']),
  ],
};
