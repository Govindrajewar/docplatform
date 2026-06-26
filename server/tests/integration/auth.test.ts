import { ROLE_PERMISSIONS, SYSTEM_ROLES } from '@platform/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { connectDatabase, disconnectDatabase } from '../../src/config/db';
import { RoleModel } from '../../src/models/role.model';

const app = createApp();

const credentials = {
  organizationName: 'Acme Statements',
  name: 'Ada Admin',
  email: 'ada@acme.test',
  password: 'SuperSecret123',
};

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

describe('POST /api/v1/auth/register', () => {
  it('creates an organization + admin user and returns tokens', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(credentials);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(credentials.email);
    expect(res.headers['set-cookie']?.[0]).toContain('refreshToken=');
  });

  it('rejects a duplicate email with 409 CONFLICT', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(credentials);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('rejects an incorrect password with a generic message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('locks the account after 5 failed attempts and returns the same generic message', async () => {
    for (let i = 0; i < 4; i += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'lockout@acme.test', password: 'whatever' });
    }
    // Register a fresh user dedicated to this test to avoid interference with the shared-state tests above.
    await request(app).post('/api/v1/auth/register').send({
      organizationName: 'Lockout Org',
      name: 'Lock Out',
      email: 'lockout@acme.test',
      password: 'CorrectPass123',
    });

    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'lockout@acme.test', password: 'wrong-password' });
    }

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'lockout@acme.test', password: 'CorrectPass123' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user with a valid token', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(credentials.email);
    expect(res.body.data.role).toBe('admin');
  });
});

describe('POST /api/v1/auth/forgot-password', () => {
  it('returns 200 regardless of whether the email exists (anti-enumeration)', async () => {
    const known = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: credentials.email });
    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@nowhere.test' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.data.message).toBe(unknown.body.data.message);
  });
});
