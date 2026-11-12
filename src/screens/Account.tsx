import { NotificationsCard } from '../components/NotificationsCard';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { DinaArt } from '../components/Dina';
import { Icon } from '../components/Icon';
import { PageHeader, Segmented, Sheet } from '../components/ui';
import { statusLabel, useAccount } from '../lib/account';
import { ApiError, passwordProblem } from '../lib/cloud';
import { navigate } from '../lib/router';
import { useStore } from '../lib/store';

function Field({ id, label, children, hint }: { id: string; label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1 text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span id={`${id}-hint`} className="text-xs font-normal text-ink-mute">{hint}</span>}
    </div>
  );
}

function PasswordInput({ value, onChange, autoComplete, id, hinted }: { value: string; onChange: (v: string) => void; autoComplete: string; id: string; hinted?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input id={id} aria-describedby={hinted ? `${id}-hint` : undefined} className="input pr-12" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required minLength={8} maxLength={128} />
      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-mute hover:text-ink" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        <Icon name="eye" size={18} />
      </button>
    </span>
  );
}

function ErrorText({ error }: { error: string | null }) {
  return <AnimatePresence>{error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{error}</motion.p>}</AnimatePresence>;
}

export function RecoveryCodeCard({ code, onDone, title = 'Your recovery code' }: { code: string; onDone: () => void; title?: string }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const download = () => {
    const blob = new Blob([`Learning with Dina — recovery code\n\n${code}\n\nKeep this somewhere safe (a password manager or on paper). With your username, it lets you reset your password if you forget it. Each code works once; you’ll get a new one after using it.\n`], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'learning-with-dina-recovery-code.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  };
  return (
    <div className="card p-6">
      <p className="eyebrow">Important — save this now</p>
      <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-ink-soft">There’s no email on your account, so this code is the only way to reset a forgotten password. Save it in a password manager or write it down. We can’t show it again.</p>
      <p className="mt-4 select-all whitespace-nowrap rounded-2xl bg-ink px-3 py-4 text-center font-mono text-lg font-bold tracking-[0.08em] text-cream sm:text-2xl sm:tracking-[0.18em]" data-testid="recovery-code">{code}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="ctrl" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); } catch { /* clipboard blocked */ } }}><Icon name="copy" size={16} /> {copied ? 'Copied' : 'Copy'}</button>
        <button className="ctrl" onClick={download}><Icon name="download" size={16} /> Download as a file</button>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-5 w-5 accent-terracotta" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I’ve saved my recovery code somewhere safe</label>
      <button className="btn-primary mt-4" disabled={!saved} onClick={onDone}>Continue <Icon name="arrowRight" size={18} /></button>
    </div>
  );
}

