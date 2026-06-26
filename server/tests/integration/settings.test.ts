import { ROLE_PERMISSIONS, SYSTEM_ROLES } from '@platform/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { connectDatabase, disconnectDatabase } from '../../src/config/db';
import { RoleModel } from '../../src/models/role.model';
import { registerUser } from '../helpers/register-user';

const app = createApp();

beforeAll(async () => {
  await connectDatabase();
  for (const roleName of SYSTEM_ROLES) {
    await RoleModel.create({
      name: roleName,
      permissions: ROLE_PERMISSIONS[roleName],
      isSystemRole: true,
    });
  }
});

afterAll(async () => {
  await disconnectDatabase();
});

describe('Settings', () => {
  it('returns defaults and persists updates, recorded in the audit trail', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };

    const getRes = await request(app).get('/api/v1/settings').set(auth);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.theme).toBe('system');
    expect(getRes.body.data.defaultPaperSize).toBe('A4');

    const updateRes = await request(app)
      .patch('/api/v1/settings')
      .set(auth)
      .send({ theme: 'dark', defaultCurrency: 'EUR' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.theme).toBe('dark');
    expect(updateRes.body.data.defaultCurrency).toBe('EUR');

    const auditRes = await request(app).get('/api/v1/audit-logs?action=settings.update').set(auth);
    expect(auditRes.body.data.length).toBeGreaterThan(0);
  });

  it('rejects an invalid paper size', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ defaultPaperSize: 'TABLOID' });

    expect(res.status).toBe(422);
  });
});
