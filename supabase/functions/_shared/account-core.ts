// ───────────────────────────────────────────────────────────────
// Learning with Dina — account & progress API (framework-free).
//
// Runs unchanged in Supabase Edge Functions (Deno) and in Node (local
// dev server + tests). Only web-standard APIs are used; the database
// and password hasher are injected by the entry point.
//
// Security model
//  • Passwords: Argon2id (OWASP parameters) via the injected hasher.
//  • Session tokens & recovery codes: 256/80-bit random secrets, stored
//    only as SHA-256 hashes (high-entropy secrets don't need slow hashes).
//  • Brute force: failed attempts are throttled per username and per IP.
//  • Generic login errors + a dummy hash for unknown users (no username
//    enumeration via messages or timing).
//  • Every data query is scoped to the user id resolved from the session.
//  • Optimistic concurrency on progress (version numbers) → no silent
//    overwrites; conflicts are returned to the client to merge.
// ───────────────────────────────────────────────────────────────

import { followUpFor, type AdaptHomework } from './adapt.ts';

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Hasher {
  hash(password: string): Promise<string>;
  verify(password: string, encoded: string): Promise<boolean>;
}

export interface Config {
  /** Allowed browser origins (exact match). '*' allows any (local development only). */
  allowedOrigins: string[];
  now?: () => number;
  maxBodyBytes?: number;
  /** Usernames that are the teacher (case-insensitive). Everyone else is a student. */
  teacherUsernames?: string[];
  /** Usernames that administer the whole platform (above the teacher). */
  adminUsernames?: string[];
}

const MIN = 60_000;
const DAY = 86_400_000;
export const LIMITS = {
  userFailures: 5, // per username per window
  ipFailures: 30, // per IP per window
  window: 15 * MIN,
  registerPerIpPerHour: 10,
  rememberDays: 30,
  sessionHours: 24,
};

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwertyuiop', 'qwerty123', '11111111',
  'iloveyou', 'abc12345', 'letmein1', 'welcome1', 'admin123', 'contraseña', 'contrasena', 'españa123', 'espanol123',
  'learningwithdina', 'dina1234', 'spanish1', 'aprender1', 'holahola', 'hola1234', 'sunshine', 'football', 'baseball',
]);

// ── helpers ─────────────────────────────────────────────────────

const enc = new TextEncoder();

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

