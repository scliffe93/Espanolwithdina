import { beforeEach, describe, expect, it } from 'vitest';
import * as hashwasm from 'hash-wasm';
import { LIMITS, argon2Hasher, createHandler, newRecoveryCode, normaliseRecoveryCode, validatePassword } from '../supabase/functions/_shared/account-core';
import { createPgliteDb } from '../server/pglite-db';
import type { PGlite } from '@electric-sql/pglite';

const ORIGIN = 'https://scliffe93.github.io';
let handle: (r: Request) => Promise<Response>;
let pg: PGlite;
let clock = Date.UTC(2026, 10, 6, 10);

beforeEach(async () => {
  const made = await createPgliteDb();
  pg = made.pg;
  clock = Date.UTC(2026, 10, 6, 10);
  handle = createHandler(made.db, argon2Hasher(hashwasm), { allowedOrigins: [ORIGIN], now: () => clock });
});

async function call(path: string, opts: { method?: string; body?: unknown; token?: string; origin?: string | null; ip?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': opts.ip ?? '203.0.113.7' };
  if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await handle(new Request(`https://example.supabase.co/functions/v1/account/${path}`, { method: opts.method ?? (opts.body ? 'POST' : 'GET'), headers, body: opts.body ? JSON.stringify(opts.body) : undefined }));
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, headers: res.headers };
}

const register = (username = 'Sam.Learner', password = 'mi casa es tu casa', firstName = 'Sam') => call('register', { body: { username, password, firstName, remember: true } });

