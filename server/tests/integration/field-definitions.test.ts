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

describe('Field Definitions', () => {
  it('lists system fields merged with org custom fields, and CRUDs a custom field', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };

    const initialList = await request(app).get('/api/v1/field-definitions').set(auth);
    expect(initialList.status).toBe(200);
    const systemKeys = initialList.body.data.map((f: { key: string }) => f.key);
    expect(systemKeys).toContain('customer.name');
    expect(initialList.body.data.every((f: { system: boolean }) => f.system)).toBe(true);

    const createRes = await request(app)
      .post('/api/v1/field-definitions')
      .set(auth)
      .send({ key: 'custom.gstin', label: 'GSTIN', type: 'text', required: true });
    expect(createRes.status).toBe(201);

    const afterCreate = await request(app).get('/api/v1/field-definitions').set(auth);
    const custom = afterCreate.body.data.find((f: { key: string }) => f.key === 'custom.gstin');
    expect(custom).toBeTruthy();
    expect(custom.system).toBe(false);

    const dupRes = await request(app)
      .post('/api/v1/field-definitions')
      .set(auth)
      .send({ key: 'custom.gstin', label: 'GSTIN Again' });
    expect(dupRes.status).toBe(409);

    const badKeyRes = await request(app)
      .post('/api/v1/field-definitions')
      .set(auth)
      .send({ key: 'gstin', label: 'No Namespace' });
    expect(badKeyRes.status).toBe(422);

    const updateRes = await request(app)
      .patch(`/api/v1/field-definitions/${createRes.body.data._id}`)
      .set(auth)
      .send({ label: 'GST Number' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.label).toBe('GST Number');

    const deleteRes = await request(app)
      .delete(`/api/v1/field-definitions/${createRes.body.data._id}`)
      .set(auth);
    expect(deleteRes.status).toBe(200);

    const finalList = await request(app).get('/api/v1/field-definitions').set(auth);
    expect(finalList.body.data.some((f: { key: string }) => f.key === 'custom.gstin')).toBe(false);
  });

  it('blocks deleting a custom field referenced by a published template', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };

    const fieldRes = await request(app)
      .post('/api/v1/field-definitions')
      .set(auth)
      .send({ key: 'custom.policyNumber', label: 'Policy Number' });
    const fieldId = fieldRes.body.data._id as string;

    const templateRes = await request(app)
      .post('/api/v1/templates')
      .set(auth)
      .send({ name: 'Policy Certificate', documentType: 'certificate' });
    const templateId = templateRes.body.data._id as string;

    const layoutJson = {
      page: {},
      theme: {},
      sections: [],
      fields: [
        {
          key: 'custom.policyNumber',
          label: 'Policy Number',
          type: 'text',
          system: false,
          required: false,
          defaultValue: null,
        },
      ],
    };
    const versionRes = await request(app)
      .post(`/api/v1/templates/${templateId}/versions`)
      .set(auth)
      .send({ layoutJson });
    const versionId = versionRes.body.data._id as string;

    await request(app)
      .post(`/api/v1/templates/${templateId}/versions/${versionId}/publish`)
      .set(auth);

    const blockedDelete = await request(app)
      .delete(`/api/v1/field-definitions/${fieldId}`)
      .set(auth);
    expect(blockedDelete.status).toBe(409);
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/v1/field-definitions');
    expect(res.status).toBe(401);
  });
});
