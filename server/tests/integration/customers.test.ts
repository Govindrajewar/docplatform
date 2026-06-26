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

describe('Customers CRUD', () => {
  it('creates, lists, updates, and soft-deletes a customer, with an audit trail', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };

    const createRes = await request(app)
      .post('/api/v1/customers')
      .set(auth)
      .send({ name: 'Acme Corp', email: 'billing@acme.test' });
    expect(createRes.status).toBe(201);
    const customerId = createRes.body.data._id;
    expect(customerId).toBeTruthy();

    const listRes = await request(app).get('/api/v1/customers').set(auth);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    const searchRes = await request(app).get('/api/v1/customers?q=acme').set(auth);
    expect(searchRes.body.data).toHaveLength(1);

    const updateRes = await request(app)
      .patch(`/api/v1/customers/${customerId}`)
      .set(auth)
      .send({ phone: '+1-555-0100' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.phone).toBe('+1-555-0100');

    const deleteRes = await request(app).delete(`/api/v1/customers/${customerId}`).set(auth);
    expect(deleteRes.status).toBe(200);

    const listAfterDelete = await request(app).get('/api/v1/customers').set(auth);
    expect(listAfterDelete.body.data).toHaveLength(0);

    const auditRes = await request(app).get('/api/v1/audit-logs?entityType=customer').set(auth);
    expect(auditRes.status).toBe(200);
    const actions = auditRes.body.data.map((entry: { action: string }) => entry.action);
    expect(actions).toContain('customer.create');
    expect(actions).toContain('customer.update');
    expect(actions).toContain('customer.delete');
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/v1/customers');
    expect(res.status).toBe(401);
  });

  it('returns 404 for a customer in a different organization', async () => {
    const { accessToken: orgAToken } = await registerUser(app);
    const created = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ name: 'Org A Customer' });

    const { accessToken: orgBToken } = await registerUser(app);
    const res = await request(app)
      .get(`/api/v1/customers/${created.body.data._id}`)
      .set('Authorization', `Bearer ${orgBToken}`);

    expect(res.status).toBe(404);
  });
});