describe('account API — registration & passwords', () => {
  it('creates an account, returns a session and a one-time recovery code', async () => {
    const r = await register();
    expect(r.status).toBe(201);
    expect(r.json.user).toMatchObject({ username: 'Sam.Learner', firstName: 'Sam' });
    expect(r.json.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r.json.recoveryCode).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(r.headers.get('cache-control')).toBe('no-store');
  });

  it('never stores passwords, tokens or recovery codes in plaintext', async () => {
    const r = await register('lucia', 'tortilla de patatas');
    const row = (await pg.query<{ password_hash: string; recovery_hash: string }>('select password_hash, recovery_hash from public.lwd_users')).rows[0];
    expect(row.password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(row.password_hash).not.toContain('tortilla');
    expect(row.recovery_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.recovery_hash).not.toContain(normaliseRecoveryCode(r.json.recoveryCode));
    const s = (await pg.query<{ token_hash: string }>('select token_hash from public.lwd_sessions')).rows[0];
    expect(s.token_hash).not.toBe(r.json.token);
    expect(s.token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('enforces case-insensitive unique usernames', async () => {
    expect((await register('Marta_88')).status).toBe(201);
    const dup = await register('marta_88', 'otra contraseña larga', 'Marta');
    expect(dup.status).toBe(409);
    expect(dup.json.error).toBe('username_taken');
  });

  it('rejects weak or invalid input', async () => {
    expect((await register('ab', 'good long password')).status).toBe(400);
    expect((await register('has space', 'good long password')).status).toBe(400);
    expect((await register('valid_name', 'short')).status).toBe(400);
    expect((await register('valid_name', 'password123')).status).toBe(400);
    expect((await register('valid_name', 'my valid_name rocks')).status).toBe(400);
    expect((await register('valid_name', 'good long password', '')).status).toBe(400);
    expect(validatePassword('una frase muy segura')).toBeNull();
  });
});

describe('account API — login, sessions, brute force', () => {
  it('logs in with the right password (case-insensitive username) and gives the same generic error otherwise', async () => {
    await register();
    const ok = await call('login', { body: { username: 'sam.learner', password: 'mi casa es tu casa' } });
    expect(ok.status).toBe(200);
    const wrongPw = await call('login', { body: { username: 'sam.learner', password: 'wrong password!' } });
    const noUser = await call('login', { body: { username: 'nobody_here', password: 'wrong password!' } });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.json.message).toBe(noUser.json.message);
  });

  it('locks an account after repeated failures, then allows login after the window', async () => {
    await register();
    for (let i = 0; i < LIMITS.userFailures; i++) expect((await call('login', { body: { username: 'Sam.Learner', password: `nope-${i}-wrong` } })).status).toBe(401);
    const locked = await call('login', { body: { username: 'Sam.Learner', password: 'mi casa es tu casa' } });
    expect(locked.status).toBe(429);
    clock += LIMITS.window + 1000;
    expect((await call('login', { body: { username: 'Sam.Learner', password: 'mi casa es tu casa' } })).status).toBe(200);
  });

  it('throttles a single IP trying many usernames', async () => {
    for (let i = 0; i < LIMITS.ipFailures; i++) await call('login', { body: { username: `user${i}`, password: 'whatever-guess' }, ip: '198.51.100.9' });
    expect((await call('login', { body: { username: 'another', password: 'whatever-guess' }, ip: '198.51.100.9' })).status).toBe(429);
    expect((await call('login', { body: { username: 'another', password: 'whatever-guess' }, ip: '198.51.100.10' })).status).toBe(401);
  });

  it('expires short sessions, keeps "remember me" sessions, and logout revokes the token', async () => {
    await register();
    const short = (await call('login', { body: { username: 'Sam.Learner', password: 'mi casa es tu casa', remember: false } })).json.token;
    const long = (await call('login', { body: { username: 'Sam.Learner', password: 'mi casa es tu casa', remember: true } })).json.token;
    clock += 25 * 3_600_000;
    expect((await call('me', { token: short })).status).toBe(401);
    expect((await call('me', { token: long })).status).toBe(200);
    expect((await call('logout', { method: 'POST', token: long })).status).toBe(204);
    expect((await call('me', { token: long })).status).toBe(401);
  });

  it('rejects missing, malformed and forged tokens', async () => {
    await register();
    expect((await call('me')).status).toBe(401);
    expect((await call('me', { token: 'not-a-real-token-but-long-enough-xx' })).status).toBe(401);
  });

  it('change password requires the current one and signs out other devices', async () => {
    const reg = await register();
    const phone = reg.json.token;
    const laptop = (await call('login', { body: { username: 'Sam.Learner', password: 'mi casa es tu casa' } })).json.token;
    expect((await call('change-password', { token: laptop, body: { currentPassword: 'wrong one!!', newPassword: 'nueva frase segura' } })).status).toBe(401);
    expect((await call('change-password', { token: laptop, body: { currentPassword: 'mi casa es tu casa', newPassword: 'nueva frase segura' } })).status).toBe(200);
    expect((await call('me', { token: laptop })).status).toBe(200);
    expect((await call('me', { token: phone })).status).toBe(401);
    expect((await call('login', { body: { username: 'Sam.Learner', password: 'mi casa es tu casa' } })).status).toBe(401);
    expect((await call('login', { body: { username: 'Sam.Learner', password: 'nueva frase segura' } })).status).toBe(200);
  });
});

describe('account API — recovery codes', () => {
  it('resets the password with a valid code, is single-use, and signs out every device', async () => {
    const reg = await register();
    const code = reg.json.recoveryCode as string;
    const bad = await call('recover', { body: { username: 'Sam.Learner', recoveryCode: newRecoveryCode(), newPassword: 'olvidé mi clave' } });
    expect(bad.status).toBe(401);
    const ok = await call('recover', { body: { username: 'sam.learner', recoveryCode: code.toLowerCase().replace(/-/g, ' '), newPassword: 'olvidé mi clave' } });
    expect(ok.status).toBe(200);
    expect(ok.json.recoveryCode).not.toBe(code);
    expect((await call('me', { token: reg.json.token })).status).toBe(401);
    expect((await call('recover', { body: { username: 'Sam.Learner', recoveryCode: code, newPassword: 'otra vez nueva' } })).status).toBe(401);
    expect((await call('login', { body: { username: 'Sam.Learner', password: 'olvidé mi clave' } })).status).toBe(200);
  });

  it('throttles recovery-code guessing', async () => {
    await register();
    for (let i = 0; i < LIMITS.userFailures; i++) await call('recover', { body: { username: 'Sam.Learner', recoveryCode: newRecoveryCode(), newPassword: 'guessing pass' } });
    expect((await call('recover', { body: { username: 'Sam.Learner', recoveryCode: newRecoveryCode(), newPassword: 'guessing pass' } })).status).toBe(429);
  });
});

describe('account API — progress, conflicts and isolation', () => {
  it('saves and restores progress with optimistic versioning', async () => {
    const { token } = (await register()).json;
    expect((await call('progress', { token })).json).toEqual({ data: null, version: 0, updatedAt: null });
    const first = await call('progress', { method: 'PUT', token, body: { data: { lessons: 1 }, baseVersion: 0, deviceId: 'phone' } });
    expect(first.json.version).toBe(1);
    const second = await call('progress', { method: 'PUT', token, body: { data: { lessons: 2 }, baseVersion: 1, deviceId: 'phone' } });
    expect(second.json.version).toBe(2);
    expect((await call('progress', { token })).json).toMatchObject({ data: { lessons: 2 }, version: 2 });
  });

  it('refuses a stale write (409) and returns the newer server copy instead of overwriting', async () => {
    const { token } = (await register()).json;
    await call('progress', { method: 'PUT', token, body: { data: { from: 'phone' }, baseVersion: 0 } });
    await call('progress', { method: 'PUT', token, body: { data: { from: 'laptop' }, baseVersion: 1 } });
    const stale = await call('progress', { method: 'PUT', token, body: { data: { from: 'phone-offline' }, baseVersion: 1 } });
    expect(stale.status).toBe(409);
    expect(stale.json).toMatchObject({ error: 'conflict', version: 2, data: { from: 'laptop' } });
    const doubleCreate = await call('progress', { method: 'PUT', token, body: { data: { x: 1 }, baseVersion: 0 } });
    expect(doubleCreate.status).toBe(409);
  });

  it('keeps every learner’s records private', async () => {
    const a = (await register('learner_a', 'clave segura uno', 'Ana')).json.token;
    const b = (await register('learner_b', 'clave segura dos', 'Beto')).json.token;
    await call('progress', { method: 'PUT', token: a, body: { data: { secret: 'Ana-only' }, baseVersion: 0 } });
    const bRead = await call('progress', { token: b });
    expect(bRead.json.data).toBeNull();
    await call('progress', { method: 'PUT', token: b, body: { data: { secret: 'Beto-only' }, baseVersion: 0 } });
    expect((await call('progress', { token: a })).json.data).toEqual({ secret: 'Ana-only' });
  });

  it('has row-level security enabled on every table', async () => {
    const rows = (await pg.query<{ relname: string; relrowsecurity: boolean }>("select relname, relrowsecurity from pg_class where relname in ('lwd_users','lwd_sessions','lwd_progress','lwd_attempts')")).rows;
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r.relrowsecurity, r.relname).toBe(true);
  });

  it('deletes the account and all its data (with password confirmation)', async () => {
    const { token } = (await register()).json;
    await call('progress', { method: 'PUT', token, body: { data: { a: 1 }, baseVersion: 0 } });
    expect((await call('delete-account', { token, body: { password: 'wrong guess here' } })).status).toBe(401);
    expect((await call('delete-account', { token, body: { password: 'mi casa es tu casa' } })).status).toBe(204);
    for (const t of ['lwd_users', 'lwd_sessions', 'lwd_progress']) expect((await pg.query(`select 1 from public.${t}`)).rows).toHaveLength(0);
  });
});

describe('account API — transport rules', () => {
  it('rejects unknown origins and oversized bodies; answers CORS preflight', async () => {
    expect((await call('health', { origin: 'https://evil.example' })).status).toBe(403);
    expect((await call('health', { origin: null })).status).toBe(200);
    const pre = await handle(new Request('https://x/functions/v1/account/login', { method: 'OPTIONS', headers: { origin: ORIGIN } }));
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-headers')).toContain('authorization');
    const { token } = (await register()).json;
    const big = await call('progress', { method: 'PUT', token, body: { data: { blob: 'x'.repeat(2_100_000) }, baseVersion: 0 } });
    expect(big.status).toBe(413);
  });
});
