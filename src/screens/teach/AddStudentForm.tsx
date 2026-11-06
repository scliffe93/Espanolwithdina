import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/ui';
import { passwordProblem } from '../../lib/cloud';
import { usePlatform } from '../../lib/platform/context';
import { Field, useAction } from './shared';

/** The teacher creates a student's account; the login details are shown once so she can pass them on. */
export function AddStudentForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { backend } = usePlatform();
  const { run, busy, error, setError } = useAction();
  const [firstName, setFirstName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [made, setMade] = useState<{ firstName: string; username: string; password?: string; recoveryCode: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => { setMade(null); setFirstName(''); setUsername(''); setPassword(''); setError(null); setCopied(false); onClose(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backend?.addStudent) return;
    const u = username.trim();
    if (!/^[A-Za-z0-9._-]{3,24}$/.test(u)) { setError('Usernames are 3–24 characters: letters, numbers, dots, dashes or underscores.'); return; }
    if (!firstName.trim()) { setError('Add the student’s first name.'); return; }
    const pwErr = password ? passwordProblem(password, u) : null;
    if (pwErr) { setError(pwErr); return; }
    const r = await run(() => backend.addStudent!({ username: u, firstName: firstName.trim(), password: password || undefined }));
    if (r) setMade({ firstName: r.user.firstName, username: r.user.username, password: r.password ?? password, recoveryCode: r.recoveryCode });
  };

  const details = made ? `Learning with Dina — login for ${made.firstName}\nUsername: ${made.username}\nPassword: ${made.password}\nRecovery code (keep safe): ${made.recoveryCode}\nApp: ${location.origin}${location.pathname}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(details); setCopied(true); } catch { setCopied(false); }
  };

  return (
    <Sheet open={open} onClose={close} title={made ? `${made.firstName}’s account is ready` : 'Add a student'}>
      {made ? (
        <div className="grid gap-3 text-sm">
          <p className="text-ink-soft">Pass these on privately (in person or by message). They are shown only once — the password can be changed in the student’s settings and the recovery code lets them reset it if they forget.</p>
          <dl className="grid gap-2 rounded-2xl bg-cream-100 p-4 font-mono text-[15px]" data-testid="new-student-details">
            <div className="flex justify-between gap-3"><dt className="font-sans text-ink-mute">Username</dt><dd className="font-semibold">{made.username}</dd></div>
            <div className="flex justify-between gap-3"><dt className="font-sans text-ink-mute">Password</dt><dd className="font-semibold">{made.password}</dd></div>
            <div className="flex justify-between gap-3"><dt className="font-sans text-ink-mute">Recovery code</dt><dd className="font-semibold">{made.recoveryCode}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={copy}><Icon name="copy" size={16} /> {copied ? 'Copied' : 'Copy login details'}</button>
            <button type="button" className="ctrl" onClick={close}>Done</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-3">
          <p className="text-sm text-ink-soft">Creates the student’s own account on the app. They log in with these details on any device; you will see their progress, lessons and homework here.</p>
          <Field id="ns-first" label="First name"><input id="ns-first" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={40} autoComplete="off" required /></Field>
          <Field id="ns-user" label="Username" hint="3–24 characters: letters, numbers, dots, dashes or underscores."><input id="ns-user" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" autoCapitalize="none" required /></Field>
          <Field id="ns-pass" label="Password (optional)" hint="Leave empty to generate a simple temporary password the student can change."><input id="ns-pass" className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" placeholder="Generate one for me" /></Field>
          {error && <p role="alert" className="rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={busy} data-testid="ns-submit"><Icon name="user" size={16} /> {busy ? 'Creating…' : 'Create account'}</button>
            <button type="button" className="ctrl" onClick={close}>Cancel</button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