function SignedOut() {
  const acc = useAccount();
  const { state } = useStore();
  const presetUser = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('user') ?? '';
  const presetMode = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('mode');
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>(presetUser || presetMode === 'login' ? 'login' : presetMode === 'register' ? 'register' : state.onboardingDone || acc.guestHasProgress ? 'register' : 'login');
  const [username, setUsername] = useState(presetUser);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstName, setFirstName] = useState(state.profile?.name ?? '');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [bring, setBring] = useState(true);
  const [bringOnLogin, setBringOnLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode !== 'login') {
      const p = passwordProblem(password, username);
      if (p) return setError(p);
      if (password !== confirm) return setError('The two passwords don’t match.');
    }
    setBusy(true);
    try {
      if (mode === 'register') await acc.register({ username, password, firstName, remember, bringGuest: bring && acc.guestHasProgress });
      else if (mode === 'login') await acc.login({ username, password, remember, bringGuest: bringOnLogin && acc.guestHasProgress });
      else await acc.recover({ username, recoveryCode, newPassword: password, remember });
    } catch (err) {
      setError((err as ApiError).message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <form className="card grid gap-4 p-6" onSubmit={submit} noValidate>
        <Segmented label="Account" value={mode} onChange={(m) => { setMode(m); setError(null); }} options={[{ value: 'login', label: 'Log in' }, { value: 'register', label: 'Create account' }, { value: 'recover', label: 'Forgot password' }]} />
        {mode === 'register' && <p className="text-sm text-ink-soft">Free, and no email needed. Your progress saves automatically and follows you to any device.</p>}
        {mode === 'recover' && <p className="text-sm text-ink-soft">Enter your username and the recovery code you saved when you created your account.</p>}

        <Field id="acc-username" label="Username" hint={mode === 'register' ? '3–24 letters, numbers, dots, dashes or underscores. Not case-sensitive.' : undefined}>
          <input id="acc-username" aria-describedby={mode === 'register' ? 'acc-username-hint' : undefined} className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
        </Field>
        {mode === 'register' && (
          <Field id="acc-first" label="Your first name"><input id="acc-first" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" maxLength={40} required /></Field>
        )}
        {mode === 'recover' && (
          <Field id="acc-code" label="Recovery code" hint="Like 7KQ2-M9XD-4RTP-H3VB. Dashes and capitals don’t matter.">
            <input id="acc-code" aria-describedby="acc-code-hint" className="input font-mono tracking-wider" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} required />
          </Field>
        )}
        <Field id="acc-password" label={mode === 'recover' ? 'New password' : 'Password'} hint={mode !== 'login' ? 'At least 8 characters — a short phrase is easiest to remember (e.g. “mi café con Dina”).' : undefined}>
          <PasswordInput id="acc-password" hinted={mode !== 'login'} value={password} onChange={setPassword} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </Field>
        {mode !== 'login' && <Field id="acc-confirm" label="Repeat password"><PasswordInput id="acc-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" /></Field>}

        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-terracotta" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span><b>Remember me</b> on this device for 30 days.<span className="block text-xs text-ink-mute">Untick on shared or public computers.</span></span></label>
        {acc.guestHasProgress && mode === 'register' && (
          <label className="flex items-start gap-2 rounded-2xl bg-olive-50 p-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-terracotta" checked={bring} onChange={(e) => setBring(e.target.checked)} /><span><b>Bring my progress from this device into my new account.</b><span className="block text-xs text-ink-mute">Nothing is deleted — this device keeps its own copy too.</span></span></label>
        )}
        {acc.guestHasProgress && mode === 'login' && (
          <label className="flex items-start gap-2 rounded-2xl bg-cream-100 p-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-terracotta" checked={bringOnLogin} onChange={(e) => setBringOnLogin(e.target.checked)} /><span><b>Also add this device’s progress to my account.</b><span className="block text-xs text-ink-mute">Only tick this if the progress on this device is yours. It will be merged — nothing is overwritten.</span></span></label>
        )}
        <ErrorText error={error} />
        <button className="btn-primary" disabled={busy || !username || !password}>{busy ? 'One moment…' : mode === 'login' ? 'Log in' : mode === 'register' ? 'Create my account' : 'Reset password'}</button>
      </form>
      <aside className="card flex flex-col items-center gap-3 p-6 text-center">
        <DinaArt size={110} expression="beam" />
        <p className="font-display text-xl font-semibold">Your Spanish life, on every device</p>
        <ul className="grid gap-1.5 text-left text-sm text-ink-soft">
          <li>✓ Progress saves automatically — no save button</li>
          <li>✓ Continue on your phone, tablet or laptop</li>
          <li>✓ Works offline; syncs when you’re back online</li>
          <li>✓ Passwords are never stored in readable form</li>
        </ul>
      </aside>
    </div>
  );
}

