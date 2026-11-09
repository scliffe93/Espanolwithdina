import { beforeEach, describe, expect, it } from 'vitest';
import * as hashwasm from 'hash-wasm';
import { argon2Hasher, createHandler } from '../supabase/functions/_shared/account-core';
import { createPgliteDb } from '../server/pglite-db';

const ORIGIN = 'https://scliffe93.github.io';
let handle: (r: Request) => Promise<Response>;
const PW = 'mi casa es tu casa 2026';

beforeEach(async () => {
  const made = await createPgliteDb();
  handle = createHandler(made.db, argon2Hasher(hashwasm), { allowedOrigins: [ORIGIN], now: () => Date.UTC(2026, 10, 9, 10), teacherUsernames: ['dina'], adminUsernames: ['admin'] });
});
async function call(path: string, opts: { method?: string; body?: unknown; token?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-for': '203.0.113.9' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await handle(new Request(`https://example.supabase.co/functions/v1/account/${path}`, { method: opts.method ?? (opts.body ? 'POST' : 'GET'), headers, body: opts.body ? JSON.stringify(opts.body) : undefined }));
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
async function register(username: string, firstName = username) {
  const r = await call('register', { body: { username, password: PW, firstName, remember: true } });
  expect(r.status).toBe(201);
  return { token: r.json.token as string, id: r.json.user.id as string, role: r.json.user.role as string };
}

describe('admin API', () => {
  it('gives the configured username the admin role, above the teacher', async () => {
    const admin = await register('admin', 'Sam');
    expect(admin.role).toBe('admin');
    const dina = await register('dina', 'Dina');
    const sam = await register('sam_s', 'Sam');
    expect((await call('admin/overview', { token: dina.token })).status).toBe(403);
    expect((await call('admin/overview', { token: sam.token })).status).toBe(403);
    const ov = await call('admin/overview', { token: admin.token });
    expect(ov.status).toBe(200);
    expect(ov.json.users).toEqual({ admin: 1, teacher: 1, student: 1 });
    expect(ov.json.activeUsers7d).toBe(3);
    // The admin can use the teacher endpoints too.
    expect((await call('platform/people', { token: admin.token })).json.people.map((p: { username: string }) => p.username)).toEqual(['sam_s']);
  });

  it('lists every account with activity, changes roles, resets passwords and removes accounts', async () => {
    const admin = await register('admin', 'Owner');
    const dina = await register('dina', 'Dina');
    const sam = await register('sam_s', 'Sam');
    const list = await call('admin/users', { token: admin.token });
    expect(list.json.users.map((u: { username: string; role: string }) => `${u.username}:${u.role}`)).toEqual(['admin:admin', 'dina:teacher', 'sam_s:student']);
    expect(list.json.users.find((u: { username: string }) => u.username === 'sam_s').lastSeenAt).toBeTruthy();
    // Role change signs the person out so they come back with the new role.
    expect((await call('admin/users/role', { token: admin.token, body: { userId: sam.id, role: 'teacher' } })).json.user.role).toBe('teacher');
    expect((await call('me', { token: sam.token })).status).toBe(401);
    expect((await call('login', { body: { username: 'sam_s', password: PW, remember: false } })).json.user.role).toBe('teacher');
    expect((await call('admin/users/role', { token: admin.token, body: { userId: sam.id, role: 'admin' } })).status).toBe(400);
    expect((await call('admin/users/role', { token: admin.token, body: { userId: admin.id, role: 'student' } })).status).toBe(400);
    // Password reset: generated temporary password + new recovery code; old password stops working.
    const reset = await call('admin/users/reset-password', { token: admin.token, body: { userId: dina.id } });
    expect(reset.status).toBe(200);
    expect(reset.json.password).toMatch(/\d{2}$/);
    expect(reset.json.recoveryCode).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect((await call('login', { body: { username: 'dina', password: PW, remember: false } })).status).toBe(401);
    expect((await call('login', { body: { username: 'dina', password: reset.json.password, remember: false } })).json.user.role).toBe('teacher');
    // Removal cascades; admins cannot be removed or delete themselves here.
    expect((await call('admin/users/delete', { token: admin.token, body: { userId: admin.id } })).status).toBe(400);
    expect((await call('admin/users/delete', { token: admin.token, body: { userId: sam.id } })).status).toBe(204);
    expect((await call('login', { body: { username: 'sam_s', password: PW, remember: false } })).status).toBe(401);
    expect((await call('admin/users', { token: admin.token })).json.users).toHaveLength(2);
  });
});
