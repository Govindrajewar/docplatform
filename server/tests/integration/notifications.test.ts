import { ROLE_PERMISSIONS, SYSTEM_ROLES } from '@platform/shared';
import request from 'supertest';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app';
import { connectDatabase, disconnectDatabase } from '../../src/config/db';
import { DocumentModel } from '../../src/models/document.model';
import { RoleModel } from '../../src/models/role.model';
import { enqueueEmailJob } from '../../src/queues/email.queue';
import { enqueueRenderJob } from '../../src/queues/render.queue';
import { renderDocument } from '../../src/modules/documents/render-document';
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

const SIMPLE_LAYOUT = {
  page: {},
  theme: {},
  sections: [
    { id: 's1', elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 200, value: 'Hello' }] },
  ],
  fields: [],
};

async function createPublishedTemplate(auth: Record<string, string>) {
  const createRes = await request(app)
    .post('/api/v1/templates')
    .set(auth)
    .send({ name: 'Notif Test Template', documentType: 'invoice' });
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

describe('Notifications', () => {
  it('creates an in-app notification and enqueues an email when a document generates', async () => {
    const { accessToken, user } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);

    vi.mocked(enqueueEmailJob).mockClear();

    const createRes = await request(app)
      .post('/api/v1/documents')
      .set(auth)
      .send({ templateId, dataPayload: {} });
    expect(createRes.body.data.status).toBe('generated');

    const listRes = await request(app).get('/api/v1/notifications').set(auth);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].type).toBe('document.generated');
    expect(listRes.body.data[0].isRead).toBe(false);

    expect(enqueueEmailJob).toHaveBeenCalledWith(
      expect.objectContaining({ to: user.email, subject: expect.stringContaining('ready') }),
    );

    const unreadRes = await request(app).get('/api/v1/notifications/unread-count').set(auth);
    expect(unreadRes.body.data.count).toBe(1);
  });

  it('creates a failure notification when rendering throws', async () => {
    const { accessToken, user } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);

    vi.mocked(enqueueEmailJob).mockClear();

    // A templateVersionId that doesn't exist forces renderDocument's catch branch deterministically.
    const doc = await DocumentModel.create({
      organizationId: user.organizationId,
      templateId,
      templateVersionId: new Types.ObjectId(),
      customerId: null,
      dataPayload: {},
      createdBy: user.id,
      status: 'draft',
    });

    await renderDocument(doc._id.toString());

    const listRes = await request(app).get('/api/v1/notifications').set(auth);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].type).toBe('document.failed');
    expect(listRes.body.data[0].message).toContain('not found');

    expect(enqueueEmailJob).toHaveBeenCalledWith(
      expect.objectContaining({ to: user.email, subject: expect.stringContaining('failed') }),
    );
  });

  it('sends exactly one batch-completion notification, not one per row', async () => {
    const { accessToken, user } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);

    vi.mocked(enqueueEmailJob).mockClear();
    vi.mocked(enqueueRenderJob).mockClear();

    const bulkRes = await request(app)
      .post('/api/v1/documents/bulk-generate')
      .set(auth)
      .send({ templateId, rows: [{}, {}, {}] });
    expect(bulkRes.status).toBe(201);
    const batchId = bulkRes.body.data.batchId as string;

    // The queue is mocked (no real worker in this suite) — drive each enqueued row's render
    // directly, exactly as the real worker would, so the batch's counters actually reach completion.
    const batchDocs = await DocumentModel.find({ batchId }).lean();
    expect(batchDocs).toHaveLength(3);
    for (const batchDoc of batchDocs) {
      await renderDocument(batchDoc._id.toString());
    }

    const listRes = await request(app).get('/api/v1/notifications').set(auth);
    const batchNotifications = listRes.body.data.filter(
      (n: { type: string }) => n.type === 'batch.completed',
    );
    expect(batchNotifications).toHaveLength(1);
    expect(batchNotifications[0].message).toContain('3 succeeded');

    const emailCallsForBatch = vi
      .mocked(enqueueEmailJob)
      .mock.calls.filter(([msg]) => msg.subject.includes('Bulk generation'));
    expect(emailCallsForBatch).toHaveLength(1);
    expect(emailCallsForBatch[0][0].to).toBe(user.email);
  });

  it('marks a notification read, and marks all as read', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);

    await request(app).post('/api/v1/documents').set(auth).send({ templateId, dataPayload: {} });
    await request(app).post('/api/v1/documents').set(auth).send({ templateId, dataPayload: {} });

    const listRes = await request(app).get('/api/v1/notifications').set(auth);
    expect(listRes.body.data).toHaveLength(2);
    const firstId = listRes.body.data[0]._id as string;

    const readRes = await request(app).post(`/api/v1/notifications/${firstId}/read`).set(auth);
    expect(readRes.status).toBe(200);
    expect(readRes.body.data.isRead).toBe(true);

    let unreadRes = await request(app).get('/api/v1/notifications/unread-count').set(auth);
    expect(unreadRes.body.data.count).toBe(1);

    await request(app).post('/api/v1/notifications/read-all').set(auth);
    unreadRes = await request(app).get('/api/v1/notifications/unread-count').set(auth);
    expect(unreadRes.body.data.count).toBe(0);
  });

  it('only returns the authenticated user’s own notifications, not another user’s in the same org', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const templateId = await createPublishedTemplate(auth);
    await request(app).post('/api/v1/documents').set(auth).send({ templateId, dataPayload: {} });

    const { accessToken: otherToken } = await registerUser(app);
    const otherAuth = { Authorization: `Bearer ${otherToken}` };

    const res = await request(app).get('/api/v1/notifications').set(otherAuth);
    expect(res.body.data).toHaveLength(0);
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });

  it('sends an invite email with a set-password link', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    vi.mocked(enqueueEmailJob).mockClear();

    const res = await request(app)
      .post('/api/v1/users')
      .set(auth)
      .send({ name: 'New Editor', email: 'new-editor@example.test', role: 'editor' });
    expect(res.status).toBe(201);

    expect(enqueueEmailJob).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new-editor@example.test',
        text: expect.stringContaining('/reset-password?token='),
      }),
    );
  });

  it('sends a forgot-password email with a reset link', async () => {
    const { user } = await registerUser(app);
    vi.mocked(enqueueEmailJob).mockClear();

    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email });
    expect(res.status).toBe(200);

    expect(enqueueEmailJob).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        text: expect.stringContaining('/reset-password?token='),
      }),
    );
  });
});
