import { ROLE_PERMISSIONS, SYSTEM_ROLES } from '@platform/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app';
import { connectDatabase, disconnectDatabase } from '../../src/config/db';
import { hashPassword } from '../../src/modules/auth/password';
import { RoleModel } from '../../src/models/role.model';
import { UserModel } from '../../src/models/user.model';
import { registerUser } from '../helpers/register-user';

vi.mock('../../src/queues/email.queue', () => ({
  enqueueEmailJob: vi.fn(async () => {}),
}));

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

const SIMPLE_LAYOUT = {
  page: {},
  theme: {},
  sections: [
    {
      id: 's1',
      elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 200, value: 'Hello' }],
    },
  ],
  fields: [],
};

async function createPublishedTemplate(auth: Record<string, string>) {
  const createRes = await request(app)
    .post('/api/v1/templates')
    .set(auth)
    .send({ name: 'Tax Invoice', documentType: 'invoice' });
  const template = createRes.body.data as {
    _id: string;
    version: { _id: string; versionNumber: number };
  };

  const versionRes = await request(app)
    .post(`/api/v1/templates/${template._id}/versions`)
    .set(auth)
    .send({ layoutJson: SIMPLE_LAYOUT, baseVersionNumber: template.version.versionNumber });
  const versionId = versionRes.body.data._id as string;

  await request(app)
    .post(`/api/v1/templates/${template._id}/versions/${versionId}/publish`)
    .set(auth);

  return template._id;
}

describe('Dashboard summary', () => {
  it('aggregates KPIs, documents-over-time, and recent documents scoped to the org', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };

    await request(app).post('/api/v1/customers').set(auth).send({ name: 'Acme Corp' });
    const templateId = await createPublishedTemplate(auth);

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app)
        .post('/api/v1/documents')
        .set(auth)
        .send({ templateId, dataPayload: {} });
      expect(res.body.data.status).toBe('generated');
    }

    const res = await request(app).get('/api/v1/dashboard/summary').set(auth);
    expect(res.status).toBe(200);
    const summary = res.body.data;

    expect(summary.kpis.totalCustomers).toBe(1);
    expect(summary.kpis.totalTemplates).toBe(1);
    expect(summary.kpis.publishedTemplates).toBe(1);
    expect(summary.kpis.totalDocuments).toBe(3);
    expect(summary.kpis.documentsByStatus.generated).toBe(3);
    expect(summary.kpis.documentsStorageBytes).toBeGreaterThan(0);
    expect(summary.kpis.totalStorageBytes).toBe(
      summary.kpis.assetsStorageBytes + summary.kpis.documentsStorageBytes,
    );

    expect(summary.documentsOverTime).toHaveLength(14);
    const today = new Date().toISOString().slice(0, 10);
    const todayBucket = summary.documentsOverTime.find(
      (entry: { date: string }) => entry.date === today,
    );
    expect(todayBucket.count).toBe(3);

    expect(summary.recentDocuments).toHaveLength(3);
    expect(summary.recentActivity).not.toBeNull();
    const actions = summary.recentActivity.map((entry: { action: string }) => entry.action);
    expect(actions).toContain('document.generate');
  });

  it('does not leak another organization’s data into the aggregates', async () => {
    const { accessToken: orgAToken } = await registerUser(app);
    const orgAAuth = { Authorization: `Bearer ${orgAToken}` };
    const templateId = await createPublishedTemplate(orgAAuth);
    await request(app)
      .post('/api/v1/documents')
      .set(orgAAuth)
      .send({ templateId, dataPayload: {} });

    const { accessToken: orgBToken } = await registerUser(app);
    const orgBAuth = { Authorization: `Bearer ${orgBToken}` };

    const res = await request(app).get('/api/v1/dashboard/summary').set(orgBAuth);
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.totalDocuments).toBe(0);
    expect(res.body.data.kpis.totalTemplates).toBe(0);
    expect(res.body.data.kpis.documentsStorageBytes).toBe(0);
    expect(res.body.data.recentDocuments).toHaveLength(0);
  });

  it('hides recentActivity from roles without logs:read, but includes it for admin', async () => {
    const { accessToken: adminToken, user: adminUser } = await registerUser(app);
    const adminAuth = { Authorization: `Bearer ${adminToken}` };

    const editorRole = await RoleModel.findOne({ name: 'editor' });
    const editorPassword = 'EditorPass123';
    await UserModel.create({
      organizationId: adminUser.organizationId,
      name: 'Editor User',
      email: 'editor@example.test',
      passwordHash: await hashPassword(editorPassword),
      roleId: editorRole?._id,
      status: 'active',
    });

    const editorLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'editor@example.test', password: editorPassword });
    const editorAuth = { Authorization: `Bearer ${editorLoginRes.body.data.accessToken}` };

    const adminRes = await request(app).get('/api/v1/dashboard/summary').set(adminAuth);
    expect(adminRes.body.data.recentActivity).not.toBeNull();

    const editorRes = await request(app).get('/api/v1/dashboard/summary').set(editorAuth);
    expect(editorRes.status).toBe(200);
    expect(editorRes.body.data.recentActivity).toBeNull();
    expect(editorRes.body.data.kpis).toBeDefined();
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
  });
});
