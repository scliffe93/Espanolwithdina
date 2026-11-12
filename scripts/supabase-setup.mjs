#!/usr/bin/env node
// One-command Supabase setup for Learning with Dina (free tier), using the Management API.
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/supabase-setup.mjs [--project learning-with-dina] [--region eu-west-2] [--origins https://scliffe93.github.io] [--teachers dina]
// Steps (all idempotent): find/create the project → wait until healthy → apply supabase/migrations/*.sql →
// set ALLOWED_ORIGINS + TEACHER_USERNAMES → create the notification (VAPID) keys once → bundle and deploy the `account` Edge Function (JWT check off) →
// health-check it → print the API URL to put in .env.production / the LWD_API_URL repository variable.
// Re-running is safe: existing project, tables (IF NOT EXISTS), secrets and function are updated in place.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { build } from 'esbuild';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true'] : [])).filter(Boolean));
const NAME = args.project ?? 'learning-with-dina';
const REGION = args.region ?? 'eu-west-2';
const ORIGINS = args.origins ?? 'https://scliffe93.github.io';
const TEACHERS = args.teachers ?? 'dina';
const ADMINS = args.admins ?? 'admin';
const SUBJECT = args.subject ?? 'https://scliffe93.github.io/Espanolwithdina/'; // who runs the notifications (a public URL the push services can see)
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? 'proxy-injected';
const API = 'https://api.supabase.com/v1';
const log = (...m) => console.log('•', ...m);

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${TOKEN}`, ...(init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) } });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  return json;
}

/** Bundles the Edge Function into one file (npm: imports stay external, Deno resolves them). */
export async function bundleFunction() {
  const out = join(tmpdir(), `lwd-fn-${Date.now()}`);
  mkdirSync(out, { recursive: true });
  const r = await build({ entryPoints: ['supabase/functions/account/index.ts'], bundle: true, format: 'esm', platform: 'neutral', target: 'esnext', write: false, plugins: [{ name: 'deno-npm', setup(b) { b.onResolve({ filter: /^npm:/ }, (a) => ({ path: a.path, external: true })); } }] });
  const code = r.outputFiles[0].text;
  writeFileSync(join(out, 'index.ts'), code);
  return { dir: out, code };
}

async function main() {
  if (args['bundle-only']) { const b = await bundleFunction(); log(`bundled function: ${b.code.length} bytes → ${b.dir}/index.ts`); return; }

  // 1. Organisation + project
  let project = (await api('/projects')).find((p) => p.name === NAME);
  if (project) log(`project exists: ${project.name} (${project.id}) in ${project.region}`);
  else {
    const orgs = await api('/organizations');
    if (!orgs.length) throw new Error('No Supabase organisation on this account — create one in the dashboard first.');
    const org = orgs[0];
    log(`organisation: ${org.name} (${org.id})`);
    const dbPass = randomBytes(24).toString('base64url');
    project = await api('/projects', { method: 'POST', body: JSON.stringify({ name: NAME, organization_id: org.id, db_pass: dbPass, region: REGION, plan: 'free' }) });
    log(`project created: ${project.id} in ${REGION} (database password set randomly; reset it in the dashboard if you ever need direct database access)`);
  }
  const ref = project.id;

  // 2. Wait until the database is up
  for (let i = 0; i < 60; i++) {
    const p = await api(`/projects/${ref}`);
    if (p.status === 'ACTIVE_HEALTHY') break;
    if (i === 59) throw new Error(`project still ${p.status} after 10 minutes`);
    if (i % 6 === 0) log(`waiting for the project (${p.status})…`);
    await new Promise((r) => setTimeout(r, 10_000));
  }
  log('project is healthy');

  // 3. Migrations
  for (const f of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) {
    await api(`/projects/${ref}/database/query`, { method: 'POST', body: JSON.stringify({ query: readFileSync(join('supabase/migrations', f), 'utf8') }) });
    log(`applied ${f}`);
  }
  const tables = await api(`/projects/${ref}/database/query`, { method: 'POST', body: JSON.stringify({ query: "select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename like 'lwd_%' order by 1" }) });
  log('tables:', tables.map((t) => `${t.tablename}${t.rowsecurity ? ' (RLS on)' : ' (RLS OFF!)'}`).join(', '));
  if (tables.some((t) => !t.rowsecurity)) throw new Error('A table has Row Level Security off — stopping.');

  // 4. Secrets
  await api(`/projects/${ref}/secrets`, { method: 'POST', body: JSON.stringify([{ name: 'ALLOWED_ORIGINS', value: ORIGINS }, { name: 'TEACHER_USERNAMES', value: TEACHERS }, { name: 'ADMIN_USERNAMES', value: ADMINS }]) });
  log(`secrets set: ALLOWED_ORIGINS=${ORIGINS} TEACHER_USERNAMES=${TEACHERS} ADMIN_USERNAMES=${ADMINS}`);

  // 4b. Phone notifications: a VAPID key pair, generated once. The private key only ever exists as a server secret
  // (never printed, never in the repository). Regenerating it would silently disconnect every phone, so keep it.
  const names = (await api(`/projects/${ref}/secrets`)).map((x) => x.name);
  if (names.includes('VAPID_PUBLIC_KEY') && names.includes('VAPID_PRIVATE_KEY')) log('notification keys already set (kept)');
  else {
    const b64u = (buf) => Buffer.from(buf).toString('base64url');
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const publicKey = b64u(await crypto.subtle.exportKey('raw', pair.publicKey));
    await api(`/projects/${ref}/secrets`, { method: 'POST', body: JSON.stringify([{ name: 'VAPID_PUBLIC_KEY', value: publicKey }, { name: 'VAPID_PRIVATE_KEY', value: jwk.d }, { name: 'VAPID_SUBJECT', value: SUBJECT }]) });
    log(`notification keys created (public key ${publicKey.slice(0, 12)}…)`);
  }

  // 5. Deploy the function
  const { code } = await bundleFunction();
  const form = new FormData();
  form.append('metadata', JSON.stringify({ name: 'account', entrypoint_path: 'index.ts', verify_jwt: false }));
  form.append('file', new Blob([code], { type: 'text/typescript' }), 'index.ts');
  const fn = await api(`/projects/${ref}/functions/deploy?slug=account`, { method: 'POST', body: form });
  log(`function deployed: ${fn.slug ?? 'account'} v${fn.version ?? '?'} (verify_jwt=${fn.verify_jwt})`);

  // 6. Health check from the outside
  const url = `https://${ref}.supabase.co/functions/v1/account`;
  for (let i = 0; i < 12; i++) {
    const res = await fetch(`${url}/health`, { headers: { origin: ORIGINS.split(',')[0] } }).catch(() => null);
    if (res?.ok) { log(`health check OK: ${url}/health → ${await res.text()}`); break; }
    if (i === 11) throw new Error(`function not responding at ${url}/health (status ${res?.status})`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log(`\nAPI URL: ${url}\nPut it in .env.production as VITE_LWD_API_URL=${url} (or the LWD_API_URL repository variable) and redeploy the site.`);
}

main().catch((e) => { console.error('✗', e.message); process.exit(1); });