function SignedIn() {
  const acc = useAccount();
  const s = acc.session!;
  const label = statusLabel(acc.status, acc.lastSyncedAt);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [codePw, setCodePw] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [unsynced, setUnsynced] = useState(false);
  const [del, setDel] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delText, setDelText] = useState('');
  const [delErr, setDelErr] = useState<string | null>(null);

  const doLogout = async (force = false) => {
    const r = await acc.logout({ force });
    if (r === 'unsynced') setUnsynced(true);
    else navigate('account');
  };

  if (code) return <RecoveryCodeCard code={code} title="Your new recovery code" onDone={() => setCode(null)} />;

  return (
    <div className="grid gap-4">
      <section className="card flex flex-wrap items-center gap-4 p-5">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-terracotta font-display text-2xl font-semibold text-white">{s.user.firstName.slice(0, 1).toUpperCase()}</span>
        <div className="flex-1">
          <p className="font-display text-2xl font-semibold">{s.user.firstName}</p>
          <p className="text-sm text-ink-mute">@{s.user.username} · {s.remember ? 'remembered on this device' : 'this session only'}</p>
        </div>
        <div className="text-right">
          <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${label.tone === 'ok' ? 'bg-olive-50 text-olive' : label.tone === 'warn' ? 'bg-terracotta-50 text-terracotta-dark' : 'bg-cream-100 text-ink-soft'}`} data-testid="sync-status">
            <Icon name={label.tone === 'ok' ? 'check' : label.tone === 'warn' ? 'info' : 'refresh'} size={15} /> {label.text}
          </p>
          <button className="ctrl mt-2" onClick={() => acc.syncNow()}><Icon name="refresh" size={15} /> Sync now</button>
        </div>
        {acc.message && <p className="w-full rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{acc.message}</p>}
        <p className="w-full text-xs text-ink-mute">Everything you learn syncs automatically: level and assessment, story progress in every city, vocabulary, verbs and spaced-repetition schedules, mistakes, study time, achievements, preferences and teacher details. Voice recordings stay on the device that made them.</p>
      </section>

      <section className="card p-5" data-testid="account-notifications">
        <h3 className="mb-2 text-lg font-semibold">Notifications</h3>
        <NotificationsCard />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <form className="card grid gap-3 p-5" onSubmit={async (e) => {
          e.preventDefault(); setPwErr(null); setPwMsg(null);
          const p = passwordProblem(next, s.user.username); if (p) return setPwErr(p);
          try { await acc.changePassword(cur, next); setPwMsg('Password changed. Other devices will need to log in again.'); setCur(''); setNext(''); } catch (err) { setPwErr((err as ApiError).message); }
        }}>
          <h3 className="text-lg font-semibold">Change password</h3>
          <Field id="cp-current" label="Current password"><PasswordInput id="cp-current" value={cur} onChange={setCur} autoComplete="current-password" /></Field>
          <Field id="cp-new" label="New password"><PasswordInput id="cp-new" value={next} onChange={setNext} autoComplete="new-password" /></Field>
          <ErrorText error={pwErr} />
          {pwMsg && <p className="rounded-xl bg-olive-50 px-3 py-2 text-sm text-olive" role="status">{pwMsg}</p>}
          <button className="btn-dark w-fit" disabled={!cur || !next}>Change password</button>
        </form>
        <form className="card grid gap-3 p-5" onSubmit={async (e) => {
          e.preventDefault(); setCodeErr(null);
          try { setCode(await acc.newRecoveryCode(codePw)); setCodePw(''); } catch (err) { setCodeErr((err as ApiError).message); }
        }}>
          <h3 className="text-lg font-semibold">New recovery code</h3>
          <p className="text-sm text-ink-soft">Lost your recovery code? Make a new one — the old one stops working.</p>
          <Field id="rc-password" label="Password"><PasswordInput id="rc-password" value={codePw} onChange={setCodePw} autoComplete="current-password" /></Field>
          <ErrorText error={codeErr} />
          <button className="btn-dark w-fit" disabled={!codePw}>Generate new code</button>
        </form>
      </div>

      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h3 className="text-lg font-semibold">Log out</h3>
          <p className="text-sm text-ink-soft">{s.remember ? 'Your progress stays saved in your account and on this device.' : 'Your progress stays in your account; this device’s copy is removed after it’s synced.'}</p>
        </div>
        <button className="btn-ghost" onClick={() => doLogout()}><Icon name="arrowLeft" size={18} /> Log out</button>
      </section>

      <section className="card p-5">
        <h3 className="text-lg font-semibold">Delete my online account</h3>
        <p className="mt-1 text-sm text-ink-soft">Permanently deletes your account and every bit of progress stored online. A copy stays on this device unless you also use “Delete everything” in My Spanish DNA.</p>
        <button className="btn mt-3 bg-terracotta-50 text-terracotta-dark ring-1 ring-terracotta/30" onClick={() => setDel(true)}><Icon name="trash" size={18} /> Delete online account</button>
      </section>

      <Sheet open={unsynced} onClose={() => setUnsynced(false)} title="Changes not yet synced">
        <p className="text-ink-soft">Some progress from this device hasn’t reached your account yet (you may be offline). If you log out now it stays safely on this device and will sync next time you log in here.</p>
        <div className="mt-4 flex gap-2"><button className="btn-primary" onClick={() => { setUnsynced(false); acc.syncNow(); }}>Try syncing again</button><button className="btn-ghost" onClick={() => { setUnsynced(false); doLogout(true); }}>Log out anyway</button></div>
      </Sheet>
      <Sheet open={del} onClose={() => setDel(false)} title="Delete your online account?">
        <p className="text-ink-soft">This can’t be undone. Your username becomes available to others.</p>
        <div className="mt-3 grid gap-3">
          <Field id="del-password" label="Password"><PasswordInput id="del-password" value={delPw} onChange={setDelPw} autoComplete="current-password" /></Field>
          <Field id="del-confirm" label="Type BORRAR to confirm"><input id="del-confirm" className="input" value={delText} onChange={(e) => setDelText(e.target.value)} /></Field>
          <ErrorText error={delErr} />
          <button className="btn bg-terracotta-dark text-white" disabled={!delPw || delText.trim().toUpperCase() !== 'BORRAR'} onClick={async () => {
            setDelErr(null);
            try { await acc.deleteAccount(delPw); setDel(false); navigate('account'); } catch (err) { setDelErr((err as ApiError).message); }
          }}>Delete my account</button>
        </div>
      </Sheet>
    </div>
  );
}

export function Account() {
  const acc = useAccount();
  const { state } = useStore();
  return (
    <div className={state.onboardingDone ? '' : 'min-h-[100dvh] bg-cream-warm px-5 py-8'}>
      <div className="mx-auto max-w-4xl">
        {!state.onboardingDone && <button className="ctrl mb-4" onClick={() => navigate('welcome')}><Icon name="arrowLeft" size={16} /> Back</button>}
        <PageHeader eyebrow="Mi cuenta" title={acc.session ? 'Your account' : 'Save your progress everywhere'} subtitle={acc.session ? undefined : 'Create a free account with just a username and password — then log in on any device and carry on exactly where you left off.'} />
        {!acc.configured ? (
          <div className="card p-6">
            <h2 className="text-xl font-semibold">Online accounts aren’t switched on yet</h2>
            <p className="mt-2 text-ink-soft">This copy of Learning with Dina hasn’t been connected to its account server, so progress is saved on this device only. Everything still works. To move progress to another device in the meantime, use <b>Export my data</b> and <b>Import backup</b> in <button className="underline" onClick={() => navigate('settings')}>My Spanish DNA</button>.</p>
          </div>
        ) : acc.recoveryCode ? (
          <RecoveryCodeCard code={acc.recoveryCode} title={acc.session ? 'Save your recovery code' : 'Your recovery code'} onDone={acc.acknowledgeRecoveryCode} />
        ) : acc.session ? <SignedIn /> : <SignedOut />}
      </div>
    </div>
  );
}
