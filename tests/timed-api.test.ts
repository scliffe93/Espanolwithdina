import { beforeEach, describe, expect, it } from 'vitest';
import * as hashwasm from 'hash-wasm';
import { argon2Hasher, createHandler } from '../supabase/functions/_shared/account-core';
import { generateVapidKeys } from '../supabase/functions/_shared/webpush';
import { lessonBrief, streakOf } from '../supabase/functions/_shared/brief';
import { createPgliteDb } from '../server/pglite-db';
import { fakePhone } from './helpers/phone';

// Timed notifications and problem reports on real Postgres (PGlite): the daily reminder at the time a student chose,
// the brief the teacher gets before each lesson, and problems going to the administrator.

const ORIGIN = 'https://scliffe93.github.io';
const SECRET = 'cron-secret-for-tests-0123456789';
let handle: (r: Request) => Promise<Response>;
let clock = 0;
type Sent = { endpoint: string; body: Uint8Array };
let sent: Sent[] = [];

beforeEach(async () => {
  const made = await createPgliteDb();
  clock = Date.UTC(2026, 10, 16, 17, 0); sent = []; // Monday 16 November 2026, 17:00 UTC = 18:00 in Madrid
  const keys = await generateVapidKeys();
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => { sent.push({ endpoint: String(url), body: new Uint8Array(init!.body as ArrayBuffer) }); return new Response(null, { status: 201 }); }) as typeof fetch;
  handle = createHandler(made.db, argon2Hasher(hashwasm), { allowedOrigins: [ORIGIN], now: () => clock, teacherUsernames: ['Dina'], adminUsernames: ['boss'], cronSecret: SECRET, push: { ...keys, subject: 'https://example.org/', fetch: fakeFetch } });
});

async function call(path: string, opts: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-for': '203.0.113.7', ...(opts.headers ?? {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await handle(new Request(`https://example.supabase.co/functions/v1/account/${path}`, { method: opts.method ?? (opts.body ? 'POST' : 'GET'), headers, body: opts.body ? JSON.stringify(opts.body) : undefined }));
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
async function register(username: string, firstName = username) {
  const r = await call('register', { body: { username, password: 'mi casa es tu casa 2026', firstName, remember: true } });
  expect(r.status).toBe(201);
  return { token: r.json.token as string, id: r.json.user.id as string };
}
async function phoneFor(token: string) {
  const phone = await fakePhone();
  const endpoint = `https://web.push.apple.com/device-${Math.random().toString(36).slice(2)}`;
  expect((await call('push/subscribe', { token, body: { endpoint, keys: phone.keys } })).status).toBe(200);
  return { inbox: async () => Promise.all(sent.filter((s) => s.endpoint === endpoint).map(async (s) => JSON.parse(await phone.read(s.body)) as { title: string; body: string; url: string; tag: string })) };
}
const tick = () => call('cron/tick', { method: 'POST', headers: { 'x-cron-secret': SECRET } });
const day = (activeSeconds: number, extra: Record<string, unknown> = {}) => ({ activeSeconds, exercisesAttempted: 0, exercisesCorrect: 0, mistakes: [], ...extra });

describe('the daily reminder', () => {
  it('needs the scheduler secret', async () => {
    expect((await call('cron/tick', { method: 'POST' })).status).toBe(403);
    expect((await call('cron/tick', { method: 'POST', headers: { 'x-cron-secret': 'wrong-secret-of-the-same-length!!' } })).status).toBe(403);
    expect((await tick()).status).toBe(200);
  });

  it('goes out once, at the time the student chose in their own time zone', async () => {
    const sam = await register('sam', 'Sam');
    const phone = await phoneFor(sam.token);
    expect((await call('reminder', { token: sam.token })).json).toMatchObject({ enabled: false, time: '18:00', available: true });
    clock = Date.UTC(2026, 10, 16, 9, 0); // set in the morning
    expect((await call('reminder', { method: 'PUT', token: sam.token, body: { enabled: true, time: '18:30', tz: 'Europe/Madrid' } })).status).toBe(200);
    clock = Date.UTC(2026, 10, 16, 17, 0); // 18:00 in Madrid: too early
    expect((await tick()).json.reminders).toBe(0);
    clock = Date.UTC(2026, 10, 16, 17, 35); // 18:35 in Madrid
    expect((await tick()).json.reminders).toBe(1);
    expect((await tick()).json.reminders).toBe(0); // once a day
    const inbox = await phone.inbox();
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ title: 'Five minutes of Spanish?', url: '#/verbs?start=1', tag: 'daily' });
    expect(inbox[0].body).toContain('Sam');
    clock = Date.UTC(2026, 10, 17, 17, 40); // the next day
    expect((await tick()).json.reminders).toBe(1);
  });

  it('names the streak, and stays quiet when the student has already practised or switched it off', async () => {
    const sam = await register('sam', 'Sam');
    const phone = await phoneFor(sam.token);
    clock = Date.UTC(2026, 10, 16, 9, 0);
    await call('reminder', { method: 'PUT', token: sam.token, body: { enabled: true, time: '18:00', tz: 'Europe/Madrid' } });
    await call('progress', { method: 'PUT', token: sam.token, body: { baseVersion: 0, deviceId: 'd', data: { days: { '2026-11-13': day(600), '2026-11-14': day(300), '2026-11-15': day(400) } } } });
    clock = Date.UTC(2026, 10, 16, 17, 5);
    expect((await tick()).json.reminders).toBe(1);
    expect((await phone.inbox())[0].title).toBe('Keep your 3-day streak going');
    // Tuesday: already practised by the time the reminder is due.
    await call('progress', { method: 'PUT', token: sam.token, body: { baseVersion: 1, deviceId: 'd', data: { days: { '2026-11-16': day(300), '2026-11-17': day(240) } } } });
    clock = Date.UTC(2026, 10, 17, 17, 5);
    expect((await tick()).json.reminders).toBe(0);
    // Wednesday: switched off.
    await call('reminder', { method: 'PUT', token: sam.token, body: { enabled: false, time: '18:00', tz: 'Europe/Madrid' } });
    clock = Date.UTC(2026, 10, 18, 17, 5);
    expect((await tick()).json.reminders).toBe(0);
    expect(await phone.inbox()).toHaveLength(1);
  });

  it('rejects a time or a time zone that makes no sense', async () => {
    const sam = await register('sam');
    expect((await call('reminder', { method: 'PUT', token: sam.token, body: { enabled: true, time: '25:00', tz: 'Europe/Madrid' } })).status).toBe(400);
    expect((await call('reminder', { method: 'PUT', token: sam.token, body: { enabled: true, time: '18:00', tz: 'Mars/Olympus' } })).status).toBe(400);
  });
});

