import { beforeEach, describe, expect, it } from 'vitest';
import * as hashwasm from 'hash-wasm';
import { argon2Hasher, createHandler } from '../supabase/functions/_shared/account-core';
import { generateVapidKeys } from '../supabase/functions/_shared/webpush';
import { createPgliteDb } from '../server/pglite-db';
import { fakePhone } from './helpers/phone';

// Phone notifications end to end on real Postgres (PGlite): a device opts in, the teacher acts,
// the server encrypts and sends, and a fake phone decrypts what arrived at a fake push service.

const ORIGIN = 'https://scliffe93.github.io';
let handle: (r: Request) => Promise<Response>;
let clock = Date.UTC(2026, 10, 12, 10);
type Sent = { endpoint: string; body: Uint8Array; headers: Headers };
let sent: Sent[] = [];
let gone = new Set<string>();

async function setup(withPush = true) {
  const made = await createPgliteDb();
  clock = Date.UTC(2026, 10, 12, 10); sent = []; gone = new Set();
  const keys = await generateVapidKeys();
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const endpoint = String(url);
    if (gone.has(endpoint)) return new Response(null, { status: 410 });
    sent.push({ endpoint, body: new Uint8Array(init!.body as ArrayBuffer), headers: new Headers(init!.headers) });
    return new Response(null, { status: 201 });
  }) as typeof fetch;
  handle = createHandler(made.db, argon2Hasher(hashwasm), { allowedOrigins: [ORIGIN], now: () => clock, teacherUsernames: ['Dina'], push: withPush ? { ...keys, subject: 'https://example.org/', fetch: fakeFetch } : undefined });
  return { pg: made.pg, keys };
}
beforeEach(async () => { await setup(); });

