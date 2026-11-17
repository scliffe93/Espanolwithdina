import { beforeEach, describe, expect, it } from 'vitest';
import * as hashwasm from 'hash-wasm';
import { argon2Hasher, createHandler } from '../supabase/functions/_shared/account-core';
import { checkBlock, isPresent, studentView, type LessonBlock, type LessonPlan } from '../supabase/functions/_shared/lesson';
import { createPgliteDb } from '../server/pglite-db';

// The lesson room on real Postgres (PGlite): the teacher plans and opens blocks, the student sees only what is open,
// answers arrive without either side overwriting the other, and nobody else can look in.

const ORIGIN = 'https://scliffe93.github.io';
let handle: (r: Request) => Promise<Response>;
let clock = 0;
beforeEach(async () => {
  const made = await createPgliteDb();
  clock = Date.UTC(2026, 10, 16, 18, 0);
  handle = createHandler(made.db, argon2Hasher(hashwasm), { allowedOrigins: [ORIGIN], now: () => clock, teacherUsernames: ['Dina'] });
});
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
const blocks = (over: Partial<Record<string, Partial<LessonBlock>>> = {}): LessonBlock[] => [
  { id: 'warm', type: 'question', title: 'Warm-up', body: '¿Qué hiciste el fin de semana?', ...over.warm },
  { id: 'gap1', type: 'gap', title: 'Preterite', body: 'Ayer yo ___ (ir) al mercado.', answer: 'fui', ...over.gap1 },
  { id: 'pick', type: 'choice', title: 'Ser or estar', body: 'Madrid ___ en España.', options: ['es', 'está'], answer: 'está', ...over.pick },
  { id: 'words', type: 'vocab', title: 'Words', body: '', pairs: [{ es: 'el mercado', en: 'the market' }], ...over.words },
];
const sync = (token: string, id: string, extra: Record<string, unknown> = {}) => call('platform/lessons/sync', { token, body: { id, ...extra } });

