import { ROLE_PERMISSIONS, SYSTEM_ROLES } from '@platform/shared';

import { connectDatabase, disconnectDatabase } from '../config/db';
import { logger } from '../config/logger';
import { RoleModel } from '../models/role.model';

async function seedRoles(): Promise<void> {
  for (const roleName of SYSTEM_ROLES) {
    await RoleModel.findOneAndUpdate(
      { name: roleName },
      { name: roleName, permissions: ROLE_PERMISSIONS[roleName], isSystemRole: true },
      { upsert: true, new: true },
    );
    logger.info(`Seeded system role: ${roleName}`);
  }
}

async function main(): Promise<void> {
  await connectDatabase();
  await seedRoles();
  await disconnectDatabase();
  logger.info('Seeding complete');
}

main().catch((err) => {
  logger.error('Seeding failed', { err });
  process.exit(1);
});
