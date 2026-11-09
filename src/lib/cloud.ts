// ───────────────────────────────────────────────────────────────
// Learning with Dina — cloud account client.
// The API URL comes from VITE_LWD_API_URL at build time. When it isn't
// set, accounts are simply unavailable and the app stays local-only.
// No secrets live here: the browser only ever holds the learner's own
// session token (Authorization: Bearer), never any server key.
// ───────────────────────────────────────────────────────────────

export const API_URL = ((import.meta.env.VITE_LWD_API_URL as string | undefined) ?? '').replace(/\/+$/, '');
export const cloudConfigured = !!API_URL;

export interface CloudUser { id: string; username: string; firstName: string; /** Set by the teaching platform backend; absent on plain learner accounts. */ role?: 'student' | 'teacher' | 'admin' }
export interface Session { token: string; user: CloudUser; remember: boolean; expiresAt: string }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public data: Record<string, unknown> = {}) {
    super(message);
  }
}

const SESSION_KEY = 'lwd-session';
const DEVICE_KEY = 'lwd-device';

function storages(): Storage[] {
  const out: Storage[] = [];
  try { out.push(window.localStorage); } catch { /* blocked */ }
  try { out.push(window.sessionStorage); } catch { /* blocked */ }
  return out;
}

/** Remember me → localStorage (survives restarts). Otherwise sessionStorage (cleared when the browser closes). */
export function saveSession(s: Session | null) {
  for (const st of storages()) try { st.removeItem(SESSION_KEY); } catch { /* ignore */ }
  if (!s) return;
  try {
    (s.remember ? window.localStorage : window.sessionStorage).setItem(SESSION_KEY, JSON.stringify(s));
  } catch { /* storage unavailable: session lasts for this page only */ }
}

export function loadSession(): Session | null {
  for (const st of storages()) {
    try {
      const raw = st.getItem(SESSION_KEY);
      if (!raw) continue;
      const s = JSON.parse(raw) as Session;
      if (s?.token && s.user?.id && new Date(s.expiresAt).getTime() > Date.now()) return s;
    } catch { /* ignore corrupt */ }
  }
  return null;
}

export function deviceId(): string {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'unknown-device';
  }
}