describe('the lesson room', () => {
  it('shows the student only what the teacher has opened, and never her notes or the answers', async () => {
    const dina = await register('dina', 'Dina'); const sam = await register('sam', 'Sam');
    const save = (data: Record<string, unknown>) => call('platform/records', { method: 'PUT', token: dina.token, body: { kind: 'lesson', id: 'lesson-abc12345', studentId: sam.id, data } });
    expect((await save({ title: 'El pretérito', notes: 'Sam mixes up fui and fue.', blocks: blocks(), live: { on: false, current: null } })).status).toBe(200);
    // Nothing is open yet: the student gets the lesson with no blocks.
    let s = await sync(sam.token, 'lesson-abc12345');
    expect(s.status).toBe(200);
    expect(s.json.plan.blocks).toEqual([]);
    expect(s.json.plan.notes).toBeUndefined();
    // The teacher opens two blocks and goes live on the first.
    expect((await save({ title: 'El pretérito', notes: 'Sam mixes up fui and fue.', blocks: blocks({ warm: { open: true }, gap1: { open: true } }), live: { on: true, current: 'gap1' } })).status).toBe(200);
    s = await sync(sam.token, 'lesson-abc12345');
    expect(s.json.plan.blocks.map((b: LessonBlock) => b.id)).toEqual(['warm', 'gap1']);
    expect(s.json.plan.live).toMatchObject({ on: true, current: 'gap1' });
    expect(s.json.plan.blocks[1].answer).toBeUndefined(); // not until he has answered
    // The same filter applies when he lists his lessons.
    const list = await call('platform/records?kind=lesson', { token: sam.token });
    expect(list.json.records[0].blocks.map((b: LessonBlock) => b.id)).toEqual(['warm', 'gap1']);
    expect(JSON.stringify(list.json.records)).not.toContain('mixes up');
  });

  it('records answers, checks the ones it can, and lets the teacher see them and who is there', async () => {
    const dina = await register('dina', 'Dina'); const sam = await register('sam', 'Sam');
    await call('platform/records', { method: 'PUT', token: dina.token, body: { kind: 'lesson', id: 'lesson-abc12345', studentId: sam.id, data: { title: 'L', blocks: blocks({ warm: { open: true }, gap1: { open: true }, pick: { open: true } }), live: { on: true, current: 'warm' } } } });
    // Before the student arrives, the teacher sees nobody.
    let t = await sync(dina.token, 'lesson-abc12345');
    expect(isPresent(t.json.work, clock)).toBe(false);
    expect((await sync(sam.token, 'lesson-abc12345', { blockId: 'warm', value: 'Fui a la playa con mis amigos.' })).json.work.answers.warm).toMatchObject({ value: 'Fui a la playa con mis amigos.' });
    const wrong = await sync(sam.token, 'lesson-abc12345', { blockId: 'gap1', value: 'fue' });
    expect(wrong.json.work.answers.gap1).toMatchObject({ value: 'fue', correct: false });
    expect(wrong.json.plan.blocks.find((b: LessonBlock) => b.id === 'gap1').answer).toBe('fui'); // shown once he has tried
    expect((await sync(sam.token, 'lesson-abc12345', { blockId: 'gap1', value: ' Fui. ' })).json.work.answers.gap1.correct).toBe(true);
    expect((await sync(sam.token, 'lesson-abc12345', { blockId: 'pick', value: 'está' })).json.work.answers.pick.correct).toBe(true);
    t = await sync(dina.token, 'lesson-abc12345');
    expect(Object.keys(t.json.work.answers).sort()).toEqual(['gap1', 'pick', 'warm']);
    expect(isPresent(t.json.work, clock)).toBe(true);
    clock += 60_000; // a minute with no word from his device
    expect(isPresent((await sync(dina.token, 'lesson-abc12345')).json.work, clock)).toBe(false);
    // The teacher editing the plan does not lose his answers.
    await call('platform/records', { method: 'PUT', token: dina.token, body: { kind: 'lesson', id: 'lesson-abc12345', studentId: sam.id, data: { title: 'L (edited)', blocks: blocks({ warm: { open: true } }), live: { on: true, current: 'warm' } } } });
    expect(Object.keys((await sync(dina.token, 'lesson-abc12345')).json.work.answers)).toHaveLength(3);
  });

  it('never loses an answer to a check-in that crosses with it', async () => {
    const dina = await register('dina', 'Dina'); const sam = await register('sam', 'Sam');
    await call('platform/records', { method: 'PUT', token: dina.token, body: { kind: 'lesson', id: 'lesson-abc12345', studentId: sam.id, data: { title: 'L', blocks: blocks({ warm: { open: true }, gap1: { open: true }, pick: { open: true } }), live: { on: true, current: 'warm' } } } });
    // Three answers and five check-ins sent at the same moment, in a jumble.
    await Promise.all([
      sync(sam.token, 'lesson-abc12345'), sync(sam.token, 'lesson-abc12345', { blockId: 'warm', value: 'Fui al cine.' }), sync(sam.token, 'lesson-abc12345'),
      sync(sam.token, 'lesson-abc12345', { blockId: 'gap1', value: 'fui' }), sync(sam.token, 'lesson-abc12345'), sync(sam.token, 'lesson-abc12345', { blockId: 'pick', value: 'está' }),
      sync(sam.token, 'lesson-abc12345'), sync(sam.token, 'lesson-abc12345'),
    ]);
    const t = await sync(dina.token, 'lesson-abc12345');
    expect(Object.keys(t.json.work.answers).sort()).toEqual(['gap1', 'pick', 'warm']);
    expect(t.json.work.answers.gap1).toMatchObject({ value: 'fui', correct: true });
    expect(isPresent(t.json.work, clock)).toBe(true);
  });

  it('keeps everyone else out, and the student out of what is closed', async () => {
    const dina = await register('dina', 'Dina'); const sam = await register('sam', 'Sam'); const eve = await register('eve', 'Eve');
    await call('platform/records', { method: 'PUT', token: dina.token, body: { kind: 'lesson', id: 'lesson-abc12345', studentId: sam.id, data: { title: 'L', blocks: blocks({ warm: { open: true } }), live: { on: true, current: 'warm' } } } });
    expect((await sync(eve.token, 'lesson-abc12345')).status).toBe(404); // another student
    expect((await call('platform/records?kind=lesson', { token: eve.token })).json.records).toEqual([]);
    expect((await sync(sam.token, 'lesson-abc12345', { blockId: 'gap1', value: 'fui' })).status).toBe(403); // not opened
    // A student cannot write a plan, nor forge answers directly.
    expect((await call('platform/records', { method: 'PUT', token: sam.token, body: { kind: 'lesson', id: 'lesson-zzz12345', studentId: sam.id, data: { title: 'x', blocks: [] } } })).status).toBe(403);
    expect((await call('platform/records', { method: 'PUT', token: sam.token, body: { kind: 'lessonwork', id: 'lesson-abc12345-work', studentId: sam.id, data: { answers: {} } } })).status).toBe(403);
    expect((await call('platform/records', { method: 'PUT', token: dina.token, body: { kind: 'lessonwork', id: 'lesson-abc12345-work', studentId: sam.id, data: { answers: {} } } })).status).toBe(403);
    // Deleting the lesson removes the work with it.
    await sync(sam.token, 'lesson-abc12345', { blockId: 'warm', value: 'hola' });
    expect((await call('platform/records/delete', { token: dina.token, body: { id: 'lesson-abc12345' } })).status).toBe(204);
    expect((await call('platform/records?kind=lessonwork', { token: dina.token })).json.records).toEqual([]);
  });

  it('checks answers sensibly and hides what it should', () => {
    const gap: LessonBlock = { id: 'g', type: 'gap', title: '', body: '___', answer: 'habló|ha hablado' };
    expect(checkBlock(gap, 'Habló')).toBe(true);
    expect(checkBlock(gap, 'hablo')).toBe(true); // accents are forgiven in a live lesson
    expect(checkBlock(gap, 'ha hablado.')).toBe(true);
    expect(checkBlock(gap, 'hablaba')).toBe(false);
    expect(checkBlock({ id: 'q', type: 'question', title: '', body: '' }, 'anything')).toBeUndefined();
    const plan: LessonPlan = { id: 'l', teacherId: 't', studentId: 's', title: 'T', notes: 'private', blocks: [{ ...gap, open: true, reveal: true }, { id: 'h', type: 'text', title: 'Hidden', body: 'later' }], live: { on: true, current: 'h' }, createdAt: '', updatedAt: '' };
    const v = studentView(plan, null);
    expect(v.blocks).toHaveLength(1);
    expect(v.blocks[0].answer).toBe('habló|ha hablado'); // the teacher chose to show it
    expect(v.live.current).toBeNull(); // she is on a block he cannot see
    expect((v as { notes?: string }).notes).toBeUndefined();
  });
});

