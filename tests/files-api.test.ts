import { beforeEach, describe, expect, it } from 'vitest';
import * as hashwasm from 'hash-wasm';
import { argon2Hasher, createHandler, type FileStore } from '../supabase/functions/_shared/account-core';
import { createPgliteDb } from '../server/pglite-db';

// The teacher's files on real Postgres (PGlite) with a stand-in file store: who may upload, who may open a file,
// the learning bank, and the clean-up when nothing points at a file any more.

const ORIGIN = 'https://scliffe93.github.io';
let handle: (r: Request) => Promise<Response>;
let stored: Set<string>;
let removed: string[];

async function boot(withFiles = true) {
  const made = await createPgliteDb();
  stored = new Set();
  removed = [];
  const files: FileStore = {
    signUpload: async (key) => { stored.add(key); return `https://store.test/upload/${key}?token=t`; },
    signDownload: async (key, seconds) => `https://store.test/read/${key}?for=${seconds}`,
    remove: async (keys) => { for (const k of keys) { stored.delete(k); removed.push(k); } },
  };
  handle = createHandler(made.db, argon2Hasher(hashwasm), { allowedOrigins: [ORIGIN], now: () => Date.UTC(2026, 10, 19, 10), teacherUsernames: ['Dina'], ...(withFiles ? { files } : {}) });
}
beforeEach(() => boot());

async function call(path: string, opts: { method?: string; body?: unknown; token?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-for': '203.0.113.7' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await handle(new Request(`https://example.supabase.co/functions/v1/account/${path}`, { method: opts.method ?? (opts.body ? 'POST' : 'GET'), headers, body: opts.body ? JSON.stringify(opts.body) : undefined }));
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
async function register(username: string) {
  const r = await call('register', { body: { username, password: 'mi casa es tu casa 2026', firstName: username, remember: true } });
  expect(r.status).toBe(201);
  return { token: r.json.token as string, id: r.json.user.id as string };
}
const put = (token: string, rec: { kind: string; id: string; studentId: string; data: Record<string, unknown> }) => call('platform/records', { method: 'PUT', token, body: rec });
const pdf = { name: 'Los pronombres.pdf', mime: 'application/pdf', size: 120_000 };

describe('teacher files and the learning bank', () => {
  it('only the teacher uploads, and only PDFs or photos up to 10 MB', async () => {
    const dina = await register('dina');
    const sam = await register('sam');
    expect((await call('platform/files', { token: sam.token, body: pdf })).status).toBe(403);
    expect((await call('platform/files', { token: dina.token, body: { ...pdf, mime: 'application/zip' } })).status).toBe(400);
    expect((await call('platform/files', { token: dina.token, body: { ...pdf, size: 11 * 1024 * 1024 } })).status).toBe(400);
    const made = await call('platform/files', { token: dina.token, body: pdf });
    expect(made.status).toBe(201);
    expect(made.json.file).toMatchObject(pdf);
    expect(made.json.file.id).toMatch(/^f-/);
    expect(made.json.uploadUrl).toContain(made.json.file.id);
  });

  it('a student opens only the files their own homework or learning bank points at', async () => {
    const dina = await register('dina');
    const sam = await register('sam');
    const anneka = await register('anneka');
    const learning = (await call('platform/files', { token: dina.token, body: pdf })).json.file;
    const questions = (await call('platform/files', { token: dina.token, body: { ...pdf, name: 'Ejercicios.pdf' } })).json.file;
    // Nothing points at them yet: the teacher can open them, a student cannot.
    expect((await call(`platform/files/${learning.id}`, { token: dina.token })).json.url).toContain(learning.id);
    expect((await call(`platform/files/${learning.id}`, { token: sam.token })).status).toBe(404);
    // Homework for Sam with both files; the explanation also goes in his learning bank.
    expect((await put(dina.token, { kind: 'homework', id: 'hw-00000001', studentId: sam.id, data: { activity: { kind: 'written', title: 'Los pronombres', files: [{ ...learning, role: 'learning' }, { ...questions, role: 'questions' }] }, instructions: '', status: 'assigned', dueAt: '2026-11-25T20:00:00.000Z' } })).status).toBe(200);
    const res = await put(dina.token, { kind: 'resource', id: 'res-00000001', studentId: sam.id, data: { title: 'Los pronombres', file: learning, teacherId: 'someone-else' } });
    expect(res.status).toBe(200);
    expect(res.json.record).toMatchObject({ title: 'Los pronombres', teacherId: dina.id, studentId: sam.id, file: learning });
    expect((await call(`platform/files/${learning.id}`, { token: sam.token })).status).toBe(200);
    expect((await call(`platform/files/${questions.id}`, { token: sam.token })).status).toBe(200);
    expect((await call(`platform/files/${questions.id}`, { token: anneka.token })).status).toBe(404);
    expect((await call('platform/files/not-a-file', { token: sam.token })).status).toBe(400);
    // The bank is each student's own, and a student cannot add to it.
    expect((await call('platform/records?kind=resource', { token: sam.token })).json.records).toHaveLength(1);
    expect((await call('platform/records?kind=resource', { token: anneka.token })).json.records).toEqual([]);
    expect((await put(sam.token, { kind: 'resource', id: 'res-00000002', studentId: sam.id, data: { title: 'x', file: learning } })).status).toBe(403);
    expect((await put(dina.token, { kind: 'resource', id: 'res-00000003', studentId: sam.id, data: { title: 'x' } })).status).toBe(400);
  });

  it('keeps a file while anything points at it and removes it after the last one goes', async () => {
    const dina = await register('dina');
    const sam = await register('sam');
    const learning = (await call('platform/files', { token: dina.token, body: pdf })).json.file;
    await put(dina.token, { kind: 'homework', id: 'hw-00000001', studentId: sam.id, data: { activity: { kind: 'written', title: 'T', files: [{ ...learning, role: 'learning' }] }, instructions: '', status: 'assigned', dueAt: '2026-11-25T20:00:00.000Z' } });
    await put(dina.token, { kind: 'resource', id: 'res-00000001', studentId: sam.id, data: { title: 'T', file: learning } });
    // The homework is deleted: the explanation stays in the learning bank, and so does the file.
    expect((await call('platform/records/delete', { token: dina.token, body: { id: 'hw-00000001' } })).status).toBe(204);
    expect(removed).toEqual([]);
    expect((await call(`platform/files/${learning.id}`, { token: sam.token })).status).toBe(200);
    expect((await call('platform/records/delete', { token: sam.token, body: { id: 'res-00000001' } })).status).toBe(403);
    expect((await call('platform/records/delete', { token: dina.token, body: { id: 'res-00000001' } })).status).toBe(204);
    expect(removed).toEqual([learning.id]);
    expect((await call(`platform/files/${learning.id}`, { token: sam.token })).status).toBe(404);
  });

  it('says so plainly when the file store is not set up', async () => {
    await boot(false);
    const dina = await register('dina');
    expect((await call('platform/files', { token: dina.token, body: pdf })).status).toBe(503);
  });
});
