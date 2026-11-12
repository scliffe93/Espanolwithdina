// Supabase Edge Function: Learning with Dina accounts & progress.
// Deploy: supabase functions deploy account --no-verify-jwt
// Secrets: ALLOWED_ORIGINS (comma-separated, e.g. https://scliffe93.github.io)
//          TEACHER_USERNAMES (comma-separated; default "dina") — these accounts are the teacher
//          ADMIN_USERNAMES (comma-separated; default "admin") — these accounts administer everything
//          VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT — phone notifications (set by scripts/supabase-setup.mjs; absent = off)
// SUPABASE_DB_URL is provided automatically to Edge Functions.
import * as hashwasm from 'npm:hash-wasm@4.12.0';
import postgres from 'npm:postgres@3.4.5';
import { argon2Hasher, createHandler } from '../_shared/account-core.ts';

// SUPABASE_DB_URL is injected automatically. LWD_DB_URL lets you point at the connection pooler instead.
const sql = postgres(Deno.env.get('LWD_DB_URL') ?? Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 3 });

const handler = createHandler(
  { query: (q, params = []) => sql.unsafe(q, params as never[]) as never },
  argon2Hasher(hashwasm),
  {
    allowedOrigins: (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    teacherUsernames: (Deno.env.get('TEACHER_USERNAMES') ?? 'dina').split(',').map((s) => s.trim()).filter(Boolean),
    adminUsernames: (Deno.env.get('ADMIN_USERNAMES') ?? 'admin').split(',').map((s) => s.trim()).filter(Boolean),
    push: Deno.env.get('VAPID_PUBLIC_KEY') && Deno.env.get('VAPID_PRIVATE_KEY') ? { publicKey: Deno.env.get('VAPID_PUBLIC_KEY')!, privateKey: Deno.env.get('VAPID_PRIVATE_KEY')!, subject: Deno.env.get('VAPID_SUBJECT') ?? 'https://scliffe93.github.io/Espanolwithdina/' } : undefined,
  },
);

Deno.serve(handler);
