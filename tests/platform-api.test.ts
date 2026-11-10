import { beforeEach, describe, expect, it } from 'vitest';
import * as hashwasm from 'hash-wasm';
import { argon2Hasher, createHandler } from '../supabase/functions/_shared/account-core';
import { createPgliteDb } from '../server/pglite-db';

// The teaching platform API on real Postgres (PGlite): one teacher (the configured
// username), students are everyone else; every row is scoped by role.

const ORIGIN = 'https://scliffe93.github.io';
let handle: (r: Request) => Promise<Response>;
let clock = Date.UTC(2026, 10, 6, 10);

beforeEach(async () => {
  const made = await createPgliteDb();
  clock = Date.UTC(2026, 10, 6, 10);
  handle = createHandler(made.db, argon2Hasher(hashwasm), { allowedOrigins: [ORIGIN], now: () => clock, teacherUsernames: ['Dina'] });
});

async function call(path: string, opts: { method?: string; body?: unknown; token?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-for': '203.0.113.7' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await handle(new Request(`https://example.supabase.co/functions/v1/account/${path}`, { method: opts.method ?? (opts.body ? 'POST' : 'GET'), headers, body: opts.body ? JSON.stringify(opts.body) : undefined }));
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

const PW = 'mi casa es tu casa 2026';
async function register(username: string, firstName = username) {
  const r = await call('register', { body: { username, password: PW, firstName, remember: true } });
  expect(r.status).toBe(201);
  return { token: r.json.token as string, id: r.json.user.id as string, role: r.json.user.role as string };
}

const put = (token: string, rec: { kind: string; id: string; studentId: string; data: Record<string, unknown> }) => call('platform/records', { method: 'PUT', token, body: rec });
const list = (token: string, kind: string, studentId?: string) => call(`platform/records?kind=${kind}${studentId ? `&studentId=${studentId}` : ''}`, { token });
const at = (h: number) => new Date(Date.UTC(2026, 10, 10, h)).toISOString();
const booking = (studentId: string, h: number, extra: Record<string, unknown> = {}) => ({ startsAt: at(h), durationMin: 60, tz: 'Europe/Madrid', format: 'online', location: 'https://meet', topic: 'Ser y estar', prepNotes: '', status: 'scheduled', createdAt: at(0), updatedAt: at(0), studentId, ...extra });

describe('teaching platform API', () => {
  it('lets the teacher add a student account and hand over its login details', async () => {
    const dina = await register('dina', 'Dina');
    const sam = await register('sam', 'Sam');
    expect((await call('platform/students', { token: sam.token, body: { username: 'lucia', firstName: 'Lucía' } })).status).toBe(403);
    const made = await call('platform/students', { token: dina.token, body: { username: 'lucia', firstName: 'Lucía' } });
    expect(made.status).toBe(201);
    expect(made.json.user).toMatchObject({ username: 'lucia', firstName: 'Lucía', role: 'student' });
    expect(made.json.password).toMatch(/^[a-záéíóúñ]+ [a-záéíóúñ]+ [a-záéíóúñ]+ \d{2}$/);
    expect(made.json.recoveryCode).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    const login = await call('login', { body: { username: 'Lucia', password: made.json.password, remember: true } });
    expect(login.status).toBe(200);
    expect(login.json.user.role).toBe('student');
    const own = await call('platform/students', { token: dina.token, body: { username: 'pedro', firstName: 'Pedro', password: 'una contraseña elegida' } });
    expect(own.status).toBe(201);
    expect(own.json.password).toBeUndefined();
    expect((await call('login', { body: { username: 'pedro', password: 'una contraseña elegida', remember: false } })).status).toBe(200);
    expect((await call('platform/students', { token: dina.token, body: { username: 'LUCIA', firstName: 'Again' } })).status).toBe(409);
    expect((await call('platform/students', { token: dina.token, body: { username: 'x', firstName: 'Bad' } })).status).toBe(400);
    expect((await call('platform/people', { token: dina.token })).json.people.map((p: { username: string }) => p.username)).toEqual(['lucia', 'pedro', 'sam']);
  });

  it('gives the configured username the teacher role and everyone else the student role', async () => {
    const dina = await register('dina', 'Dina');
    const sam = await register('sam', 'Sam');
    expect(dina.role).toBe('teacher');
    expect(sam.role).toBe('student');
    expect((await call('me', { token: dina.token })).json.user.role).toBe('teacher');
    const login = await call('login', { body: { username: 'DINA', password: PW, remember: false } });
    expect(login.json.user.role).toBe('teacher');
  });

  it('lists people by role: the teacher sees her students, a student only themself', async () => {
    const dina = await register('dina', 'Dina');
    const sam = await register('sam', 'Sam');
    await register('anneka', 'Anneka');
    const teacherView = await call('platform/people', { token: dina.token });
    expect(teacherView.json.people.map((p: { username: string }) => p.username)).toEqual(['anneka', 'sam']);
    const samView = await call('platform/people', { token: sam.token });
    expect(samView.json.people).toEqual([{ id: sam.id, username: 'sam', firstName: 'Sam', role: 'student' }]);
  });

  it('books lessons for the teacher only, prevents overlaps and ignores cancelled ones', async () => {
    const dina = await register('dina', 'Dina');
    const sam = await register('sam', 'Sam');
    const anneka = await register('anneka', 'Anneka');
    const ok = await put(dina.token, { kind: 'booking', id: 'bk-00000001', studentId: sam.id, data: booking(sam.id, 10, { teacherId: 'spoofed' }) });
    expect(ok.status).toBe(200);
    expect(ok.json.record.teacherId).toBe(dina.id);
    const clash = await put(dina.token, { kind: 'booking', id: 'bk-00000002', studentId: anneka.id, data: booking(anneka.id, 10.5) });
    expect(clash.status).toBe(409);
    expect(clash.json.error).toBe('overlap');
    expect(clash.json.clash.id).toBe('bk-00000001');
    // Reschedule (same id) is not a clash with itself; cancelling frees the slot.
    expect((await put(dina.token, { kind: 'booking', id: 'bk-00000001', studentId: sam.id, data: booking(sam.id, 10, { prepNotes: 'bring notes' }) })).status).toBe(200);
    expect((await put(dina.token, { kind: 'booking', id: 'bk-00000001', studentId: sam.id, data: booking(sam.id, 10, { status: 'cancelled' }) })).status).toBe(200);
    expect((await put(dina.token, { kind: 'booking', id: 'bk-00000002', studentId: anneka.id, data: booking(anneka.id, 10.5) })).status).toBe(200);
    // Students cannot book, and cannot see each other's lessons.
    expect((await put(sam.token, { kind: 'booking', id: 'bk-00000003', studentId: sam.id, data: booking(sam.id, 14) })).status).toBe(403);
    const samList = await list(sam.token, 'booking');
    expect(samList.json.records.map((b: { id: string }) => b.id)).toEqual(['bk-00000001']);
    const annekaList = await list(anneka.token, 'booking');
    expect(annekaList.json.records.map((b: { id: string }) => b.id)).toEqual(['bk-00000002']);
    expect((await list(dina.token, 'booking')).json.records).toHaveLength(2);
    expect((await list(dina.token, 'booking', sam.id)).json.records).toHaveLength(1);
  });

  it('homework: the teacher assigns and reviews, the student submits only their own', async () => {
    const dina = await register('dina', 'Dina');
    const sam = await register('sam', 'Sam');
    const anneka = await register('anneka', 'Anneka');
    const hw = { activity: { kind: 'verbs', title: 'Present tense: ser, estar' }, instructions: 'Ten minutes', assignedAt: at(0), dueAt: at(20), status: 'assigned' };
    expect((await put(sam.token, { kind: 'homework', id: 'hw-00000001', studentId: sam.id, data: hw })).status).toBe(403);
    expect((await put(dina.token, { kind: 'homework', id: 'hw-00000001', studentId: sam.id, data: hw })).status).toBe(200);
    expect((await put(dina.token, { kind: 'homework', id: 'hw-00000001', studentId: 'not-a-uuid', data: hw })).status).toBe(400);
    expect((await list(anneka.token, 'homework')).json.records).toEqual([]);
    expect((await list(sam.token, 'homework')).json.records).toHaveLength(1);
    const wrong = await call('platform/homework/submit', { token: anneka.token, body: { id: 'hw-00000001', result: { score: 1 } } });
    expect(wrong.status).toBe(403);
    const done = await call('platform/homework/submit', { token: sam.token, body: { id: 'hw-00000001', result: { score: 0.75, summary: '9/12 correct' } } });
    expect(done.status).toBe(200);
    expect(done.json.record).toMatchObject({ status: 'submitted', studentId: sam.id, teacherId: dina.id, result: { score: 0.75, completedAt: new Date(clock).toISOString() } });
    const reviewed = await put(dina.token, { kind: 'homework', id: 'hw-00000001', studentId: sam.id, data: { ...done.json.record, status: 'reviewed', feedback: { body: 'Great', at: at(21) } } });
    expect(reviewed.status).toBe(200);
    const again = await call('platform/homework/submit', { token: sam.token, body: { id: 'hw-00000001', result: { score: 1 } } });
    expect(again.json.record.status).toBe('reviewed'); // a redo never un-reviews
    expect(again.json.record.feedback.body).toBe('Great');
    // Only the teacher deletes; a record id can't be hijacked for another kind or student.
    expect((await call('platform/records/delete', { token: sam.token, body: { id: 'hw-00000001' } })).status).toBe(403);
    expect((await put(anneka.token, { kind: 'activity', id: 'hw-00000001', studentId: anneka.id, data: { type: 'login', label: 'x', at: at(1) } })).status).toBe(409);
    expect((await call('platform/records/delete', { token: dina.token, body: { id: 'hw-00000001' } })).status).toBe(204);
    expect((await list(sam.token, 'homework')).json.records).toEqual([]);
  });

  it('submitting a plan item creates an adaptive follow-up once', async () => {
    const dina = await register('dina', 'Dina');
    const sam = await register('sam', 'Sam');
    const hw = { activity: { kind: 'verbs', title: 'Verb gym: querer, poder (present)', verbs: ['querer', 'poder', 'salir', 'ir'], tense: 'present' }, instructions: '', assignedAt: at(0), dueAt: at(20), status: 'assigned', plan: { week: '2026-11-09', day: 2 } };
    expect((await put(dina.token, { kind: 'homework', id: 'hw-plan-0001', studentId: sam.id, data: hw })).status).toBe(200);
    const low = await call('platform/homework/submit', { token: sam.token, body: { id: 'hw-plan-0001', result: { score: 0.3 } } });
    expect(low.status).toBe(200);
    expect(low.json.followUp).toMatchObject({ id: 'hw-plan-0001-fu', studentId: sam.id, teacherId: dina.id, plan: { adaptive: 'retry', sourceId: 'hw-plan-0001' } });
    expect(low.json.followUp.activity.verbs).toHaveLength(3);
    const again = await call('platform/homework/submit', { token: sam.token, body: { id: 'hw-plan-0001', result: { score: 0.2 } } });
    expect(again.json.followUp).toBeNull(); // only once per source item
    const list = await call('platform/records?kind=homework', { token: sam.token });
    expect(list.json.records.map((h: { id: string }) => h.id).sort()).toEqual(['hw-plan-0001', 'hw-plan-0001-fu']);
    // Re-tries never spawn another re-try.
    const retry = await call('platform/homework/submit', { token: sam.token, body: { id: 'hw-plan-0001-fu', result: { score: 0.1 } } });
    expect(retry.json.followUp).toBeNull();
  });

  it('invoices: the teacher writes, the student reads only their own; settings belong to the teacher', async () => {
    const dina = await register('dina', 'Dina');
    const sam = await register('sam', 'Sam');
    const anneka = await register('anneka', 'Anneka');
    const invoice = { number: 'LWD-2026-0001', issuedAt: '2026-11-10', dueAt: '2026-11-24', currency: 'GBP', lines: [{ description: 'Lesson', qty: 1, unitPrice: 35 }], discount: 0, total: 35, status: 'sent', createdAt: at(0), updatedAt: at(0) };
    expect((await put(sam.token, { kind: 'invoice', id: 'inv-00000001', studentId: sam.id, data: invoice })).status).toBe(403);
    expect((await put(dina.token, { kind: 'invoice', id: 'inv-00000001', studentId: sam.id, data: invoice })).status).toBe(200);
    expect((await list(sam.token, 'invoice')).json.records.map((i: { number: string }) => i.number)).toEqual(['LWD-2026-0001']);
    expect((await list(anneka.token, 'invoice')).json.records).toEqual([]);
    // Teacher settings: her own row only.
    expect((await put(dina.token, { kind: 'config', id: `config-${dina.id}`, studentId: dina.id, data: { hourlyRate: 40, currency: 'GBP' } })).status).toBe(200);
    expect((await put(dina.token, { kind: 'config', id: `config-${sam.id}`, studentId: sam.id, data: { hourlyRate: 1 } })).status).toBe(400);
    expect((await put(sam.token, { kind: 'config', id: `config-${sam.id}`, studentId: sam.id, data: { hourlyRate: 1 } })).status).toBe(403);
    expect((await list(dina.token, 'config')).json.records[0].hourlyRate).toBe(40);
    expect((await list(sam.token, 'config')).json.records).toEqual([]);
    // Package credits: teacher writes, student reads own only.
    const credit = { name: '5 lessons', lessons: 5, minutesPerLesson: 60, price: 180, currency: 'GBP', purchasedAt: '2026-11-10', createdAt: at(0) };
    expect((await put(sam.token, { kind: 'credit', id: 'cr-00000001', studentId: sam.id, data: credit })).status).toBe(403);
    expect((await put(dina.token, { kind: 'credit', id: 'cr-00000001', studentId: sam.id, data: credit })).status).toBe(200);
    expect((await list(sam.token, 'credit')).json.records).toHaveLength(1);
    expect((await list(anneka.token, 'credit')).json.records).toEqual([]);
    // Deleting a draft invoice works for the teacher only.
    expect((await call('platform/records/delete', { token: sam.token, body: { id: 'inv-00000001' } })).status).toBe(403);
    expect((await call('platform/records/delete', { token: dina.token, body: { id: 'inv-00000001' } })).status).toBe(204);
    expect((await list(dina.token, 'invoice')).json.records).toEqual([]);
  });

  it('activity and progress: students log their own, the teacher reads everything', async () => {
    const dina = await register('dina', 'Dina');
    const sam = await register('sam', 'Sam');
    const anneka = await register('anneka', 'Anneka');
    expect((await put(sam.token, { kind: 'activity', id: 'ev-00000001', studentId: sam.id, data: { type: 'chapter', label: 'La llegada', at: at(1) } })).status).toBe(200);
    expect((await put(sam.token, { kind: 'activity', id: 'ev-00000002', studentId: anneka.id, data: { type: 'chapter', label: 'nope', at: at(1) } })).status).toBe(403);
    expect((await put(dina.token, { kind: 'activity', id: 'ev-00000003', studentId: anneka.id, data: { type: 'lesson', label: 'Lesson booked', at: at(2) } })).status).toBe(200);
    expect((await list(dina.token, 'activity')).json.records).toHaveLength(2);
    expect((await list(anneka.token, 'activity')).json.records.map((e: { id: string }) => e.id)).toEqual(['ev-00000003']);
    expect((await put(sam.token, { kind: 'activity', id: 'short', studentId: sam.id, data: {} })).status).toBe(400);
    // Progress
    expect((await call('progress', { method: 'PUT', token: sam.token, body: { data: { version: 1, days: { '2026-11-06': { activeSeconds: 600 } } }, baseVersion: 0, deviceId: 'd1' } })).status).toBe(200);
    const byTeacher = await call(`platform/progress/${sam.id}`, { token: dina.token });
    expect(byTeacher.status).toBe(200);
    expect(byTeacher.json.data.days['2026-11-06'].activeSeconds).toBe(600);
    expect((await call(`platform/progress/${sam.id}`, { token: anneka.token })).status).toBe(403);
    expect((await call(`platform/progress/${anneka.id}`, { token: anneka.token })).json.data).toBeNull();
    expect((await call(`platform/progress/${dina.id}`, { token: dina.token })).status).toBe(200);
    // Deleting a student removes their platform rows too.
    expect((await call('delete-account', { token: sam.token, body: { password: PW } })).status).toBe(204);
    expect((await list(dina.token, 'activity')).json.records.map((e: { id: string }) => e.id)).toEqual(['ev-00000003']);
  });
});
