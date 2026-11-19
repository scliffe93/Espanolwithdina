// Supabase Edge Function: Learning with Dina accounts & progress.
// Deploy: supabase functions deploy account --no-verify-jwt
// Secrets: ALLOWED_ORIGINS (comma-separated, e.g. https://scliffe93.github.io)
//          TEACHER_USERNAMES (comma-separated; default "dina") — these accounts are the teacher
//          ADMIN_USERNAMES (comma-separated; default "admin") — these accounts administer everything
//          VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT — phone notifications (set by scripts/supabase-setup.mjs; absent = off)
//          CRON_SECRET — lets the database's scheduler call cron/tick for timed notifications (set by scripts/supabase-setup.mjs; absent = off)
// SUPABASE_DB_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically to Edge Functions.
import * as hashwasm from 'npm:hash-wasm@4.12.0';
import postgres from 'npm:postgres@3.4.5';
import { argon2Hasher, createHandler, type FileStore } from '../_shared/account-core.ts';

// SUPABASE_DB_URL is injected automatically. LWD_DB_URL lets you point at the connection pooler instead.
const sql = postgres(Deno.env.get('LWD_DB_URL') ?? Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 3 });

// Uploaded files (homework PDFs, the learning bank) live in a private Storage bucket. The function signs short-lived
// links with the service key; the browser sends and reads the file itself, so no file passes through the function.
const BUCKET = 'lwd-files';
const STORAGE = `${Deno.env.get('SUPABASE_URL') ?? ''}/storage/v1`;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
async function storage<T>(method: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${STORAGE}${path}`, { method, headers: { authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`storage ${method} ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}
const files: FileStore | undefined = STORAGE.startsWith('http') && SERVICE_KEY ? {
  signUpload: async (key) => `${STORAGE}${(await storage<{ url: string }>('POST', `/object/upload/sign/${BUCKET}/${key}`, {})).url}`,
  signDownload: async (key, seconds) => encodeURI(`${STORAGE}${(await storage<{ signedURL: string }>('POST', `/object/sign/${BUCKET}/${key}`, { expiresIn: seconds })).signedURL}`),
  remove: async (keys) => { await storage('DELETE', `/object/${BUCKET}`, { prefixes: keys }); },
} : undefined;

const handler = createHandler(
  { query: (q, params = []) => sql.unsafe(q, params as never[]) as never },
  argon2Hasher(hashwasm),
  {
    allowedOrigins: (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    teacherUsernames: (Deno.env.get('TEACHER_USERNAMES') ?? 'dina').split(',').map((s) => s.trim()).filter(Boolean),
    adminUsernames: (Deno.env.get('ADMIN_USERNAMES') ?? 'admin').split(',').map((s) => s.trim()).filter(Boolean),
    cronSecret: Deno.env.get('CRON_SECRET') || undefined,
    files,
    push: Deno.env.get('VAPID_PUBLIC_KEY') && Deno.env.get('VAPID_PRIVATE_KEY') ? { publicKey: Deno.env.get('VAPID_PUBLIC_KEY')!, privateKey: Deno.env.get('VAPID_PRIVATE_KEY')!, subject: Deno.env.get('VAPID_SUBJECT') ?? 'https://scliffe93.github.io/Espanolwithdina/' } : undefined,
  },
);

Deno.serve(handler);
