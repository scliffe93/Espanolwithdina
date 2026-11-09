import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { PageHeader, Sheet } from '../components/ui';
import { useAccount } from '../lib/account';
import { adminApi, type AdminOverview, type AdminUser, type ApiError } from '../lib/cloud';
import { relative } from '../lib/platform/time';
import { navigate } from '../lib/router';

// Administration: every account on the platform, roles, password resets,
// removals and usage. Admin role only (set by ADMIN_USERNAMES on the server).

const ROLE_LABEL: Record<AdminUser['role'], string> = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' };

export function Admin() {
  const account = useAccount();
  const token = account.session?.token;
  const me = account.session?.user;
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reset, setReset] = useState<{ user: AdminUser; password?: string; recoveryCode?: string; custom: string } | null>(null);
  const [remove, setRemove] = useState<AdminUser | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [o, u] = await Promise.all([adminApi.overview(token), adminApi.users(token)]);
      setOverview(o); setUsers(u.users); setError(null);
    } catch (e) { setError((e as ApiError).message); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  if (!me) return <div className="card p-6 text-sm">Log in with the administrator account to see this page. <button className="btn-primary mt-3" onClick={() => navigate('account?mode=login')}>Log in</button></div>;
  if (me.role !== 'admin') return <div className="card p-6 text-sm">This page is for the administrator only.</div>;

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError(null);
    try { await fn(); await load(); } catch (e) { setError((e as ApiError).message); } finally { setBusy(null); }
  };
  const shown = (users ?? []).filter((u) => !filter || `${u.firstName} ${u.username}`.toLowerCase().includes(filter.toLowerCase()));
  const copyText = reset ? `Learning with Dina — login for ${reset.user.firstName}\nUsername: ${reset.user.username}\nPassword: ${reset.password ?? reset.custom}\nRecovery code (keep safe): ${reset.recoveryCode}\nApp: ${location.origin}${location.pathname}` : '';

  return (
    <div>
      <PageHeader eyebrow="Administración" title="Admin" subtitle="Every account on the platform, roles, password resets and usage. The teacher dashboards are in the menu too." />
      {error && <p role="alert" className="mb-4 rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{error}</p>}
      {overview && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="admin-overview">
          <Tile label="Accounts" value={String(Object.values(overview.users).reduce((a, b) => a + b, 0))} sub={`${overview.users.student ?? 0} students · ${overview.users.teacher ?? 0} teacher${(overview.users.teacher ?? 0) === 1 ? '' : 's'} · ${overview.users.admin ?? 0} admin`} />
          <Tile label="Active" value={String(overview.activeUsers7d)} sub={`last 7 days · ${overview.activeUsers24h} in the last 24 h`} />
          <Tile label="Lessons & homework" value={`${overview.records.booking ?? 0} / ${overview.records.homework ?? 0}`} sub={`${overview.records.feedback ?? 0} feedback notes · ${overview.records.activity ?? 0} activity lines`} />
          <Tile label="Progress saves" value={String(overview.progressSaves)} sub={overview.latestProgressAt ? `latest ${relative(overview.latestProgressAt)}` : 'none yet'} />
        </div>
      )}
      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold">Accounts</h2>
          <input aria-label="Filter accounts" className="input !w-56 !py-1.5" placeholder="Filter by name or username" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {!users ? <p className="text-sm text-ink-mute">Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="admin-users">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-mute"><th className="py-1.5 font-semibold">Person</th><th className="py-1.5 font-semibold">Role</th><th className="py-1.5 font-semibold">Last seen</th><th className="py-1.5 font-semibold">Progress saved</th><th className="py-1.5 text-right font-semibold">Lessons · HW</th><th className="py-1.5 text-right font-semibold">Actions</th></tr></thead>
              <tbody>
                {shown.map((u) => {
                  const self = u.id === me.id;
                  return (
                    <tr key={u.id} className="border-t border-ink/5 align-middle">
                      <td className="py-2"><span className="font-semibold">{u.firstName}</span> <span className="text-ink-mute">@{u.username}</span>{self && <span className="ml-1 rounded-full bg-cream-200 px-2 py-0.5 text-[10px] font-bold uppercase">you</span>}<br /><span className="text-xs text-ink-mute">joined {new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>
                      <td className="py-2">{u.role === 'admin' || self ? ROLE_LABEL[u.role] : (
                        <select aria-label={`Role of ${u.firstName}`} className="input !w-32 !py-1 text-sm" value={u.role} disabled={busy === `role-${u.id}`} onChange={(e) => act(`role-${u.id}`, () => adminApi.setRole(token!, u.id, e.target.value as 'student' | 'teacher').then(() => undefined))}>
                          <option value="student">Student</option><option value="teacher">Teacher</option>
                        </select>
                      )}</td>
                      <td className="py-2 tabular-nums text-ink-soft">{u.lastSeenAt ? relative(u.lastSeenAt) : 'never'}</td>
                      <td className="py-2 tabular-nums text-ink-soft">{u.progressAt ? relative(u.progressAt) : '—'}</td>
                      <td className="py-2 text-right tabular-nums">{u.bookings} · {u.homework}</td>
                      <td className="py-2 text-right">
                        <div className="inline-flex gap-1">
                          {(u.role !== 'admin' || self) && <button type="button" className="ctrl !py-1 !text-xs" onClick={() => setReset({ user: u, custom: '' })} data-testid={`reset-${u.username}`}><Icon name="key" size={12} /> Reset password</button>}
                          {u.role !== 'admin' && <button type="button" className="ctrl !py-1 !text-xs text-terracotta-dark" onClick={() => setRemove(u)} data-testid={`remove-${u.username}`}><Icon name="trash" size={12} /> Remove</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-mute">Changing a role signs that person out so they come back with the new role. Administrators are set in the server configuration, not here. Removing an account deletes their progress, lessons and homework permanently.</p>
      </section>

      <Sheet open={!!reset} onClose={() => setReset(null)} title={reset ? `Reset ${reset.user.firstName}’s password` : ''}>
        {reset && !reset.recoveryCode && (
          <div className="grid gap-3 text-sm">
            <p className="text-ink-soft">Sets a new password and a new recovery code, and signs {reset.user.firstName} out everywhere. Leave the box empty to generate a simple temporary password.</p>
            <input className="input" type="text" placeholder="New password (optional)" value={reset.custom} onChange={(e) => setReset({ ...reset, custom: e.target.value })} autoComplete="off" />
            <div className="flex gap-2"><button type="button" className="btn-primary" disabled={busy === 'reset'} onClick={() => act('reset', async () => { const r = await adminApi.resetPassword(token!, reset.user.id, reset.custom || undefined); setReset({ ...reset, password: r.password, recoveryCode: r.recoveryCode }); })} data-testid="confirm-reset">{busy === 'reset' ? 'Resetting…' : 'Reset password'}</button><button type="button" className="ctrl" onClick={() => setReset(null)}>Cancel</button></div>
          </div>
        )}
        {reset?.recoveryCode && (
          <div className="grid gap-3 text-sm">
            <p className="text-ink-soft">Shown once. Pass these on privately.</p>
            <dl className="grid gap-2 rounded-2xl bg-cream-100 p-4 font-mono text-[15px]" data-testid="reset-details">
              <div className="flex justify-between gap-3"><dt className="font-sans text-ink-mute">Username</dt><dd className="font-semibold">{reset.user.username}</dd></div>
              <div className="flex justify-between gap-3"><dt className="font-sans text-ink-mute">Password</dt><dd className="font-semibold">{reset.password ?? reset.custom}</dd></div>
              <div className="flex justify-between gap-3"><dt className="font-sans text-ink-mute">Recovery code</dt><dd className="font-semibold">{reset.recoveryCode}</dd></div>
            </dl>
            <div className="flex gap-2"><button type="button" className="btn-primary" onClick={() => navigator.clipboard?.writeText(copyText).catch(() => undefined)}><Icon name="copy" size={16} /> Copy</button><button type="button" className="ctrl" onClick={() => setReset(null)}>Done</button></div>
          </div>
        )}
      </Sheet>
      <Sheet open={!!remove} onClose={() => setRemove(null)} title={remove ? `Remove ${remove.firstName}’s account?` : ''}>
        {remove && (
          <div className="grid gap-3 text-sm">
            <p className="text-ink-soft">This permanently deletes @{remove.username}, their learning progress, lessons, homework and feedback. It cannot be undone.</p>
            <div className="flex gap-2"><button type="button" className="btn-primary !bg-terracotta" disabled={busy === 'remove'} onClick={() => act('remove', async () => { await adminApi.remove(token!, remove.id); setRemove(null); })} data-testid="confirm-remove">{busy === 'remove' ? 'Removing…' : 'Remove account'}</button><button type="button" className="ctrl" onClick={() => setRemove(null)}>Cancel</button></div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="card p-4"><p className="eyebrow !text-[10px]">{label}</p><p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p><p className="text-xs text-ink-mute">{sub}</p></div>;
}
