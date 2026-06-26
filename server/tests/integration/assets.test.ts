import { ROLE_PERMISSIONS, SYSTEM_ROLES } from '@platform/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { connectDatabase, disconnectDatabase } from '../../src/config/db';
import { OrganizationModel } from '../../src/models/organization.model';
import { RoleModel } from '../../src/models/role.model';
import { storageDriver } from '../../src/storage';
import { registerUser } from '../helpers/register-user';

const app = createApp();

// A valid 1x1 transparent PNG.
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const SVG_WITH_SCRIPT = Buffer.from(
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
  'utf-8',
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

describe('Assets upload pipeline', () => {
  it('accepts a valid PNG, sniffing the real MIME type', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('type', 'logo')
      .attach('file', PNG_BUFFER, 'logo.png');

    expect(res.status).toBe(201);
    expect(res.body.data.mimeType).toBe('image/png');
    expect(res.body.data.type).toBe('logo');
  });

  it('sanitizes <script> content out of an uploaded SVG', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };

    const uploadRes = await request(app)
      .post('/api/v1/assets')
      .set(auth)
      .field('type', 'icon')
      .attach('file', SVG_WITH_SCRIPT, 'icon.svg');
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.mimeType).toBe('image/svg+xml');

    // supertest doesn't auto-buffer image/svg+xml into res.text, so read the stored bytes directly.
    const stored = await storageDriver.read(uploadRes.body.data.storageKey);
    expect(stored.toString('utf-8')).not.toContain('<script');
  });

  it('rejects a file whose content cannot be verified as an allowed type', async () => {
    const { accessToken } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('type', 'logo')
      .attach('file', Buffer.from('not a real image'), 'fake.png');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('blocks deleting an asset referenced by the organization logo', async () => {
    const { accessToken, user } = await registerUser(app);
    const uploadRes = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('type', 'logo')
      .attach('file', PNG_BUFFER, 'logo.png');
    const assetId = uploadRes.body.data._id;

    await OrganizationModel.findByIdAndUpdate(user.organizationId, { logoAssetId: assetId });

    const deleteRes = await request(app)
      .delete(`/api/v1/assets/${assetId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(deleteRes.status).toBe(409);
  });

  it('deduplicates identical uploads by checksum', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };

    const first = await request(app)
      .post('/api/v1/assets')
      .set(auth)
      .field('type', 'logo')
      .attach('file', PNG_BUFFER, 'a.png');
    const second = await request(app)
      .post('/api/v1/assets')
      .set(auth)
      .field('type', 'logo')
      .attach('file', PNG_BUFFER, 'b.png');

    expect(first.body.data._id).toBe(second.body.data._id);
  });
});
