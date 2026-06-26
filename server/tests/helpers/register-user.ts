import type { Express } from 'express';
import request from 'supertest';

let counter = 0;

export async function registerUser(app: Express, overrides: Partial<Record<string, string>> = {}) {
  counter += 1;
  const payload = {
    organizationName: overrides.organizationName ?? `Test Org ${counter}`,
    name: overrides.name ?? `Test User ${counter}`,
    email: overrides.email ?? `user${counter}@example.test`,
    password: overrides.password ?? 'SuperSecret123',
  };

  const res = await request(app).post('/api/v1/auth/register').send(payload);
  return { accessToken: res.body.data.accessToken as string, user: res.body.data.user };
}