async function request<T>(path: string, opts: { method?: string; body?: unknown; token?: string; keepalive?: boolean } = {}): Promise<T> {
  if (!cloudConfigured) throw new ApiError(0, 'not_configured', 'Online accounts aren’t set up for this copy of the app yet.');
  let res: Response;
  try {
    res = await fetch(`${API_URL}/${path}`, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      keepalive: opts.keepalive,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'offline', 'You appear to be offline. Your progress is saved on this device and will sync when you reconnect.');
  }
  if (res.status === 204) return undefined as T;
  let json: Record<string, unknown> = {};
  try { json = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new ApiError(res.status, String(json.error ?? 'error'), String(json.message ?? 'Something went wrong.'), json);
  return json as T;
}

type AuthResult = { token: string; expiresAt: string; user: CloudUser; recoveryCode?: string };

export const api = {
  register: (username: string, password: string, firstName: string, remember: boolean) => request<AuthResult>('register', { body: { username, password, firstName, remember } }),
  login: (username: string, password: string, remember: boolean) => request<AuthResult>('login', { body: { username, password, remember } }),
  recover: (username: string, recoveryCode: string, newPassword: string, remember: boolean) => request<AuthResult>('recover', { body: { username, recoveryCode, newPassword, remember } }),
  logout: (token: string) => request<void>('logout', { method: 'POST', token }),
  me: (token: string) => request<{ user: CloudUser }>('me', { token }),
  changePassword: (token: string, currentPassword: string, newPassword: string) => request<{ ok: true }>('change-password', { token, body: { currentPassword, newPassword } }),
  newRecoveryCode: (token: string, password: string) => request<{ recoveryCode: string }>('recovery-code', { token, body: { password } }),
  deleteAccount: (token: string, password: string) => request<void>('delete-account', { token, body: { password } }),
  getProgress: (token: string) => request<{ data: unknown; version: number; updatedAt: string | null }>('progress', { token }),
  putProgress: (token: string, data: unknown, baseVersion: number, keepalive = false) =>
    request<{ version: number; updatedAt: string }>('progress', { method: 'PUT', token, body: { data, baseVersion, deviceId: deviceId() }, keepalive }),
};

export interface PlatformPerson { id: string; username: string; firstName: string; role: 'student' | 'teacher' | 'admin' }
export type PlatformKind = 'booking' | 'homework' | 'feedback' | 'activity';

/** Teaching platform endpoints (same Edge Function). Every call is scoped server-side to the signed-in person's role. */
export const platformApi = {
  people: (token: string) => request<{ people: PlatformPerson[] }>('platform/people', { token }),
  progress: (token: string, studentId: string) => request<{ data: unknown; updatedAt: string | null }>(`platform/progress/${encodeURIComponent(studentId)}`, { token }),
  records: <T>(token: string, kind: PlatformKind, studentId?: string) => request<{ records: T[] }>(`platform/records?kind=${kind}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''}`, { token }),
  put: <T>(token: string, kind: PlatformKind, id: string, studentId: string, data: T) => request<{ record: T }>('platform/records', { method: 'PUT', token, body: { kind, id, studentId, data } }),
  submitHomework: <T>(token: string, id: string, result: unknown) => request<{ record: T }>('platform/homework/submit', { token, body: { id, result } }),
  remove: (token: string, id: string) => request<void>('platform/records/delete', { method: 'POST', token, body: { id } }),
  addStudent: (token: string, input: { username: string; firstName: string; password?: string }) => request<{ user: PlatformPerson; recoveryCode: string; password?: string }>('platform/students', { token, body: input }),
};

export interface AdminUser { id: string; username: string; firstName: string; role: 'student' | 'teacher' | 'admin'; createdAt: string; lastSeenAt: string | null; progressAt: string | null; homework: number; bookings: number }
export interface AdminOverview { users: Record<string, number>; records: Record<string, number>; activeUsers7d: number; activeUsers24h: number; progressSaves: number; latestProgressAt: string | null; loginAttempts24h: number }
/** Administration endpoints (admin role only). */
export const adminApi = {
  overview: (token: string) => request<AdminOverview>('admin/overview', { token }),
  users: (token: string) => request<{ users: AdminUser[] }>('admin/users', { token }),
  setRole: (token: string, userId: string, role: 'student' | 'teacher') => request<{ user: PlatformPerson }>('admin/users/role', { token, body: { userId, role } }),
  resetPassword: (token: string, userId: string, password?: string) => request<{ user: PlatformPerson; recoveryCode: string; password?: string }>('admin/users/reset-password', { token, body: { userId, password } }),
  remove: (token: string, userId: string) => request<void>('admin/users/delete', { token, body: { userId } }),
};

const KNOWN_KEY = 'lwd-known-accounts';
export interface KnownAccount { username: string; firstName: string; role?: 'student' | 'teacher' | 'admin'; at: number }
/** Accounts that have signed in on this device (no secrets: just who, for the quick-pick on the front page). */
export function knownAccounts(): KnownAccount[] {
  try { const v = JSON.parse(window.localStorage.getItem(KNOWN_KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function rememberAccount(u: CloudUser) {
  try {
    const rest = knownAccounts().filter((k) => k.username.toLowerCase() !== u.username.toLowerCase());
    window.localStorage.setItem(KNOWN_KEY, JSON.stringify([{ username: u.username, firstName: u.firstName, role: u.role, at: Date.now() }, ...rest].slice(0, 8)));
  } catch { /* storage unavailable */ }
}
export function forgetAccount(username: string) {
  try { window.localStorage.setItem(KNOWN_KEY, JSON.stringify(knownAccounts().filter((k) => k.username.toLowerCase() !== username.toLowerCase()))); } catch { /* ignore */ }
}

/** Client-side mirror of the server's password rules (the server is authoritative). */
export function passwordProblem(pw: string, username: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (pw.length > 128) return 'Use at most 128 characters.';
  const u = username.trim().toLowerCase();
  if (u.length >= 4 && pw.toLowerCase().includes(u)) return 'Your password shouldn’t contain your username.';
  return null;
}