describe('the brief before each lesson', () => {
  it('reaches the teacher once, a day before, with what the student did', async () => {
    const dina = await register('dina', 'Dina');
    const sam = await register('sam', 'Sam');
    const phone = await phoneFor(dina.token);
    const put = (id: string, kind: string, data: Record<string, unknown>) => call('platform/records', { method: 'PUT', token: dina.token, body: { kind, id, studentId: sam.id, data } });
    clock = Date.UTC(2026, 10, 16, 8, 0);
    expect((await put('booking-last-1', 'booking', { startsAt: '2026-11-09T18:00:00.000Z', durationMin: 60, status: 'completed' })).status).toBe(200);
    expect((await put('booking-next-1', 'booking', { startsAt: '2026-11-16T18:00:00.000Z', durationMin: 60, status: 'scheduled' })).status).toBe(200);
    await put('homework-a-1', 'homework', { activity: { title: 'Preterite drill' }, status: 'assigned', assignedAt: '2026-11-10T10:00:00.000Z', dueAt: '2026-11-14T20:00:00.000Z' });
    await call('progress', { method: 'PUT', token: sam.token, body: { baseVersion: 0, deviceId: 'd', data: { days: {
      '2026-11-11': day(900, { exercisesAttempted: 20, exercisesCorrect: 14, mistakes: [{ at: Date.UTC(2026, 10, 11, 12), category: 'stem-change', expected: 'quiero', context: 'Conjugate · querer' }, { at: Date.UTC(2026, 10, 11, 12), category: 'stem-change', expected: 'puedes', context: 'Conjugate · poder' }] }),
      '2026-11-13': day(600, { exercisesAttempted: 10, exercisesCorrect: 9 }),
      '2026-11-01': day(5000, { exercisesAttempted: 100, exercisesCorrect: 100 }), // before the last lesson: not counted
    } } } });
    clock = Date.UTC(2026, 10, 15, 17, 30); // more than a day before: too early
    expect((await tick()).json.briefs).toBe(0);
    clock = Date.UTC(2026, 10, 15, 18, 5); // just inside 24 hours before
    expect((await tick()).json.briefs).toBe(1);
    expect((await tick()).json.briefs).toBe(0);
    clock = Date.UTC(2026, 10, 16, 17, 55); // five minutes before: still only the one
    expect((await tick()).json.briefs).toBe(0);
    const briefs = (await phone.inbox()).filter((m) => m.tag.startsWith('brief-'));
    expect(briefs).toHaveLength(1);
    expect(briefs[0].title).toBe('Lesson with Sam tomorrow');
    expect(briefs[0].body).toBe('Practised 2 days, 25 min, 77% correct. Keeps slipping on stem changes (querer, poder). 1 homework overdue.');
    expect(briefs[0].url).toBe(`#/teach/student/${sam.id}`);
  });

  it('skips cancelled lessons, and briefs again when a lesson is moved', async () => {
    const dina = await register('dina', 'Dina');
    const sam = await register('sam', 'Sam');
    await phoneFor(dina.token);
    const put = (data: Record<string, unknown>) => call('platform/records', { method: 'PUT', token: dina.token, body: { kind: 'booking', id: 'booking-next-1', studentId: sam.id, data } });
    clock = Date.UTC(2026, 10, 16, 17, 15);
    await put({ startsAt: '2026-11-16T18:00:00.000Z', durationMin: 60, status: 'cancelled' });
    expect((await tick()).json.briefs).toBe(0);
    await put({ startsAt: '2026-11-16T18:00:00.000Z', durationMin: 60, status: 'scheduled' });
    expect((await tick()).json.briefs).toBe(1);
    await put({ startsAt: '2026-11-17T17:00:00.000Z', durationMin: 60, status: 'scheduled' });
    expect((await tick()).json.briefs).toBe(1); // the new time is tomorrow: a fresh brief straight away
    expect((await tick()).json.briefs).toBe(0);
  });

  it('says so plainly when nothing was practised', () => {
    const b = lessonBrief({}, [], Date.UTC(2026, 10, 9), Date.UTC(2026, 10, 16));
    expect(b.line).toBe('No practice since the last lesson.');
    expect(b.suggestions[0]).toMatch(/warm-up/);
    expect(streakOf({ '2026-11-15': { activeSeconds: 90 }, '2026-11-14': { activeSeconds: 90 } }, '2026-11-16')).toBe(2);
    expect(streakOf({ '2026-11-13': { activeSeconds: 90 } }, '2026-11-16')).toBe(0);
  });
});

