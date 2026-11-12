import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createPgliteDb } from '../server/pglite-db';

// scripts/supabase-setup.mjs re-applies every migration on each deploy, so the whole set must be safe to run
// again on a database that already holds every kind of row.
describe('migrations', () => {
  it('can be re-applied over existing data of every kind', async () => {
    const { pg } = await createPgliteDb();
    const u = (await pg.query<{ id: string }>("insert into public.lwd_users (username, username_norm, first_name, password_hash, recovery_hash, role) values ('Sam', 'sam', 'Sam', 'x', 'y', 'student') returning id")).rows[0].id;
    for (const kind of ['booking', 'homework', 'feedback', 'activity', 'invoice', 'config', 'credit', 'student']) await pg.query('insert into public.lwd_platform (id, kind, student_id, data, updated_at) values ($1, $2, $3, $4::jsonb, now())', [`row-${kind}-0001`, kind, u, '{}']);
    await pg.query("insert into public.lwd_push (endpoint_hash, user_id, endpoint, p256dh, auth) values ('h', $1, 'https://web.push.apple.com/x', 'p', 'a')", [u]);
    const dir = new URL('../supabase/migrations/', import.meta.url);
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await pg.exec(readFileSync(new URL(f, dir), 'utf8'));
    expect((await pg.query<{ n: number }>('select count(*)::int as n from public.lwd_platform')).rows[0].n).toBe(8);
    expect((await pg.query<{ n: number }>('select count(*)::int as n from public.lwd_push')).rows[0].n).toBe(1);
  });
});
