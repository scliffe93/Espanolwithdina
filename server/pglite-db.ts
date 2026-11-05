import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Db } from '../supabase/functions/_shared/account-core.ts';

const MIGRATION = fileURLToPath(new URL('../supabase/migrations/20261106000000_lwd_accounts.sql', import.meta.url));

/** Real Postgres (WASM) with the production migration applied. dataDir undefined = in-memory. */
export async function createPgliteDb(dataDir?: string): Promise<{ db: Db; pg: PGlite }> {
  const pg = new PGlite(dataDir);
  await pg.exec(readFileSync(MIGRATION, 'utf8'));
  return { pg, db: { query: async (q, params = []) => (await pg.query(q, params)).rows as never } };
}