describe('the plan library', () => {
  it('is kept in the teacher’s own rows: saved, listed, emptied, never seen by a student and never mixed with her settings', async () => {
    const dina = await register('dina', 'Dina'); const sam = await register('sam', 'Sam');
    const plan = { id: 'lib-0123456789abcdef', library: true, title: 'A1 Greetings', level: 'A1', status: 'review', wording: 'en', minutes: 60, notes: 'Stage 1…', blocks: blocks(), createdAt: 'x', updatedAt: 'x' };
    const put = await call('platform/records', { method: 'PUT', token: dina.token, body: { kind: 'config', id: plan.id, studentId: dina.id, data: plan } });
    expect(put.status).toBe(200);
    await call('platform/records', { method: 'PUT', token: dina.token, body: { kind: 'config', id: `config-${dina.id}`, studentId: dina.id, data: { businessName: 'Dina', currency: 'EUR' } } });
    const list = await call('platform/records?kind=config', { token: dina.token });
    const mine = list.json.records.filter((r: { library?: boolean }) => r.library === true);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ title: 'A1 Greetings', level: 'A1', status: 'review', minutes: 60 });
    expect(mine[0].blocks).toHaveLength(4);
    expect(list.json.records.find((r: { id: string }) => r.id === `config-${dina.id}`).businessName).toBe('Dina');
    // Marked ready, then emptied (settings rows are not deleted, so a removed plan is hidden).
    await call('platform/records', { method: 'PUT', token: dina.token, body: { kind: 'config', id: plan.id, studentId: dina.id, data: { ...plan, status: 'ready' } } });
    expect((await call('platform/records?kind=config', { token: dina.token })).json.records.find((r: { id: string }) => r.id === plan.id).status).toBe('ready');
    await call('platform/records', { method: 'PUT', token: dina.token, body: { kind: 'config', id: plan.id, studentId: dina.id, data: { id: plan.id, library: true, deleted: true, blocks: [] } } });
    expect((await call('platform/records?kind=config', { token: dina.token })).json.records.find((r: { id: string }) => r.id === plan.id).deleted).toBe(true);
    // A student can neither read nor write it.
    expect((await call('platform/records?kind=config', { token: sam.token })).json.records).toEqual([]);
    expect((await call('platform/records', { method: 'PUT', token: sam.token, body: { kind: 'config', id: 'lib-aaaaaaaaaaaaaaaa', studentId: sam.id, data: plan } })).status).toBe(403);
  });
});

