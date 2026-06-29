import { ROLE_PERMISSIONS, SYSTEM_ROLES } from '@platform/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { connectDatabase, disconnectDatabase } from '../../src/config/db';
import { RoleModel } from '../../src/models/role.model';
import { registerUser } from '../helpers/register-user';

const app = createApp();

// A valid 1x1 transparent PNG, reused from tests/integration/assets.test.ts.
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

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

async function createTemplate(auth: Record<string, string>) {
  const res = await request(app)
    .post('/api/v1/templates')
    .set(auth)
    .send({ name: 'Tax Invoice', documentType: 'invoice' });
  expect(res.status).toBe(201);
  return res.body.data as { _id: string; version: { _id: string; versionNumber: number } };
}

describe('Templates CRUD + versioning', () => {
  it('creates a template with an initial draft version, lists, gets, updates, and archives it', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };

    const created = await createTemplate(auth);
    expect(created.version.versionNumber).toBe(1);

    const listRes = await request(app).get('/api/v1/templates').set(auth);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    const getRes = await request(app).get(`/api/v1/templates/${created._id}`).set(auth);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.latestVersion.layoutJson.sections).toEqual([]);

    const updateRes = await request(app)
      .patch(`/api/v1/templates/${created._id}`)
      .set(auth)
      .send({ name: 'Renamed Invoice', tags: ['finance'] });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Renamed Invoice');

    const archiveRes = await request(app).delete(`/api/v1/templates/${created._id}`).set(auth);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.status).toBe('archived');

    const auditRes = await request(app).get('/api/v1/audit-logs?entityType=template').set(auth);
    const actions = auditRes.body.data.map((entry: { action: string }) => entry.action);
    expect(actions).toContain('template.create');
    expect(actions).toContain('template.update');
    expect(actions).toContain('template.archive');
  });

  it('rejects unauthenticated access and returns 404 for a template in a different organization', async () => {
    const unauthRes = await request(app).get('/api/v1/templates');
    expect(unauthRes.status).toBe(401);

    const { accessToken: orgAToken } = await registerUser(app);
    const created = await createTemplate({ Authorization: `Bearer ${orgAToken}` });

    const { accessToken: orgBToken } = await registerUser(app);
    const res = await request(app)
      .get(`/api/v1/templates/${created._id}`)
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(res.status).toBe(404);
  });

  it('saves new draft versions with optimistic concurrency, rejecting a stale base version', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const created = await createTemplate(auth);

    const layoutJson = {
      page: {},
      theme: {},
      sections: [
        { id: 's1', elements: [{ id: 'e1', type: 'staticText', x: 0, y: 0, value: 'Hi' }] },
      ],
      fields: [],
    };

    const saveRes = await request(app)
      .post(`/api/v1/templates/${created._id}/versions`)
      .set(auth)
      .send({ layoutJson, baseVersionNumber: 1 });
    expect(saveRes.status).toBe(201);
    expect(saveRes.body.data.versionNumber).toBe(2);

    const staleRes = await request(app)
      .post(`/api/v1/templates/${created._id}/versions`)
      .set(auth)
      .send({ layoutJson, baseVersionNumber: 1 });
    expect(staleRes.status).toBe(409);
    expect(staleRes.body.error.code).toBe('STALE_VERSION');
  });

  it('rejects a template version with two elements sharing the same id', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const created = await createTemplate(auth);

    const layoutJson = {
      page: {},
      theme: {},
      sections: [
        {
          id: 's1',
          elements: [
            { id: 'dup', type: 'staticText', x: 0, y: 0, value: 'A' },
            { id: 'dup', type: 'staticText', x: 0, y: 20, value: 'B' },
          ],
        },
      ],
      fields: [],
    };

    const res = await request(app)
      .post(`/api/v1/templates/${created._id}/versions`)
      .set(auth)
      .send({ layoutJson });
    expect(res.status).toBe(422);
  });

  it('blocks publish when a version references a deleted asset, then publishes once fixed', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const created = await createTemplate(auth);

    const brokenLayout = {
      page: {},
      theme: {},
      sections: [
        {
          id: 's1',
          elements: [
            {
              id: 'logo',
              type: 'image',
              x: 0,
              y: 0,
              width: 50,
              height: 50,
              src: '64b000000000000000000001',
            },
          ],
        },
      ],
      fields: [],
    };
    const savedBroken = await request(app)
      .post(`/api/v1/templates/${created._id}/versions`)
      .set(auth)
      .send({ layoutJson: brokenLayout });
    expect(savedBroken.status).toBe(201);

    const publishBrokenRes = await request(app)
      .post(`/api/v1/templates/${created._id}/versions/${savedBroken.body.data._id}/publish`)
      .set(auth);
    expect(publishBrokenRes.status).toBe(422);

    const assetRes = await request(app)
      .post('/api/v1/assets')
      .set(auth)
      .field('type', 'logo')
      .attach('file', PNG_BUFFER, 'logo.png');
    expect(assetRes.status).toBe(201);
    const assetId = assetRes.body.data._id as string;

    const fixedLayout = {
      page: {},
      theme: {},
      sections: [
        {
          id: 's1',
          elements: [
            { id: 'logo', type: 'image', x: 0, y: 0, width: 50, height: 50, src: assetId },
          ],
        },
      ],
      fields: [],
    };
    const savedFixed = await request(app)
      .post(`/api/v1/templates/${created._id}/versions`)
      .set(auth)
      .send({ layoutJson: fixedLayout });
    expect(savedFixed.status).toBe(201);

    const publishRes = await request(app)
      .post(`/api/v1/templates/${created._id}/versions/${savedFixed.body.data._id}/publish`)
      .set(auth);
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.data.status).toBe('published');
    expect(publishRes.body.data.currentVersionId).toBe(savedFixed.body.data._id);
  });

  it('duplicates a template independently of the original, and exports a portable bundle', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const created = await createTemplate(auth);

    const dupRes = await request(app).post(`/api/v1/templates/${created._id}/duplicate`).set(auth);
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.data.name).toBe('Tax Invoice (Copy)');
    expect(dupRes.body.data._id).not.toBe(created._id);

    const exportRes = await request(app).post(`/api/v1/templates/${created._id}/export`).set(auth);
    expect(exportRes.status).toBe(200);
    expect(exportRes.body.data.name).toBe('Tax Invoice');
    expect(exportRes.body.data.layoutJson.sections).toEqual([]);

    const importRes = await request(app)
      .post('/api/v1/templates/import')
      .set(auth)
      .send(exportRes.body.data);
    expect(importRes.status).toBe(201);
    expect(importRes.body.data.name).toBe('Tax Invoice');
  });

  it('restores (rolls back to) an older version, publishing it as a new forward version', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const created = await createTemplate(auth);
    const v1Id = created.version._id;

    const v2Layout = {
      page: {},
      theme: {},
      sections: [
        { id: 's1', elements: [{ id: 'e1', type: 'staticText', x: 0, y: 0, value: 'v2' }] },
      ],
      fields: [],
    };
    const v2Res = await request(app)
      .post(`/api/v1/templates/${created._id}/versions`)
      .set(auth)
      .send({ layoutJson: v2Layout });
    expect(v2Res.status).toBe(201);

    const restoreRes = await request(app)
      .post(`/api/v1/templates/${created._id}/versions/${v1Id}/restore`)
      .set(auth);
    expect(restoreRes.status).toBe(201);
    expect(restoreRes.body.data.version.versionNumber).toBe(3);
    expect(restoreRes.body.data.status).toBe('published');

    const auditRes = await request(app)
      .get('/api/v1/audit-logs?action=template.rollback')
      .set(auth);
    expect(auditRes.body.data.length).toBeGreaterThan(0);
  });

  it('compares two versions, reporting added/removed/modified elements by id', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const created = await createTemplate(auth);

    const v2Layout = {
      page: {},
      theme: {},
      sections: [
        { id: 's1', elements: [{ id: 'e1', type: 'staticText', x: 0, y: 0, value: 'hello' }] },
      ],
      fields: [],
    };
    const v2Res = await request(app)
      .post(`/api/v1/templates/${created._id}/versions`)
      .set(auth)
      .send({ layoutJson: v2Layout });

    const compareRes = await request(app)
      .get(
        `/api/v1/templates/${created._id}/versions/compare?from=${created.version._id}&to=${v2Res.body.data._id}`,
      )
      .set(auth);
    expect(compareRes.status).toBe(200);
    expect(compareRes.body.data.added).toEqual(['e1']);
    expect(compareRes.body.data.removed).toEqual([]);
  });

  it('renders a live preview PDF without persisting a document', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const created = await createTemplate(auth);

    const layoutJson = {
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

    const previewRes = await request(app)
      .post(`/api/v1/templates/${created._id}/preview`)
      .set(auth)
      .send({ layoutJson, sampleData: { customerName: 'Jane' } });

    expect(previewRes.status).toBe(200);
    expect(previewRes.headers['content-type']).toBe('application/pdf');
    expect(Buffer.isBuffer(previewRes.body)).toBe(true);
    expect((previewRes.body as Buffer).length).toBeGreaterThan(0);
  });
});
