// Local development server for the account API (same code as the Supabase Edge Function).
// Usage: npx tsx server/dev-server.ts [port] [dataDir]
import { createServer } from 'node:http';
import * as hashwasm from 'hash-wasm';
import { argon2Hasher, createHandler } from '../supabase/functions/_shared/account-core.ts';
import { createPgliteDb } from './pglite-db.ts';

const port = Number(process.argv[2] ?? 8787);
const dataDir = process.argv[3] ?? '.data/pglite';
const { db } = await createPgliteDb(dataDir === 'memory' ? undefined : dataDir);
const handle = createHandler(db, argon2Hasher(hashwasm), { allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:4173,http://localhost:5173').split(',') });

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await handle(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers as Record<string, string>, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body }));
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log(`Learning with Dina account API on http://localhost:${port}/account`));
