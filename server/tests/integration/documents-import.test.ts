import { ROLE_PERMISSIONS, SYSTEM_ROLES } from '@platform/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app';
import { connectDatabase, disconnectDatabase } from '../../src/config/db';
import { RoleModel } from '../../src/models/role.model';
import { enqueueRenderJob } from '../../src/queues/render.queue';
import { registerUser } from '../helpers/register-user';

vi.mock('../../src/queues/render.queue', () => ({
  enqueueRenderJob: vi.fn(async () => {}),
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

afterEach(() => {
  vi.mocked(enqueueRenderJob).mockClear();
});

const LAYOUT_WITH_FIELDS = {
  page: {},
  theme: {},
  sections: [
    {
      id: 's1',
      elements: [
        { id: 'e1', type: 'text', x: 0, y: 0, width: 200, value: 'Hello {{customer.name}}' },
      ],
    },
  ],
  fields: [
    { key: 'customer.name', label: 'Customer Name', type: 'text', required: true },
    { key: 'document.amount', label: 'Amount', type: 'currency', required: false },
  ],
};

async function createPublishedTemplate(auth: Record<string, string>) {
  const createRes = await request(app)
    .post('/api/v1/templates')
    .set(auth)
    .send({ name: 'Statement', documentType: 'statement' });
  expect(createRes.status).toBe(201);
  const template = createRes.body.data as {
    _id: string;
    version: { _id: string; versionNumber: number };
  };

  const versionRes = await request(app)
    .post(`/api/v1/templates/${template._id}/versions`)
    .set(auth)
    .send({ layoutJson: LAYOUT_WITH_FIELDS, baseVersionNumber: template.version.versionNumber });
  expect(versionRes.status).toBe(201);
  const versionId = versionRes.body.data._id as string;

  const publishRes = await request(app)
    .post(`/api/v1/templates/${template._id}/versions/${versionId}/publish`)
    .set(auth);
  expect(publishRes.status).toBe(200);

  return template._id;
}

describe('Documents import + bulk-generate', () => {
  it('parses a CSV upload and suggests a column mapping against the template fields', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);

    const csv = Buffer.from('Customer Name,Amount\nJane,100\nBob,200\n');
    const res = await request(app)
      .post('/api/v1/documents/import')
      .set(auth)
      .field('templateId', templateId)
      .attach('file', csv, 'import.csv');

    expect(res.status).toBe(200);
    expect(res.body.data.columns).toEqual(['Customer Name', 'Amount']);
    expect(res.body.data.rows).toHaveLength(2);
    expect(res.body.data.suggestedMapping['customer.name']).toBe('Customer Name');
    expect(res.body.data.suggestedMapping['document.amount']).toBe('Amount');
  });

  it('wraps a single JSON object into a one-row array', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);

    const json = Buffer.from(JSON.stringify({ 'customer.name': 'Jane', 'document.amount': 100 }));
    const res = await request(app)
      .post('/api/v1/documents/import')
      .set(auth)
      .field('templateId', templateId)
      .attach('file', json, 'import.json');

    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(1);
  });

  it('bulk-generates documents for valid rows and reports per-row failures for invalid ones', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);

    const res = await request(app)
      .post('/api/v1/documents/bulk-generate')
      .set(auth)
      .send({
        templateId,
        rows: [
          { 'document.amount': '50' }, // missing required customer.name
          { 'customer.name': 'Jane', 'document.amount': '10' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.accepted).toBe(1);
    expect(res.body.data.rejected).toEqual([{ row: 0, reason: '"Customer Name" is required' }]);
    expect(enqueueRenderJob).toHaveBeenCalledTimes(1);

    const batchRes = await request(app)
      .get(`/api/v1/documents/batches/${res.body.data.batchId}`)
      .set(auth);
    expect(batchRes.status).toBe(200);
    expect(batchRes.body.data.total).toBe(2);
    expect(batchRes.body.data.completed).toBe(0);
    expect(batchRes.body.data.failed).toBe(1);
    expect(batchRes.body.data.failures).toEqual([
      { row: 0, reason: '"Customer Name" is required' },
    ]);
  });

  it('links a row to an existing customer by customerId, and rejects an unknown one', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);

    const customerRes = await request(app)
      .post('/api/v1/customers')
      .set(auth)
      .send({ name: 'Acme Corp' });
    expect(customerRes.status).toBe(201);
    const customerId = customerRes.body.data._id as string;

    const res = await request(app)
      .post('/api/v1/documents/bulk-generate')
      .set(auth)
      .send({
        templateId,
        rows: [
          { 'customer.name': 'Acme Corp', customerId },
          { 'customer.name': 'Ghost', customerId: '64b000000000000000000099' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.accepted).toBe(1);
    expect(res.body.data.rejected).toEqual([
      { row: 1, reason: 'Customer "64b000000000000000000099" not found' },
    ]);

    const listRes = await request(app).get(`/api/v1/documents?customerId=${customerId}`).set(auth);
    expect(listRes.body.data).toHaveLength(1);
  });

  it('isolates batches by organization, returning 404 across tenants', async () => {
    const { accessToken: ownerToken } = await registerUser(app);
    const ownerAuth = { Authorization: `Bearer ${ownerToken}` };
    const templateId = await createPublishedTemplate(ownerAuth);

    const bulkRes = await request(app)
      .post('/api/v1/documents/bulk-generate')
      .set(ownerAuth)
      .send({ templateId, rows: [{ 'customer.name': 'Jane' }] });
    const batchId = bulkRes.body.data.batchId as string;

    const { accessToken: otherToken } = await registerUser(app);
    const res = await request(app)
      .get(`/api/v1/documents/batches/${batchId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });
});