function base64url(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 80-bit recovery code, e.g. "7KQ2-M9XD-4RTP-H3VB" (Crockford base32, no ambiguous letters). */
export function newRecoveryCode(): string {
  const bytes = randomBytes(10);
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) { out += CROCKFORD[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  return out.match(/.{4}/g)!.join('-');
}

export function normaliseRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

export function normaliseUsername(u: string): string {
  return u.trim().toLowerCase();
}

export function validateUsername(u: string): string | null {
  const t = u.trim();
  if (!/^[A-Za-z0-9._-]{3,24}$/.test(t)) return 'Usernames are 3–24 characters: letters, numbers, dots, dashes or underscores.';
  return null;
}

export function validatePassword(pw: string, username = ''): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'Use at least 8 characters.';
  if (pw.length > 128) return 'Use at most 128 characters.';
  const lower = pw.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return 'That password is too common — choose something more personal.';
  if (/^(.)\1+$/.test(pw)) return 'Avoid repeating a single character.';
  const u = normaliseUsername(username);
  if (u.length >= 4 && lower.includes(u)) return 'Your password shouldn’t contain your username.';
  return null;
}

function validateFirstName(n: string): string | null {
  const t = (n ?? '').trim();
  // eslint-disable-next-line no-control-regex
  if (!t || t.length > 40 || /[\u0000-\u001f<>]/.test(t)) return 'Please enter your first name (up to 40 characters).';
  return null;
}

const WORDS = ['casa', 'sol', 'playa', 'café', 'libro', 'gato', 'perro', 'lluvia', 'montaña', 'río', 'pan', 'luna', 'mar', 'flor', 'calle', 'verde', 'azul', 'rojo', 'feliz', 'tarde', 'noche', 'amigo', 'ciudad', 'camino', 'fiesta', 'música', 'tren', 'puerta', 'jardín', 'niebla', 'viento', 'nube'];

/** A readable temporary password, e.g. "playa jardín luna 47" (three words from 32 + two digits ≈ 21 bits; the student changes it). */
export function temporaryPassword(): string {
  const r = randomBytes(4);
  return `${WORDS[r[0] % WORDS.length]} ${WORDS[r[1] % WORDS.length]} ${WORDS[r[2] % WORDS.length]} ${10 + (r[3] % 90)}`;
}

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

// ── handler ─────────────────────────────────────────────────────

interface UserRow { id: string; username: string; first_name: string; password_hash: string; recovery_hash: string; role: 'student' | 'teacher' | 'admin' }

export function createHandler(db: Db, hasher: Hasher, config: Config) {
  const now = config.now ?? (() => Date.now());
  const maxBody = config.maxBodyBytes ?? 2_000_000;
  let dummyHash: Promise<string> | null = null;
  const dummy = () => (dummyHash ??= hasher.hash(base64url(randomBytes(16))));

  const iso = (ms: number) => new Date(ms).toISOString();

  async function failures(bucket: string, windowMs: number): Promise<number> {
    const rows = await db.query<{ n: string | number }>('select count(*)::int as n from public.lwd_attempts where bucket = $1 and at > $2', [bucket, iso(now() - windowMs)]);
    return Number(rows[0]?.n ?? 0);
  }
  async function fail(...buckets: string[]) {
    for (const b of buckets) await db.query('insert into public.lwd_attempts (bucket, at) values ($1, $2)', [b, iso(now())]);
    if (Math.random() < 0.05) await db.query('delete from public.lwd_attempts where at < $1', [iso(now() - DAY)]);
  }
  async function clear(bucket: string) {
    await db.query('delete from public.lwd_attempts where bucket = $1', [bucket]);
  }
  async function throttle(userBucket: string | null, ipBucket: string) {
    if (userBucket && (await failures(userBucket, LIMITS.window)) >= LIMITS.userFailures)
      throw new HttpError(429, 'too_many_attempts', 'Too many attempts for this account. Please wait 15 minutes and try again.', { retryAfter: LIMITS.window / 1000 });
    if ((await failures(ipBucket, LIMITS.window)) >= LIMITS.ipFailures)
      throw new HttpError(429, 'too_many_attempts', 'Too many attempts from this network. Please wait 15 minutes and try again.', { retryAfter: LIMITS.window / 1000 });
  }

  async function createSession(userId: string, remember: boolean) {
    const token = base64url(randomBytes(32));
    const expires = now() + (remember ? LIMITS.rememberDays * DAY : LIMITS.sessionHours * 3_600_000);
    await db.query('insert into public.lwd_sessions (token_hash, user_id, remember, created_at, expires_at, last_used_at) values ($1, $2, $3, $4, $5, $4)', [await sha256Hex(token), userId, remember, iso(now()), iso(expires)]);
    return { token, expiresAt: iso(expires) };
  }

  async function auth(req: Request): Promise<{ user: UserRow; tokenHash: string }> {
    const h = req.headers.get('authorization') ?? '';
    const m = h.match(/^Bearer ([A-Za-z0-9_-]{20,100})$/);
    if (!m) throw new HttpError(401, 'unauthorised', 'Please log in.');
    const tokenHash = await sha256Hex(m[1]);
    const rows = await db.query<UserRow>(
      'select u.id, u.username, u.first_name, u.password_hash, u.recovery_hash, u.role from public.lwd_sessions s join public.lwd_users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > $2',
      [tokenHash, iso(now())],
    );
    if (!rows[0]) throw new HttpError(401, 'unauthorised', 'Your session has expired. Please log in again.');
    await db.query('update public.lwd_sessions set last_used_at = $2 where token_hash = $1', [tokenHash, iso(now())]);
    return { user: await promote(rows[0]), tokenHash };
  }

  const publicUser = (u: UserRow) => ({ id: u.id, username: u.username, firstName: u.first_name, role: u.role });

  /** The configured teacher username(s) get the teacher role the first time they are seen. */
  const teachers = new Set((config.teacherUsernames ?? []).map(normaliseUsername).filter(Boolean));
  const admins = new Set((config.adminUsernames ?? []).map(normaliseUsername).filter(Boolean));
  async function promote(u: UserRow): Promise<UserRow> {
    const want: UserRow['role'] | null = admins.has(normaliseUsername(u.username)) ? 'admin' : teachers.has(normaliseUsername(u.username)) && u.role !== 'admin' ? 'teacher' : null;
    if (want && u.role !== want) {
      await db.query('update public.lwd_users set role = $2 where id = $1', [u.id, want]);
      return { ...u, role: want };
    }
    return u;
  }

  async function body(req: Request): Promise<Record<string, unknown>> {
    const text = await req.text();
    if (text.length > maxBody) throw new HttpError(413, 'too_large', 'That request is too large.');
    if (!text) return {};
    try {
      const v = JSON.parse(text);
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
      return v as Record<string, unknown>;
    } catch {
      throw new HttpError(400, 'bad_json', 'Malformed request.');
    }
  }

  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  // ── routes ──
  async function route(req: Request, path: string, ip: string): Promise<{ status: number; json?: unknown }> {
    const method = req.method;

    if (path === 'health' && method === 'GET') return { status: 200, json: { ok: true } };

    if (path === 'register' && method === 'POST') {
      const b = await body(req);
      const username = str(b.username).trim();
      const password = str(b.password);
      const firstName = str(b.firstName).trim();
      const remember = b.remember === true;
      const err = validateUsername(username) ?? validateFirstName(firstName) ?? validatePassword(password, username);
      if (err) throw new HttpError(400, 'invalid', err);
      if ((await failures(`register:ip:${ip}`, 60 * MIN)) >= LIMITS.registerPerIpPerHour) throw new HttpError(429, 'too_many_attempts', 'Too many new accounts from this network. Please try again later.');
      const norm = normaliseUsername(username);
      const existing = await db.query('select 1 from public.lwd_users where username_norm = $1', [norm]);
      if (existing.length) throw new HttpError(409, 'username_taken', 'That username is already taken — try another.');
      const recoveryCode = newRecoveryCode();
      let user: UserRow;
      try {
        const rows = await db.query<UserRow>(
          'insert into public.lwd_users (username, username_norm, first_name, password_hash, recovery_hash, created_at, password_changed_at) values ($1, $2, $3, $4, $5, $6, $6) returning id, username, first_name, password_hash, recovery_hash, role',
          [username, norm, firstName, await hasher.hash(password), await sha256Hex(normaliseRecoveryCode(recoveryCode)), iso(now())],
        );
        user = await promote(rows[0]);
      } catch (e) {
        if (String((e as Error).message).includes('unique') || String((e as { code?: string }).code) === '23505') throw new HttpError(409, 'username_taken', 'That username is already taken — try another.');
        throw e;
      }
      await fail(`register:ip:${ip}`); // counts registrations per IP (not a failure)
      const session = await createSession(user.id, remember);
      return { status: 201, json: { ...session, user: publicUser(user), recoveryCode } };
    }

    if (path === 'login' && method === 'POST') {
      const b = await body(req);
      const norm = normaliseUsername(str(b.username));
      const password = str(b.password);
      const remember = b.remember === true;
      await throttle(`login:user:${norm}`, `login:ip:${ip}`);
      const rows = norm ? await db.query<UserRow>('select id, username, first_name, password_hash, recovery_hash, role from public.lwd_users where username_norm = $1', [norm]) : [];
      const user = rows[0] && (await promote(rows[0]));
      const ok = user ? await hasher.verify(password, user.password_hash) : (await hasher.verify(password, await dummy()), false);
      if (!ok) {
        await fail(`login:user:${norm}`, `login:ip:${ip}`);
        throw new HttpError(401, 'bad_credentials', 'Incorrect username or password.');
      }
      await clear(`login:user:${norm}`);
      const session = await createSession(user.id, remember);
      return { status: 200, json: { ...session, user: publicUser(user) } };
    }

    if (path === 'recover' && method === 'POST') {
      const b = await body(req);
      const norm = normaliseUsername(str(b.username));
      const code = normaliseRecoveryCode(str(b.recoveryCode));
      const newPassword = str(b.newPassword);
      await throttle(`recover:user:${norm}`, `recover:ip:${ip}`);
      const rows = norm ? await db.query<UserRow>('select id, username, first_name, password_hash, recovery_hash, role from public.lwd_users where username_norm = $1', [norm]) : [];
      const user = rows[0] && (await promote(rows[0]));
      const codeHash = await sha256Hex(code);
      if (!user || code.length !== 16 || codeHash !== user.recovery_hash) {
        await fail(`recover:user:${norm}`, `recover:ip:${ip}`);
        throw new HttpError(401, 'bad_recovery', 'That username and recovery code don’t match.');
      }
      const pwErr = validatePassword(newPassword, user.username);
      if (pwErr) throw new HttpError(400, 'invalid', pwErr);
      const nextCode = newRecoveryCode(); // recovery codes are single-use
      await db.query('update public.lwd_users set password_hash = $2, recovery_hash = $3, password_changed_at = $4 where id = $1', [user.id, await hasher.hash(newPassword), await sha256Hex(normaliseRecoveryCode(nextCode)), iso(now())]);
      await db.query('delete from public.lwd_sessions where user_id = $1', [user.id]); // sign out everywhere
      await clear(`recover:user:${norm}`);
      await clear(`login:user:${norm}`);
      const session = await createSession(user.id, b.remember === true);
      return { status: 200, json: { ...session, user: publicUser(user), recoveryCode: nextCode } };
    }

    // ── authenticated routes ──
    const { user, tokenHash } = await auth(req);

    if (path === 'me' && method === 'GET') return { status: 200, json: { user: publicUser(user) } };

    if (path === 'logout' && method === 'POST') {
      await db.query('delete from public.lwd_sessions where token_hash = $1', [tokenHash]);
      return { status: 204 };
    }

    if (path === 'change-password' && method === 'POST') {
      const b = await body(req);
      await throttle(`login:user:${normaliseUsername(user.username)}`, `login:ip:${ip}`);
      if (!(await hasher.verify(str(b.currentPassword), user.password_hash))) {
        await fail(`login:user:${normaliseUsername(user.username)}`, `login:ip:${ip}`);
        throw new HttpError(401, 'bad_credentials', 'Your current password is incorrect.');
      }
      const err = validatePassword(str(b.newPassword), user.username);
      if (err) throw new HttpError(400, 'invalid', err);
      await db.query('update public.lwd_users set password_hash = $2, password_changed_at = $3 where id = $1', [user.id, await hasher.hash(str(b.newPassword)), iso(now())]);
      await db.query('delete from public.lwd_sessions where user_id = $1 and token_hash <> $2', [user.id, tokenHash]); // other devices must log in again
      return { status: 200, json: { ok: true } };
    }

    if (path === 'recovery-code' && method === 'POST') {
      const b = await body(req);
      if (!(await hasher.verify(str(b.password), user.password_hash))) {
        await fail(`login:user:${normaliseUsername(user.username)}`, `login:ip:${ip}`);
        throw new HttpError(401, 'bad_credentials', 'Your password is incorrect.');
      }
      const code = newRecoveryCode();
      await db.query('update public.lwd_users set recovery_hash = $2 where id = $1', [user.id, await sha256Hex(normaliseRecoveryCode(code))]);
      return { status: 200, json: { recoveryCode: code } };
    }

    if (path === 'progress' && method === 'GET') {
      const rows = await db.query<{ data: unknown; version: number; updated_at: string | Date }>('select data, version, updated_at from public.lwd_progress where user_id = $1', [user.id]);
      const r = rows[0];
      return { status: 200, json: r ? { data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data, version: r.version, updatedAt: new Date(r.updated_at).toISOString() } : { data: null, version: 0, updatedAt: null } };
    }

    if (path === 'progress' && method === 'PUT') {
      const b = await body(req);
      const baseVersion = Number(b.baseVersion);
      if (!Number.isInteger(baseVersion) || baseVersion < 0) throw new HttpError(400, 'invalid', 'Missing baseVersion.');
      if (!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) throw new HttpError(400, 'invalid', 'Missing progress data.');
      const device = str(b.deviceId).slice(0, 64);
      const data = JSON.stringify(b.data);
      let rows: { version: number; updated_at: string | Date }[];
      if (baseVersion === 0) {
        rows = await db.query('insert into public.lwd_progress (user_id, data, version, updated_at, updated_by) values ($1, $2::jsonb, 1, $3, $4) on conflict (user_id) do nothing returning version, updated_at', [user.id, data, iso(now()), device]);
      } else {
        rows = await db.query('update public.lwd_progress set data = $2::jsonb, version = version + 1, updated_at = $3, updated_by = $4 where user_id = $1 and version = $5 returning version, updated_at', [user.id, data, iso(now()), device, baseVersion]);
      }
      if (!rows[0]) {
        const cur = await db.query<{ data: unknown; version: number; updated_at: string | Date }>('select data, version, updated_at from public.lwd_progress where user_id = $1', [user.id]);
        const c = cur[0];
        throw new HttpError(409, 'conflict', 'Your progress changed on another device.', c ? { data: typeof c.data === 'string' ? JSON.parse(c.data) : c.data, version: c.version, updatedAt: new Date(c.updated_at).toISOString() } : { data: null, version: 0 });
      }
      return { status: 200, json: { version: rows[0].version, updatedAt: new Date(rows[0].updated_at).toISOString() } };
    }

    if (path === 'delete-account' && method === 'POST') {
      const b = await body(req);
      if (!(await hasher.verify(str(b.password), user.password_hash))) {
        await fail(`login:user:${normaliseUsername(user.username)}`, `login:ip:${ip}`);
        throw new HttpError(401, 'bad_credentials', 'Your password is incorrect.');
      }
      await db.query('delete from public.lwd_users where id = $1', [user.id]); // cascades to sessions, progress and platform records
      return { status: 204 };
    }

    // ── teaching platform ──
    // One teacher (the configured username) and her students (every other account).
    // Records: bookings, homework, feedback and activity, stored as JSON per row and
    // scoped by role: a student reads/writes only rows where student_id = self (and
    // may only log activity or submit homework); the teacher reads all and writes all.
    const isAdmin = user.role === 'admin';
    const isTeacher = user.role === 'teacher' || isAdmin; // the admin can do everything the teacher can
    const KINDS = ['booking', 'homework', 'feedback', 'activity'];
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const parseRow = (r: { data: unknown }) => (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) as Record<string, unknown>;
    const studentExists = async (id: string) => UUID.test(id) && (await db.query("select 1 from public.lwd_users where id = $1 and role = 'student'", [id])).length > 0;
    const qs = new URL(req.url).searchParams;

    if (path === 'platform/people' && method === 'GET') {
      const rows = isTeacher
        ? await db.query<{ id: string; username: string; first_name: string }>("select id, username, first_name from public.lwd_users where role = 'student' order by lower(first_name), username_norm")
        : [{ id: user.id, username: user.username, first_name: user.first_name }];
      return { status: 200, json: { people: rows.map((r) => ({ id: r.id, username: r.username, firstName: r.first_name, role: r.id === user.id ? user.role : 'student' })) } };
    }

    if (path === 'platform/students' && method === 'POST') {
      // The teacher creates a student's account and passes on the login details (the student can change the password later).
      if (!isTeacher) throw new HttpError(403, 'forbidden', 'Only the teacher can add students.');
      const b = await body(req);
      const username = str(b.username).trim();
      const firstName = str(b.firstName).trim();
      const generated = !str(b.password);
      const password = generated ? temporaryPassword() : str(b.password);
      const err = validateUsername(username) ?? validateFirstName(firstName) ?? validatePassword(password, username);
      if (err) throw new HttpError(400, 'invalid', err);
      const norm = normaliseUsername(username);
      if ((await db.query('select 1 from public.lwd_users where username_norm = $1', [norm])).length) throw new HttpError(409, 'username_taken', 'That username is already taken — try another.');
      const recoveryCode = newRecoveryCode();
      let made: UserRow;
      try {
        made = (await db.query<UserRow>(
          "insert into public.lwd_users (username, username_norm, first_name, password_hash, recovery_hash, created_at, password_changed_at, role) values ($1, $2, $3, $4, $5, $6, $6, 'student') returning id, username, first_name, password_hash, recovery_hash, role",
          [username, norm, firstName, await hasher.hash(password), await sha256Hex(normaliseRecoveryCode(recoveryCode)), iso(now())],
        ))[0];
      } catch (e) {
        if (String((e as Error).message).includes('unique') || String((e as { code?: string }).code) === '23505') throw new HttpError(409, 'username_taken', 'That username is already taken — try another.');
        throw e;
      }
      return { status: 201, json: { user: publicUser(made), recoveryCode, ...(generated ? { password } : {}) } };
    }

    const progressOf = path.match(/^platform\/progress\/([0-9a-f-]{36})$/i);
    if (progressOf && method === 'GET') {
      const sid = progressOf[1];
      if (sid !== user.id && !isTeacher) throw new HttpError(403, 'forbidden', 'You can only see your own progress.');
      if (sid !== user.id && !(await studentExists(sid))) throw new HttpError(404, 'not_found', 'Unknown student.');
      const rows = await db.query<{ data: unknown; updated_at: string | Date }>('select data, updated_at from public.lwd_progress where user_id = $1', [sid]);
      const r = rows[0];
      return { status: 200, json: r ? { data: parseRow(r), updatedAt: new Date(r.updated_at).toISOString() } : { data: null, updatedAt: null } };
    }

    if (path === 'platform/records' && method === 'GET') {
      const kind = qs.get('kind') ?? '';
      if (!KINDS.includes(kind)) throw new HttpError(400, 'invalid', 'Unknown record kind.');
      const sid = qs.get('studentId');
      if (sid && !UUID.test(sid)) throw new HttpError(400, 'invalid', 'Bad student id.');
      const params: unknown[] = [kind];
      let where = 'kind = $1';
      if (!isTeacher) { params.push(user.id); where += ` and student_id = $${params.length}`; }
      else if (sid) { params.push(sid); where += ` and student_id = $${params.length}`; }
      const rows = await db.query<{ data: unknown }>(`select data from public.lwd_platform where ${where} order by updated_at desc limit 2000`, params);
      return { status: 200, json: { records: rows.map(parseRow) } };
    }

    if (path === 'platform/records' && method === 'PUT') {
      const b = await body(req);
      const kind = str(b.kind);
      const id = str(b.id);
      const studentId = str(b.studentId) || user.id;
      if (!KINDS.includes(kind)) throw new HttpError(400, 'invalid', 'Unknown record kind.');
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new HttpError(400, 'invalid', 'Bad record id.');
      if (!UUID.test(studentId)) throw new HttpError(400, 'invalid', 'Bad student id.');
      if (!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) throw new HttpError(400, 'invalid', 'Missing record data.');
      if (!isTeacher) {
        if (kind !== 'activity' || studentId !== user.id) throw new HttpError(403, 'forbidden', 'Only the teacher can do that.');
      } else if (!(await studentExists(studentId))) throw new HttpError(404, 'not_found', 'Unknown student.');
      const rec: Record<string, unknown> = { ...(b.data as Record<string, unknown>), id, studentId };
      if (kind !== 'activity') rec.teacherId = user.id; // never trust the client's teacherId
      if (kind === 'booking' && rec.status === 'scheduled') {
        const start = Date.parse(str(rec.startsAt));
        const dur = Number(rec.durationMin);
        if (!Number.isFinite(start) || !(dur > 0)) throw new HttpError(400, 'invalid', 'Choose a date, time and duration.');
        const others = await db.query<{ data: unknown }>("select data from public.lwd_platform where kind = 'booking' and teacher_id = $1 and id <> $2", [user.id, id]);
        for (const o of others) {
          const d = parseRow(o);
          if (d.status !== 'scheduled') continue;
          const s2 = Date.parse(str(d.startsAt));
          if (start < s2 + Number(d.durationMin) * MIN && s2 < start + dur * MIN) throw new HttpError(409, 'overlap', 'That time overlaps another lesson.', { clash: d });
        }
      }
      const rows = await db.query<{ id: string }>(
        'insert into public.lwd_platform (id, kind, teacher_id, student_id, data, updated_at) values ($1, $2, $3, $4, $5::jsonb, $6) on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at where public.lwd_platform.kind = excluded.kind and public.lwd_platform.student_id = excluded.student_id returning id',
        [id, kind, isTeacher ? user.id : null, studentId, JSON.stringify(rec), iso(now())],
      );
      if (!rows[0]) throw new HttpError(409, 'conflict', 'That record id is already used for something else.');
      return { status: 200, json: { record: rec } };
    }

    if (path === 'platform/homework/submit' && method === 'POST') {
      const b = await body(req);
      const result = b.result as Record<string, unknown> | undefined;
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new HttpError(400, 'invalid', 'Missing result.');
      const rows = await db.query<{ data: unknown; student_id: string }>("select data, student_id from public.lwd_platform where id = $1 and kind = 'homework'", [str(b.id)]);
      const row = rows[0];
      if (!row) throw new HttpError(404, 'not_found', 'Homework not found.');
      if (!isTeacher && row.student_id !== user.id) throw new HttpError(403, 'forbidden', 'This homework belongs to someone else.');
      const cur = parseRow(row);
      const next = { ...cur, status: cur.status === 'reviewed' ? 'reviewed' : 'submitted', result: { ...result, completedAt: str(result.completedAt) || iso(now()) } };
      await db.query('update public.lwd_platform set data = $2::jsonb, updated_at = $3 where id = $1', [str(b.id), JSON.stringify(next), iso(now())]);
      // Adaptive follow-up (re-try or stretch) for plan items, created once per source item.
      let followUp: AdaptHomework | null = null;
      const fid = `${str(b.id)}-fu`;
      if (!(await db.query('select 1 from public.lwd_platform where id = $1', [fid])).length) {
        followUp = followUpFor(next as unknown as AdaptHomework, iso(now()), fid);
        if (followUp) await db.query("insert into public.lwd_platform (id, kind, teacher_id, student_id, data, updated_at) values ($1, 'homework', $2, $3, $4::jsonb, $5) on conflict (id) do nothing", [fid, followUp.teacherId, row.student_id, JSON.stringify(followUp), iso(now())]);
      }
      return { status: 200, json: { record: next, followUp } };
    }

    if (path === 'platform/records/delete' && method === 'POST') {
      const b = await body(req);
      if (!isTeacher) throw new HttpError(403, 'forbidden', 'Only the teacher can do that.');
      await db.query("delete from public.lwd_platform where id = $1 and kind in ('homework', 'feedback')", [str(b.id)]);
      return { status: 204 };
    }

    // ── administration (admin role only) ──
    if (path.startsWith('admin/')) {
      if (!isAdmin) throw new HttpError(403, 'forbidden', 'Administrators only.');

      if (path === 'admin/overview' && method === 'GET') {
        const [roles, kinds, active7, active1, progress, attempts] = await Promise.all([
          db.query<{ role: string; n: number }>('select role, count(*)::int as n from public.lwd_users group by role'),
          db.query<{ kind: string; n: number }>('select kind, count(*)::int as n from public.lwd_platform group by kind'),
          db.query<{ n: number }>('select count(distinct user_id)::int as n from public.lwd_sessions where last_used_at > $1', [iso(now() - 7 * DAY)]),
          db.query<{ n: number }>('select count(distinct user_id)::int as n from public.lwd_sessions where last_used_at > $1', [iso(now() - DAY)]),
          db.query<{ n: number; latest: string | Date | null }>('select count(*)::int as n, max(updated_at) as latest from public.lwd_progress'),
          db.query<{ n: number }>('select count(*)::int as n from public.lwd_attempts where at > $1', [iso(now() - DAY)]),
        ]);
        return { status: 200, json: {
          users: Object.fromEntries(roles.map((r) => [r.role, Number(r.n)])),
          records: Object.fromEntries(kinds.map((k) => [k.kind, Number(k.n)])),
          activeUsers7d: Number(active7[0]?.n ?? 0), activeUsers24h: Number(active1[0]?.n ?? 0),
          progressSaves: Number(progress[0]?.n ?? 0), latestProgressAt: progress[0]?.latest ? new Date(progress[0].latest).toISOString() : null,
          loginAttempts24h: Number(attempts[0]?.n ?? 0),
        } };
      }

      if (path === 'admin/users' && method === 'GET') {
        const rows = await db.query<{ id: string; username: string; first_name: string; role: string; created_at: string | Date; last_seen: string | Date | null; progress_at: string | Date | null; homework: number; bookings: number }>(
          `select u.id, u.username, u.first_name, u.role, u.created_at,
                  (select max(s.last_used_at) from public.lwd_sessions s where s.user_id = u.id) as last_seen,
                  (select p.updated_at from public.lwd_progress p where p.user_id = u.id) as progress_at,
                  (select count(*)::int from public.lwd_platform r where r.student_id = u.id and r.kind = 'homework') as homework,
                  (select count(*)::int from public.lwd_platform r where r.student_id = u.id and r.kind = 'booking') as bookings
             from public.lwd_users u order by case u.role when 'admin' then 0 when 'teacher' then 1 else 2 end, lower(u.first_name), u.username_norm`);
        return { status: 200, json: { users: rows.map((r) => ({ id: r.id, username: r.username, firstName: r.first_name, role: r.role, createdAt: new Date(r.created_at).toISOString(), lastSeenAt: r.last_seen ? new Date(r.last_seen).toISOString() : null, progressAt: r.progress_at ? new Date(r.progress_at).toISOString() : null, homework: Number(r.homework), bookings: Number(r.bookings) })) } };
      }

      const target = async (b: Record<string, unknown>) => {
        const id = str(b.userId);
        if (!UUID.test(id)) throw new HttpError(400, 'invalid', 'Bad user id.');
        const rows = await db.query<UserRow>('select id, username, first_name, password_hash, recovery_hash, role from public.lwd_users where id = $1', [id]);
        if (!rows[0]) throw new HttpError(404, 'not_found', 'No such account.');
        return rows[0];
      };

      if (path === 'admin/users/role' && method === 'POST') {
        const b = await body(req);
        const role = str(b.role);
        if (role !== 'student' && role !== 'teacher') throw new HttpError(400, 'invalid', 'Role must be student or teacher (admins are set in the server configuration).');
        const u = await target(b);
        if (u.id === user.id) throw new HttpError(400, 'invalid', 'You cannot change your own role.');
        if (u.role === 'admin') throw new HttpError(400, 'invalid', 'That account is an administrator.');
        await db.query('update public.lwd_users set role = $2 where id = $1', [u.id, role]);
        await db.query('delete from public.lwd_sessions where user_id = $1', [u.id]); // they log in again with the new role
        return { status: 200, json: { user: { id: u.id, username: u.username, firstName: u.first_name, role } } };
      }

      if (path === 'admin/users/reset-password' && method === 'POST') {
        const b = await body(req);
        const u = await target(b);
        if (u.role === 'admin' && u.id !== user.id) throw new HttpError(400, 'invalid', 'Another administrator’s password cannot be reset here.');
        const generated = !str(b.password);
        const password = generated ? temporaryPassword() : str(b.password);
        const err = validatePassword(password, u.username);
        if (err) throw new HttpError(400, 'invalid', err);
        const recoveryCode = newRecoveryCode();
        await db.query('update public.lwd_users set password_hash = $2, recovery_hash = $3, password_changed_at = $4 where id = $1', [u.id, await hasher.hash(password), await sha256Hex(normaliseRecoveryCode(recoveryCode)), iso(now())]);
        await db.query('delete from public.lwd_sessions where user_id = $1 and token_hash <> $2', [u.id, tokenHash]);
        await clear(`login:user:${normaliseUsername(u.username)}`);
        return { status: 200, json: { user: { id: u.id, username: u.username, firstName: u.first_name, role: u.role }, recoveryCode, ...(generated ? { password } : {}) } };
      }

      if (path === 'admin/users/delete' && method === 'POST') {
        const b = await body(req);
        const u = await target(b);
        if (u.id === user.id) throw new HttpError(400, 'invalid', 'Use your own account page to delete your account.');
        if (u.role === 'admin') throw new HttpError(400, 'invalid', 'Administrator accounts cannot be removed here.');
        await db.query('delete from public.lwd_users where id = $1', [u.id]); // cascades to sessions, progress and platform records
        return { status: 204 };
      }

      throw new HttpError(404, 'not_found', 'Not found.');
    }

    throw new HttpError(404, 'not_found', 'Not found.');
  }

  return async function handle(req: Request): Promise<Response> {
    const origin = req.headers.get('origin');
    const allowAny = config.allowedOrigins.includes('*');
    const originOk = !origin || allowAny || config.allowedOrigins.includes(origin);
    const headers = new Headers({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    });
    if (origin && originOk) {
      headers.set('access-control-allow-origin', origin);
      headers.set('vary', 'Origin');
      headers.set('access-control-allow-headers', 'authorization, content-type');
      headers.set('access-control-allow-methods', 'GET, POST, PUT, OPTIONS');
      headers.set('access-control-max-age', '600');
    }
    if (req.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers });
    if (!originOk) return new Response(JSON.stringify({ error: 'forbidden_origin', message: 'Origin not allowed.' }), { status: 403, headers });

    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const at = parts.lastIndexOf('account');
    const path = (at >= 0 ? parts.slice(at + 1) : parts).join('/');
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';

    try {
      const r = await route(req, path, ip);
      return new Response(r.status === 204 ? null : JSON.stringify(r.json ?? {}), { status: r.status, headers });
    } catch (e) {
      if (e instanceof HttpError) return new Response(JSON.stringify({ error: e.code, message: e.message, ...e.extra }), { status: e.status, headers });
      console.error('account error', e);
      return new Response(JSON.stringify({ error: 'server_error', message: 'Something went wrong. Please try again.' }), { status: 500, headers });
    }
  };
}

// ── Argon2id hasher (hash-wasm), OWASP 2024 parameters: m=19 MiB, t=2, p=1 ──
interface HashWasm {
  argon2id(o: { password: string; salt: Uint8Array; parallelism: number; iterations: number; memorySize: number; hashLength: number; outputType: 'encoded' }): Promise<string>;
  argon2Verify(o: { password: string; hash: string }): Promise<boolean>;
}
export function argon2Hasher(lib: HashWasm): Hasher {
  return {
    hash: (password) => lib.argon2id({ password, salt: randomBytes(16), parallelism: 1, iterations: 2, memorySize: 19456, hashLength: 32, outputType: 'encoded' }),
    verify: async (password, encoded) => {
      try {
        return await lib.argon2Verify({ password, hash: encoded });
      } catch {
        return false;
      }
    },
  };
}
