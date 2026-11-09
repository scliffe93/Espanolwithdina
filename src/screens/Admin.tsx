import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkline } from '../components/Charts';
import { Icon, type IconName } from '../components/Icon';
import { PageHeader, Segmented, Sheet } from '../components/ui';
import { useAccount } from '../lib/account';
import { dailySeries, errorBreakdown, todaySeconds } from '../lib/analytics';
import { adminApi, platformApi, type AdminOverview, type AdminUser, type ApiError } from '../lib/cloud';
import { fmtDateTime, relative } from '../lib/platform/time';
import type { ActivityEvent, Booking, Feedback, Homework, Person } from '../lib/platform/types';
import { navigate } from '../lib/router';
import { migrate } from '../lib/state';
import { pct, studentInsight } from './teach/insights';
import type { AppState } from '../types';

type Tab = 'overview' | 'activity' | 'accounts';
const TABS: { value: Tab; label: string }[] = [{ value: 'overview', label: 'Overview' }, { value: 'activity', label: 'Activity' }, { value: 'accounts', label: 'Accounts' }];
const ACTIVITY_ICON: Record<ActivityEvent['type'], IconName> = { chapter: 'map', practice: 'dumbbell', game: 'sparkle', review: 'brain', homework: 'book', lesson: 'calendar', login: 'user' };
const TYPE_LABEL: Record<ActivityEvent['type'], string> = { chapter: 'Chapters', practice: 'Practice', game: 'Games', review: 'Reviews', homework: 'Homework', lesson: 'Lessons', login: 'Logins' };

interface Everything { users: AdminUser[]; overview: AdminOverview; activity: ActivityEvent[]; homework: Homework[]; bookings: Booking[]; feedback: Feedback[]; progress: Record<string, AppState | null> }

// Administration: every account on the platform, roles, password resets,
// removals and usage. Admin role only (set by ADMIN_USERNAMES on the server).

const ROLE_LABEL: Record<AdminUser['role'], string> = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' };

export function Admin() {
  const account = useAccount();
  const token = account.session?.token;
  const me = account.session?.user;
  const [data, setData] = useState<Everything | null>(null);
  const overview = data?.overview ?? null;
  const users = data?.users ?? null;
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reset, setReset] = useState<{ user: AdminUser; password?: string; recoveryCode?: string; custom: string } | null>(null);
  const [remove, setRemove] = useState<AdminUser | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [o, u, act, hw, bk, fb] = await Promise.all([adminApi.overview(token), adminApi.users(token), platformApi.records<ActivityEvent>(token, 'activity'), platformApi.records<Homework>(token, 'homework'), platformApi.records<Booking>(token, 'booking'), platformApi.records<Feedback>(token, 'feedback')]);
      const students = u.users.filter((x) => x.role === 'student');
      const states = await Promise.all(students.map((st) => platformApi.progress(token, st.id).then((r) => (r.data ? migrate(r.data as AppState) : null)).catch(() => null)));
      setData({ users: u.users, overview: o, activity: act.records, homework: hw.records, bookings: bk.records, feedback: fb.records, progress: Object.fromEntries(students.map((st, i) => [st.id, states[i]])) });
      setError(null);
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
      <PageHeader eyebrow="Administración" title="Admin" subtitle="The whole platform at a glance: everyone’s activity, the teacher’s work, every account. The teacher dashboards are in the menu too." right={<button type="button" className="ctrl" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>} />
      <div className="mb-4 overflow-x-auto scrollbar-none"><Segmented label="Admin section" value={tab} onChange={setTab} options={TABS} /></div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{error}</p>}
      {!data && !error && <p className="text-sm text-ink-mute">Loading everything…</p>}
      {data && tab === 'overview' && <OverviewTab data={data} />}
      {data && tab === 'activity' && <ActivityTab data={data} />}
      {tab === 'accounts' && overview && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="admin-overview">
          <Tile label="Accounts" value={String(Object.values(overview.users).reduce((a, b) => a + b, 0))} sub={`${overview.users.student ?? 0} students · ${overview.users.teacher ?? 0} teacher${(overview.users.teacher ?? 0) === 1 ? '' : 's'} · ${overview.users.admin ?? 0} admin`} />
          <Tile label="Active" value={String(overview.activeUsers7d)} sub={`last 7 days · ${overview.activeUsers24h} in the last 24 h`} />
          <Tile label="Lessons & homework" value={`${overview.records.booking ?? 0} / ${overview.records.homework ?? 0}`} sub={`${overview.records.feedback ?? 0} feedback notes · ${overview.records.activity ?? 0} activity lines`} />
          <Tile label="Progress saves" value={String(overview.progressSaves)} sub={overview.latestProgressAt ? `latest ${relative(overview.latestProgressAt)}` : 'none yet'} />
        </div>
      )}
      {tab === 'accounts' && <section className="card p-5">
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
      </section>}

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

