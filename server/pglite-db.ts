import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Db } from '../supabase/functions/_shared/account-core.ts';

const MIGRATIONS = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));

/** Real Postgres (WASM) with the production migrations applied in order. dataDir undefined = in-memory. */
export async function createPgliteDb(dataDir?: string): Promise<{ db: Db; pg: PGlite }> {
  const pg = new PGlite(dataDir);
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) await pg.exec(readFileSync(MIGRATIONS + f, 'utf8'));
  return { pg, db: { query: async (q, params = []) => (await pg.query(q, params)).rows as never } };
}
