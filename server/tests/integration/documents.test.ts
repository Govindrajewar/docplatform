import { ROLE_PERMISSIONS, SYSTEM_ROLES } from '@platform/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app';
import { connectDatabase, disconnectDatabase } from '../../src/config/db';
import { DocumentModel } from '../../src/models/document.model';
import { RoleModel } from '../../src/models/role.model';
import { enqueueRenderJob } from '../../src/queues/render.queue';
import { registerUser } from '../helpers/register-user';

vi.mock('../../src/queues/render.queue', () => ({
  enqueueRenderJob: vi.fn(async () => {}),
}));
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

afterEach(() => {
  vi.mocked(enqueueRenderJob).mockClear();
});

const SIMPLE_LAYOUT = {
  page: {},
  theme: {},
  sections: [
    {
      id: 's1',
      elements: [
        { id: 'e1', type: 'text', x: 0, y: 0, width: 200, value: 'Hello {{customerName}}' },
      ],
    },
  ],
  fields: [],
};

async function createPublishedTemplate(auth: Record<string, string>) {
  const createRes = await request(app)
    .post('/api/v1/templates')
    .set(auth)
    .send({ name: 'Tax Invoice', documentType: 'invoice' });
  expect(createRes.status).toBe(201);
  const template = createRes.body.data as {
    _id: string;
    version: { _id: string; versionNumber: number };
  };

  const versionRes = await request(app)
    .post(`/api/v1/templates/${template._id}/versions`)
    .set(auth)
    .send({ layoutJson: SIMPLE_LAYOUT, baseVersionNumber: template.version.versionNumber });
  expect(versionRes.status).toBe(201);
  const versionId = versionRes.body.data._id as string;

  const publishRes = await request(app)
    .post(`/api/v1/templates/${template._id}/versions/${versionId}/publish`)
    .set(auth);
  expect(publishRes.status).toBe(200);

  return template._id;
}

describe('Documents generation', () => {
  it('generates a document synchronously for a small payload and retrieves the PDF', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);

    const createRes = await request(app)
      .post('/api/v1/documents')
      .set(auth)
      .send({ templateId, dataPayload: { customerName: 'Jane' } });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('generated');
    expect(enqueueRenderJob).not.toHaveBeenCalled();

    const documentId = createRes.body.data._id as string;

    const getRes = await request(app).get(`/api/v1/documents/${documentId}`).set(auth);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.status).toBe('generated');

    const pdfRes = await request(app).get(`/api/v1/documents/${documentId}/pdf`).set(auth);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toBe('application/pdf');
    expect(Buffer.isBuffer(pdfRes.body)).toBe(true);
    expect((pdfRes.body as Buffer).length).toBeGreaterThan(0);
  });

  it('rejects generation against a template with no published version', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };

    const createRes = await request(app)
      .post('/api/v1/templates')
      .set(auth)
      .send({ name: 'Draft Only', documentType: 'invoice' });
    expect(createRes.status).toBe(201);

    const res = await request(app)
      .post('/api/v1/documents')
      .set(auth)
      .send({ templateId: createRes.body.data._id, dataPayload: {} });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('routes a large dataPayload to the async queue instead of rendering inline', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);

    const rows = Array.from({ length: 250 }, (_, i) => ({ i }));
    const createRes = await request(app)
      .post('/api/v1/documents')
      .set(auth)
      .send({ templateId, dataPayload: { rows } });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('generating');
    expect(enqueueRenderJob).toHaveBeenCalledWith(createRes.body.data._id);
  });

  it('isolates documents by organization, returning 404 across tenants', async () => {
    const { accessToken: ownerToken } = await registerUser(app);
    const ownerAuth = { Authorization: `Bearer ${ownerToken}` };
    const templateId = await createPublishedTemplate(ownerAuth);

    const createRes = await request(app)
      .post('/api/v1/documents')
      .set(ownerAuth)
      .send({ templateId, dataPayload: {} });
    const documentId = createRes.body.data._id as string;

    const { accessToken: otherToken } = await registerUser(app);
    const res = await request(app)
      .get(`/api/v1/documents/${documentId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it('regenerates a document, re-rendering against its pinned template version', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);

    const createRes = await request(app)
      .post('/api/v1/documents')
      .set(auth)
      .send({ templateId, dataPayload: { customerName: 'Jane' } });
    const documentId = createRes.body.data._id as string;

    const regenRes = await request(app)
      .post(`/api/v1/documents/${documentId}/regenerate`)
      .set(auth);
    expect(regenRes.status).toBe(200);
    expect(regenRes.body.data.status).toBe('generated');
  });

  it('soft-deletes a document, hiding it from get and list afterwards', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);

    const createRes = await request(app)
      .post('/api/v1/documents')
      .set(auth)
      .send({ templateId, dataPayload: {} });
    const documentId = createRes.body.data._id as string;

    const deleteRes = await request(app).delete(`/api/v1/documents/${documentId}`).set(auth);
    expect(deleteRes.status).toBe(200);

    const getRes = await request(app).get(`/api/v1/documents/${documentId}`).set(auth);
    expect(getRes.status).toBe(404);

    const listRes = await request(app).get('/api/v1/documents').set(auth);
    expect(listRes.body.data).toHaveLength(0);
  });

  it('filters the list by templateId and status', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);
    const otherTemplateId = await createPublishedTemplate(auth);

    await request(app).post('/api/v1/documents').set(auth).send({ templateId, dataPayload: {} });
    await request(app)
      .post('/api/v1/documents')
      .set(auth)
      .send({ templateId: otherTemplateId, dataPayload: {} });

    const filteredRes = await request(app)
      .get(`/api/v1/documents?templateId=${templateId}&status=generated`)
      .set(auth);
    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.data).toHaveLength(1);
    expect(filteredRes.body.data[0].templateId).toBe(templateId);
  });

  it('returns 409 NOT_READY while generating and 409 CONFLICT with the failure reason once failed', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);

    const createRes = await request(app)
      .post('/api/v1/documents')
      .set(auth)
      .send({ templateId, dataPayload: {} });
    const documentId = createRes.body.data._id as string;

    await DocumentModel.findByIdAndUpdate(documentId, { status: 'generating' });
    const generatingRes = await request(app).get(`/api/v1/documents/${documentId}/pdf`).set(auth);
    expect(generatingRes.status).toBe(409);
    expect(generatingRes.body.error.code).toBe('NOT_READY');

    await DocumentModel.findByIdAndUpdate(documentId, {
      status: 'failed',
      failureReason: 'boom',
    });
    const failedRes = await request(app).get(`/api/v1/documents/${documentId}/pdf`).set(auth);
    expect(failedRes.status).toBe(409);
    expect(failedRes.body.error.code).toBe('CONFLICT');
    expect(failedRes.body.error.message).toContain('boom');
  });
});