describe('the lesson room on the production database driver', () => {
  // postgres.js encodes a value bound to a jsonb parameter itself. The server passes JSON text, so a parameter written
  // "$n::jsonb" is stored as a JSON string, not an object. This adapter does the same, to keep that case tested.
  it('lets a student join and answer when records are stored the way production stores them', async () => {
    const made = await createPgliteDb();
    const likeProduction = { query: (q: string, params: unknown[] = []) => {
      const direct = new Set([...q.matchAll(/(?<!\()\$(\d+)::jsonb/g)].map((m) => Number(m[1])));
      return made.db.query(q, params.map((v, i) => (direct.has(i + 1) && typeof v === 'string' ? JSON.stringify(v) : v)));
    } };
    handle = createHandler(likeProduction as never, argon2Hasher(hashwasm), { allowedOrigins: [ORIGIN], now: () => clock, teacherUsernames: ['Dina'] });
    const dina = await register('dina', 'Dina'); const sam = await register('sam', 'Sam');
    const id = 'lesson-0123456789abcdef';
    const put = await call('platform/records', { method: 'PUT', token: dina.token, body: { kind: 'lesson', id, studentId: sam.id, data: { title: 'Ir y ser', blocks: blocks({ gap1: { open: true }, warm: { open: true } }), live: { on: true, current: 'gap1' } } } });
    expect(put.status).toBe(200);
    // The stored plan really is a JSON string here, as in production.
    expect((await made.db.query<{ t: string }>("select jsonb_typeof(data) as t from public.lwd_platform where id = $1", [id]))[0].t).toBe('string');
    const joined = await sync(sam.token, id);
    expect(joined.status).toBe(200);
    expect(joined.json.plan.blocks.map((b: LessonBlock) => b.id)).toEqual(['warm', 'gap1']);
    const again = await sync(sam.token, id);
    expect(again.status).toBe(200);
    const right = await sync(sam.token, id, { blockId: 'gap1', value: 'fui' });
    expect(right.status).toBe(200);
    expect(right.json.work.answers.gap1).toMatchObject({ value: 'fui', correct: true });
    const open = await sync(sam.token, id, { blockId: 'warm', value: 'Fui al cine.' });
    expect(open.json.work.answers).toMatchObject({ gap1: { value: 'fui', correct: true }, warm: { value: 'Fui al cine.' } });
    // The teacher sees both answers, and the student's own list of lessons still loads.
    const seen = await sync(dina.token, id);
    expect(Object.keys(seen.json.work.answers).sort()).toEqual(['gap1', 'warm']);
    expect((await call('platform/records?kind=lesson', { token: sam.token })).status).toBe(200);
    // An answer row left behind in the old form (a JSON string) is repaired, not failed on.
    await made.db.query("update public.lwd_platform set data = to_jsonb(data::text) where kind = 'lessonwork'");
    const repaired = await sync(sam.token, id, { blockId: 'gap1', value: 'fue' });
    expect(repaired.status).toBe(200);
    expect(repaired.json.work.answers).toMatchObject({ gap1: { value: 'fue', correct: false }, warm: { value: 'Fui al cine.' } });
  });
});