describe('problem reports', () => {
  it('go to the administrator, who alone can read and clear them', async () => {
    const boss = await register('boss', 'Boss');
    const dina = await register('dina', 'Dina');
    const sam = await register('sam', 'Sam');
    const phone = await phoneFor(boss.token);
    const report = (message: string, kind = 'crash') => call('report', { token: sam.token, body: { kind, message, where: 'verbs', detail: 'stack…', device: 'iPhone', build: '2026-11-15 14:00' } });
    expect((await report("Cannot read properties of undefined (reading 'es')")).json).toMatchObject({ stored: true });
    expect((await report("Cannot read properties of undefined (reading 'es')")).json).toMatchObject({ stored: false }); // the same fault again
    expect((await report('The voice did not start', 'voice')).json).toMatchObject({ stored: true });
    expect((await call('report', { body: { kind: 'crash', message: 'x' } })).status).toBe(401);
    expect((await call('admin/reports', { token: sam.token })).status).toBe(403);
    expect((await call('admin/reports', { token: dina.token })).status).toBe(403);
    const list = await call('admin/reports', { token: boss.token });
    expect(list.json.reports).toHaveLength(2);
    expect(list.json.reports.find((r: { kind: string }) => r.kind === 'crash')).toMatchObject({ username: 'sam', firstName: 'Sam', where: 'verbs', device: 'iPhone', build: '2026-11-15 14:00' });
    const inbox = await phone.inbox();
    expect(inbox).toHaveLength(1); // only the page that stopped, and only once an hour
    expect(inbox[0]).toMatchObject({ title: 'A page stopped for Sam', url: '#/admin' });
    expect((await call('admin/reports/clear', { token: boss.token, body: { id: list.json.reports[0].id } })).status).toBe(204);
    expect((await call('admin/reports', { token: boss.token })).json.reports).toHaveLength(1);
    expect((await call('admin/reports/clear', { token: boss.token, body: {} })).status).toBe(204);
    expect((await call('admin/reports', { token: boss.token })).json.reports).toHaveLength(0);
  });

  it('cannot be flooded by one device', async () => {
    const boss = await register('boss');
    const sam = await register('sam');
    for (let i = 0; i < 35; i++) await call('report', { token: sam.token, body: { kind: 'error', message: `fault ${i}` } });
    expect((await call('admin/reports', { token: boss.token })).json.reports).toHaveLength(30);
  });
});