const nameOf = (users: AdminUser[], id: string) => users.find((u) => u.id === id)?.firstName ?? 'Someone';
const DAY_MS = 86_400_000;

/** Everyone's week, platform-wide minutes, and the teacher's own activity. */
function OverviewTab({ data }: { data: Everything }) {
  const now = Date.now();
  const students = data.users.filter((u) => u.role === 'student');
  const teachers = data.users.filter((u) => u.role === 'teacher');
  const rows = students.map((u) => {
    const person: Person = { id: u.id, username: u.username, firstName: u.firstName, role: 'student' };
    const st = data.progress[u.id];
    const i = studentInsight(person, st, data.homework.filter((h) => h.studentId === u.id), data.bookings.filter((b) => b.studentId === u.id), now);
    const lastEvent = data.activity.filter((a) => a.studentId === u.id).sort((a, b) => b.at.localeCompare(a.at))[0];
    const slip = st ? errorBreakdown(st, 14, now)[0] : undefined;
    return { u, i, st, today: st ? Math.round(todaySeconds(st, now) / 60) : 0, lastActive: lastEvent?.at ?? u.lastSeenAt, slip };
  }).sort((a, b) => (b.lastActive ?? '').localeCompare(a.lastActive ?? ''));
  // Platform minutes per day (all students), last 28 days.
  const series = students.map((u) => data.progress[u.id]).filter((s): s is AppState => !!s).map((s) => dailySeries(s, 28, now));
  const days = series.length ? series[0].map((d, k) => ({ label: d.date.slice(5), value: series.reduce((a, s) => a + s[k].minutes, 0) })) : [];
  const total28 = days.reduce((a, d) => a + d.value, 0);
  const since30 = new Date(now - 30 * DAY_MS).toISOString();
  const debriefs = data.feedback.filter((f) => f.kind === 'debrief' && f.createdAt >= since30);
  const notes = data.feedback.filter((f) => f.kind !== 'debrief' && f.createdAt >= since30);
  const assigned = data.homework.filter((h) => !h.plan?.adaptive && h.assignedAt >= since30);
  const adaptive = data.homework.filter((h) => h.plan?.adaptive && h.assignedAt >= since30);
  const reviewed = data.homework.filter((h) => h.status === 'reviewed' && h.feedback && h.feedback.at >= since30);
  const booked = data.bookings.filter((b) => b.createdAt >= since30);
  const upcoming = data.bookings.filter((b) => b.status === 'scheduled' && b.startsAt >= new Date(now).toISOString() && b.startsAt <= new Date(now + 7 * DAY_MS).toISOString());
  const lastDebrief = debriefs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const o = data.overview;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="admin-overview">
        <Tile label="Accounts" value={String(Object.values(o.users).reduce((a, b) => a + b, 0))} sub={`${o.users.student ?? 0} students · ${o.users.teacher ?? 0} teacher${(o.users.teacher ?? 0) === 1 ? '' : 's'} · ${o.users.admin ?? 0} admin`} />
        <Tile label="Active" value={String(o.activeUsers7d)} sub={`last 7 days · ${o.activeUsers24h} in the last 24 h`} />
        <Tile label="Minutes (28 days)" value={String(total28)} sub={`across ${series.length} student${series.length === 1 ? '' : 's'} with progress`} />
        <Tile label="Lessons · homework" value={`${o.records.booking ?? 0} · ${o.records.homework ?? 0}`} sub={`${o.records.feedback ?? 0} notes · ${o.records.activity ?? 0} activity lines`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="card p-5">
          <p className="eyebrow">Last 28 days</p><h2 className="font-display text-2xl font-semibold">Platform minutes per day</h2>
          {days.length ? <div className="mt-2"><Sparkline points={days} unit=" min" title="Platform-wide active minutes per day, last 28 days" /></div> : <p className="mt-2 text-sm text-ink-mute">No student progress yet.</p>}
        </section>
        <section className="card p-5" data-testid="teacher-activity">
          <p className="eyebrow">Last 30 days</p><h2 className="font-display text-2xl font-semibold">{teachers.length === 1 ? `${teachers[0].firstName}’s activity` : 'Teacher activity'}</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-ink-mute">Lesson debriefs sent</dt><dd className="font-semibold tabular-nums">{debriefs.length}</dd>
            <dt className="text-ink-mute">Homework assigned</dt><dd className="font-semibold tabular-nums">{assigned.length} <span className="font-normal text-ink-mute">+{adaptive.length} added by the app</span></dd>
            <dt className="text-ink-mute">Homework reviewed</dt><dd className="font-semibold tabular-nums">{reviewed.length}</dd>
            <dt className="text-ink-mute">Feedback notes</dt><dd className="font-semibold tabular-nums">{notes.length}</dd>
            <dt className="text-ink-mute">Lessons booked</dt><dd className="font-semibold tabular-nums">{booked.length}</dd>
            <dt className="text-ink-mute">Lessons in the next 7 days</dt><dd className="font-semibold tabular-nums">{upcoming.length}</dd>
          </dl>
          <p className="mt-2 text-xs text-ink-mute">{lastDebrief ? `Last debrief ${relative(lastDebrief.createdAt)} for ${nameOf(data.users, lastDebrief.studentId)}.` : 'No lesson debrief sent yet.'}{teachers.length ? ` ${teachers[0].firstName} last seen ${teachers[0].lastSeenAt ? relative(teachers[0].lastSeenAt) : 'never'}.` : ''}</p>
        </section>
      </div>
      <section className="card p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><p className="eyebrow">This week</p><h2 className="font-display text-2xl font-semibold">Everyone’s activity</h2></div><span className="text-xs text-ink-mute">Most recently active first</span></div>
        {rows.length === 0 ? <p className="text-sm text-ink-mute">No students yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="everyone-table">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-mute"><th className="py-1.5 font-semibold">Student</th><th className="py-1.5 font-semibold">Last active</th><th className="py-1.5 text-right font-semibold">Today</th><th className="py-1.5 text-right font-semibold">This week</th><th className="py-1.5 text-right font-semibold">Accuracy</th><th className="py-1.5 text-right font-semibold">Streak</th><th className="py-1.5 text-right font-semibold">Homework</th><th className="py-1.5 font-semibold">Next lesson</th><th className="py-1.5 font-semibold">Top slip (14 d)</th></tr></thead>
              <tbody>
                {rows.map(({ u, i, today, lastActive, slip }) => (
                  <tr key={u.id} className={`border-t border-ink/5 align-middle ${i.support.length ? 'bg-terracotta-50/60' : ''}`}>
                    <td className="py-2"><button type="button" className="font-semibold hover:underline" onClick={() => navigate(`teach/student/${u.id}`)}>{u.firstName}</button> <span className="text-ink-mute">@{u.username}</span>{i.level && <span className="ml-1 rounded-full bg-cream-200 px-1.5 py-0.5 text-[10px] font-bold">{i.level}</span>}{i.support.length > 0 && <span className="ml-1 text-[10px] font-bold uppercase text-terracotta">needs support</span>}</td>
                    <td className="py-2 text-ink-soft">{lastActive ? relative(lastActive) : 'never'}</td>
                    <td className="py-2 text-right tabular-nums">{today} min</td>
                    <td className="py-2 text-right tabular-nums">{i.weekMinutes} min <span className="text-ink-mute">· {i.weekStudyDays} d</span></td>
                    <td className="py-2 text-right tabular-nums">{pct(i.weekAccuracy)} <span className="text-ink-mute">({i.weekExercises})</span></td>
                    <td className="py-2 text-right tabular-nums">{i.streak}</td>
                    <td className="py-2 text-right tabular-nums">{i.pending.length} pending{i.overdue.length ? <span className="text-terracotta"> · {i.overdue.length} overdue</span> : ''}</td>
                    <td className="py-2 text-ink-soft">{i.nextLesson ? fmtDateTime(i.nextLesson.startsAt) : '—'}</td>
                    <td className="py-2 text-ink-soft">{slip ? `${slip.label} (${slip.count}×)` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** Everything that happened, newest first, across every person. */
function ActivityTab({ data }: { data: Everything }) {
  const [who, setWho] = useState('all');
  const [type, setType] = useState<'all' | ActivityEvent['type']>('all');
  const events = useMemo(() => {
    const list: { id: string; at: string; who: string; whoId: string; type: ActivityEvent['type']; label: string; byTeacher?: boolean }[] = data.activity.map((a) => ({ id: a.id, at: a.at, who: nameOf(data.users, a.studentId), whoId: a.studentId, type: a.type, label: a.label }));
    for (const f of data.feedback) {
      const target = nameOf(data.users, f.studentId);
      const kind = f.kind === 'correction' ? 'Correction' : f.kind === 'recommendation' ? 'Recommendation' : 'Comment';
      const body = f.body.length > 80 ? f.body.slice(0, 80) + '…' : f.body;
      const label = f.kind === 'debrief' ? 'Lesson notes and week plan sent to ' + target : kind + ' for ' + target + ': ' + body;
      list.push({ id: 'fb-' + f.id, at: f.createdAt, who: target, whoId: f.studentId, type: f.kind === 'debrief' ? 'lesson' : 'homework', label, byTeacher: true });
    }
    return list.sort((a, b) => b.at.localeCompare(a.at));
  }, [data]);
  const shown = events.filter((e) => (who === 'all' || e.whoId === who) && (type === 'all' || e.type === type)).slice(0, 200);
  const people = data.users.filter((u) => u.role !== 'admin');
  let lastDay = '';
  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><p className="eyebrow">Everything that happened</p><h2 className="font-display text-2xl font-semibold">Activity feed</h2></div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Person" className="input !w-44 !py-1.5 text-sm" value={who} onChange={(e) => setWho(e.target.value)}><option value="all">Everyone</option>{people.map((u) => <option key={u.id} value={u.id}>{u.firstName} (@{u.username})</option>)}</select>
          <select aria-label="Type" className="input !w-36 !py-1.5 text-sm" value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="all">All types</option>{(Object.keys(TYPE_LABEL) as ActivityEvent['type'][]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select>
        </div>
      </div>
      {shown.length === 0 ? <p className="text-sm text-ink-mute">Nothing recorded yet. Logins, chapters, games, practice, reviews, homework and lessons appear here as they happen.</p> : (
        <ul className="grid gap-1" data-testid="activity-feed">
          {shown.map((e) => {
            const day = e.at.slice(0, 10);
            const header = day !== lastDay; lastDay = day;
            return (
              <li key={e.id}>
                {header && <p className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-wider text-ink-mute first:mt-0">{new Date(e.at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
                <div className="flex items-start gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-cream-100">
                  <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${e.byTeacher ? 'bg-terracotta-50 text-terracotta' : 'bg-azul-50 text-azul'}`}><Icon name={ACTIVITY_ICON[e.type]} size={14} /></span>
                  <div className="min-w-0 flex-1"><p><b>{e.byTeacher ? 'Teacher' : e.who}</b> <span className="text-ink-soft">{e.label}</span></p></div>
                  <span className="shrink-0 text-xs tabular-nums text-ink-mute" title={fmtDateTime(e.at)}>{new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-mute">Showing up to 200 most recent items. Students’ learning events (chapters, games, practice, reviews) are recorded when they are signed in.</p>
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="card p-4"><p className="eyebrow !text-[10px]">{label}</p><p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p><p className="text-xs text-ink-mute">{sub}</p></div>;
}