async function call(path: string, opts: { method?: string; body?: unknown; token?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-for': '203.0.113.7' };
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
const put = (token: string, rec: { kind: string; id: string; studentId: string; data: Record<string, unknown> }) => call('platform/records', { method: 'PUT', token, body: rec });
/** A phone that has turned notifications on for an account. */
async function phoneFor(token: string, n = 1) {
  const phone = await fakePhone();
  const endpoint = `https://web.push.apple.com/device-${n}-${Math.random().toString(36).slice(2)}`;
  const r = await call('push/subscribe', { token, body: { endpoint, keys: phone.keys } });
  expect(r.status).toBe(200);
  const inbox = async () => Promise.all(sent.filter((s) => s.endpoint === endpoint).map(async (s) => JSON.parse(await phone.read(s.body)) as { title: string; body: string; url: string; tag: string }));
  return { endpoint, inbox, keys: phone.keys };
}
const hw = (title: string, extra: Record<string, unknown> = {}) => ({ activity: { kind: 'verbs', title }, instructions: '', dueAt: '2026-11-15T20:00:00.000Z', status: 'assigned', assignedAt: '2026-11-12T10:00:00.000Z', ...extra });

describe('phone notifications API', () => {
  it('hands out the public key, stores a device once, and lets it opt out', async () => {
    const { keys } = await setup();
    const sam = await register('sam', 'Sam');
    expect((await call('push/key')).status).toBe(401);
    expect((await call('push/key', { token: sam.token })).json.key).toBe(keys.publicKey);
    const phone = await phoneFor(sam.token);
    await call('push/subscribe', { token: sam.token, body: { endpoint: phone.endpoint, keys: phone.keys } });
    expect((await call('push/status', { token: sam.token })).json).toEqual({ enabled: true, devices: 1 });
    expect((await call('push/unsubscribe', { token: sam.token, body: { endpoint: phone.endpoint } })).status).toBe(204);
    expect((await call('push/status', { token: sam.token })).json.devices).toBe(0);
  });
  it('refuses anything that is not a real push service or real keys', async () => {
    const sam = await register('sam', 'Sam');
    const phone = await fakePhone();
    for (const endpoint of ['https://evil.example/hook', 'http://web.push.apple.com/x', 'https://169.254.169.254/latest', '']) expect((await call('push/subscribe', { token: sam.token, body: { endpoint, keys: phone.keys } })).status).toBe(400);
    expect((await call('push/subscribe', { token: sam.token, body: { endpoint: 'https://web.push.apple.com/x', keys: { p256dh: 'short', auth: phone.keys.auth } } })).status).toBe(400);
    expect(sent).toHaveLength(0);
  });
  it('sends a test notification on request that only that phone can read', async () => {
    const sam = await register('sam', 'Sam');
    const phone = await fakePhone();
    const endpoint = 'https://fcm.googleapis.com/fcm/send/abc123';
    await call('push/subscribe', { token: sam.token, body: { endpoint, keys: phone.keys, test: true } });
    expect(sent).toHaveLength(1);
    expect(sent[0].headers.get('content-encoding')).toBe('aes128gcm');
    expect(sent[0].headers.get('authorization')).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
    expect(new TextDecoder().decode(sent[0].body)).not.toContain('Notifications');
    expect(JSON.parse(await phone.read(sent[0].body)).title).toBe('Notifications are on');
  });
  it('tells the student about new homework, marking, feedback and released blocks, and nobody else', async () => {
    const dina = await register('dina', 'Dina'); const sam = await register('sam', 'Sam'); const ana = await register('ana', 'Ana');
    const samPhone = await phoneFor(sam.token, 1); const anaPhone = await phoneFor(ana.token, 2); const dinaPhone = await phoneFor(dina.token, 3);
    await put(dina.token, { kind: 'homework', id: 'hw-00000001', studentId: sam.id, data: hw('Verb gym: ser y estar') });
    expect(await samPhone.inbox()).toEqual([{ title: 'New homework from Dina', body: 'Verb gym: ser y estar', url: '#/student/homework', tag: 'hw-new' }]);
    // Editing it is not news; marking it is.
    await put(dina.token, { kind: 'homework', id: 'hw-00000001', studentId: sam.id, data: hw('Verb gym: ser y estar', { instructions: 'Aim for 80%' }) });
    expect(await samPhone.inbox()).toHaveLength(1);
    await put(dina.token, { kind: 'homework', id: 'hw-00000001', studentId: sam.id, data: hw('Verb gym: ser y estar', { status: 'reviewed' }) });
    await put(dina.token, { kind: 'homework', id: 'hw-00000001', studentId: sam.id, data: hw('Verb gym: ser y estar', { status: 'reviewed', feedback: { body: 'typo fixed' } }) });
    expect((await samPhone.inbox()).map((m) => m.title)).toEqual(['New homework from Dina', 'Dina has marked your homework']);
    await put(dina.token, { kind: 'feedback', id: 'fb-00000001', studentId: sam.id, data: { kind: 'note', body: 'Great   work on the preterite this week. '.repeat(5), createdAt: '2026-11-12T10:00:00.000Z' } });
    const fb = (await samPhone.inbox())[2];
    expect(fb.title).toBe('New feedback from Dina');
    expect(fb.body.length).toBeLessThanOrEqual(90);
    // Gradual release: turning it on is silent; each later block is news.
    const sid = `student-${sam.id}`;
    await put(dina.token, { kind: 'student', id: sid, studentId: sam.id, data: { maxLevel: null, stepped: true, unlocked: ['verbs-A1-1', 'a1-casa'] } });
    expect(await samPhone.inbox()).toHaveLength(3);
    await put(dina.token, { kind: 'student', id: sid, studentId: sam.id, data: { maxLevel: null, stepped: true, unlocked: ['verbs-A1-1', 'a1-casa', 'verbs-A1-2'] } });
    await put(dina.token, { kind: 'student', id: sid, studentId: sam.id, data: { maxLevel: null, stepped: true, unlocked: ['verbs-A1-1', 'verbs-A1-2'] } }); // locking one again: silent
    await put(dina.token, { kind: 'student', id: sid, studentId: sam.id, data: { maxLevel: null, stepped: true, unlocked: ['verbs-A1-1', 'verbs-A1-2', 'a1-comida'] } });
    expect((await samPhone.inbox()).slice(3)).toEqual([
      { title: 'New verbs unlocked', body: 'Dina has released more for you to practise.', url: '#/verbs', tag: 'release' },
      { title: 'New words unlocked', body: 'Dina has released more for you to practise.', url: '#/review', tag: 'release' },
    ]);
    expect(await anaPhone.inbox()).toEqual([]);
    expect(await dinaPhone.inbox()).toEqual([]);
  });
  it('a weekly plan of several items is one notification, and lessons are announced', async () => {
    const dina = await register('dina', 'Dina'); const sam = await register('sam', 'Sam');
    const phone = await phoneFor(sam.token);
    for (let i = 1; i <= 4; i++) await put(dina.token, { kind: 'homework', id: `plan-000${i}`, studentId: sam.id, data: hw(`Plan item ${i}`, { plan: { week: '2026-W46' } }) });
    expect(await phone.inbox()).toEqual([{ title: 'New homework from Dina', body: 'Your plan for the week is ready.', url: '#/student/homework', tag: 'hw-new' }]);
    clock += 5 * 60_000;
    await put(dina.token, { kind: 'homework', id: 'hw-later-01', studentId: sam.id, data: hw('Listening: en el mercado') });
    expect(await phone.inbox()).toHaveLength(2);
    const lesson = { startsAt: '2026-11-14T17:00:00.000Z', durationMin: 60, tz: 'Europe/Madrid', format: 'online', location: '', topic: 'Ser y estar', prepNotes: '', status: 'scheduled' };
    await put(dina.token, { kind: 'booking', id: 'bk-00000001', studentId: sam.id, data: lesson });
    await put(dina.token, { kind: 'booking', id: 'bk-00000001', studentId: sam.id, data: { ...lesson, prepNotes: 'Bring your notes' } });
    await put(dina.token, { kind: 'booking', id: 'bk-00000001', studentId: sam.id, data: { ...lesson, startsAt: '2026-11-14T18:00:00.000Z' } });
    await put(dina.token, { kind: 'booking', id: 'bk-00000001', studentId: sam.id, data: { ...lesson, startsAt: '2026-11-14T18:00:00.000Z', status: 'cancelled' } });
    expect((await phone.inbox()).slice(2).map((m) => m.title)).toEqual(['Lesson booked with Dina', 'Lesson moved', 'Lesson cancelled']);
  });
  it('tells the teacher when a student hands homework in, once', async () => {
    const dina = await register('dina', 'Dina'); const sam = await register('sam', 'Sam');
    const dinaPhone = await phoneFor(dina.token); const samPhone = await phoneFor(sam.token, 2);
    await put(dina.token, { kind: 'homework', id: 'hw-00000001', studentId: sam.id, data: hw('Write about your weekend') });
    const result = { summary: '120 words', text: 'El fin de semana fui a la playa.' };
    expect((await call('platform/homework/submit', { token: sam.token, body: { id: 'hw-00000001', result } })).status).toBe(200);
    expect((await call('platform/homework/submit', { token: sam.token, body: { id: 'hw-00000001', result } })).status).toBe(200);
    expect(await dinaPhone.inbox()).toEqual([{ title: 'Sam handed in homework', body: 'Write about your weekend', url: '#/teach/homework', tag: 'sub-hw-00000001' }]);
    expect(await samPhone.inbox()).toHaveLength(1); // only the "new homework" one
  });
  it('lets a student report an invoice as paid: the teacher is told once and still confirms it herself', async () => {
    const dina = await register('dina', 'Dina'); const sam = await register('sam', 'Sam'); const ana = await register('ana', 'Ana');
    const dinaPhone = await phoneFor(dina.token, 1); const samPhone = await phoneFor(sam.token, 2);
    const inv = { number: 'LWD-2026-0007', issuedAt: '2026-11-10', dueAt: '2026-11-24', currency: 'GBP', lines: [{ description: 'Lesson', qty: 1, unitPrice: 30 }], discount: 0, total: 30, status: 'draft' };
    const rec = { kind: 'invoice', id: 'inv-00000001', studentId: sam.id };
    await put(dina.token, { ...rec, data: inv });
    expect(await samPhone.inbox()).toEqual([]); // drafts are private
    expect((await call('platform/invoices/report-paid', { token: sam.token, body: { id: rec.id } })).status).toBe(400); // not sent yet
    await put(dina.token, { ...rec, data: { ...inv, status: 'sent' } });
    expect((await samPhone.inbox()).map((m) => m.title)).toEqual(['New invoice from Dina']);
    // Only its owner can report it; the teacher uses Mark paid.
    expect((await call('platform/invoices/report-paid', { token: ana.token, body: { id: rec.id } })).status).toBe(404);
    expect((await call('platform/invoices/report-paid', { token: dina.token, body: { id: rec.id } })).status).toBe(403);
    const r = await call('platform/invoices/report-paid', { token: sam.token, body: { id: rec.id, method: 'Bank transfer', note: '  sent this morning  ' } });
    expect(r.status).toBe(200);
    expect(r.json.record).toMatchObject({ status: 'sent', total: 30, paymentReported: { method: 'Bank transfer', note: 'sent this morning' } }); // status and amount untouched
    await call('platform/invoices/report-paid', { token: sam.token, body: { id: rec.id, method: 'Cash' } });
    expect(await dinaPhone.inbox()).toEqual([{ title: 'Sam says an invoice is paid', body: 'LWD-2026-0007 · Bank transfer. Open the app to confirm it.', url: '#/teach/invoices', tag: 'inv-inv-00000001' }]);
    const seen = (await call(`platform/records?kind=invoice&studentId=${sam.id}`, { token: dina.token })).json.records[0];
    expect(seen.paymentReported.method).toBe('Cash');
    await put(dina.token, { ...rec, data: { ...seen, status: 'paid', paidAt: '2026-11-12', paymentMethod: 'cash' } });
    expect((await samPhone.inbox()).map((m) => m.title)).toEqual(['New invoice from Dina', 'Payment received']);
    expect((await call('platform/invoices/report-paid', { token: sam.token, body: { id: rec.id } })).status).toBe(400); // already paid
  });
  it('forgets a phone the push service says is gone, and keeps working without notifications set up', async () => {
    const { pg } = await setup();
    const dina = await register('dina', 'Dina'); const sam = await register('sam', 'Sam');
    const old = await phoneFor(sam.token, 1); const current = await phoneFor(sam.token, 2);
    gone.add(old.endpoint);
    expect((await put(dina.token, { kind: 'homework', id: 'hw-00000001', studentId: sam.id, data: hw('Verbs') })).status).toBe(200);
    expect(await current.inbox()).toHaveLength(1);
    expect((await pg.query<{ endpoint: string }>('select endpoint from public.lwd_push')).rows.map((r) => r.endpoint)).toEqual([current.endpoint]);
    // Deleting the account removes its devices.
    await call('delete-account', { token: sam.token, body: { password: 'mi casa es tu casa 2026' } });
    expect((await pg.query('select 1 from public.lwd_push')).rows).toHaveLength(0);
    // No keys configured: everything else still works.
    await setup(false);
    const d2 = await register('dina', 'Dina'); const s2 = await register('sam', 'Sam');
    expect((await call('push/key', { token: s2.token })).json.key).toBeNull();
    expect((await call('push/subscribe', { token: s2.token, body: { endpoint: 'https://web.push.apple.com/x', keys: (await fakePhone()).keys } })).status).toBe(503);
    expect((await put(d2.token, { kind: 'homework', id: 'hw-00000001', studentId: s2.id, data: hw('Verbs') })).status).toBe(200);
  });
});
