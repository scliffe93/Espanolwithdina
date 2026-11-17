import { useState } from 'react';
import { useAccount } from '../lib/account';
import { reportApi } from '../lib/cloud';
import { buildId, buildReport, logIssue } from '../lib/diagnostics';
import { Icon } from './Icon';
import { Sheet } from './ui';

/**
 * A small button on every screen for telling the team that something is wrong, in the person's own words.
 * The note goes to the administrator's Problems list together with the page they were on and their device.
 * Someone who is not logged in cannot be sent anywhere, so they are given the note to copy or share instead.
 */
export function ReportIssue() {
  const { session } = useAccount();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'sent' | 'copied' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const where = () => window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'home';
  const close = () => { setOpen(false); setDone(null); setError(null); };

  const send = async () => {
    const note = text.trim();
    if (!note) return;
    setBusy(true); setError(null);
    logIssue('note', note.slice(0, 300), note.length > 300 ? note : undefined); // kept on this device too, in Troubleshooting
    try {
      if (session?.token) {
        await reportApi.send(session.token, { kind: 'note', message: note.slice(0, 300), where: where(), detail: note.length > 300 ? note.slice(0, 1500) : `Screen ${window.innerWidth}×${window.innerHeight}`, device: navigator.userAgent, build: buildId() });
        setDone('sent');
      } else {
        await navigator.clipboard.writeText(`${note}\n\n${buildReport()}`);
        setDone('copied');
      }
      setText('');
    } catch { setError(session?.token ? 'It could not be sent just now. Check your connection and try again.' : 'It could not be copied. Select the text and copy it yourself.'); }
    setBusy(false);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Report a problem" title="Report a problem" data-testid="report-open"
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-40 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-ink-soft shadow-soft ring-1 ring-ink/10 backdrop-blur transition hover:text-ink hover:ring-ink/30 lg:bottom-4 lg:right-4 print:hidden">
        <Icon name="info" size={15} /> <span className="hidden sm:inline">Report a problem</span>
      </button>
      <Sheet open={open} onClose={close} title="Report a problem">
        {done ? (
          <div data-testid="report-done">
            <p className="rounded-2xl bg-olive-50 p-4 font-semibold">{done === 'sent' ? 'Thank you. It has been sent.' : 'Copied. Paste it into a message to your teacher.'}</p>
            <p className="mt-2 text-sm text-ink-soft">{done === 'sent' ? 'The team can see what you wrote, the page you were on and your kind of device. You can carry on.' : 'You are not logged in, so the app cannot send it for you.'}</p>
            <button type="button" className="btn-primary mt-4" onClick={close}>Done</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <label className="font-medium" htmlFor="report-text">What went wrong?</label>
            <textarea id="report-text" className="input mt-2 min-h-[130px] w-full" value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} autoFocus placeholder="For example: I pressed Continue on question 10 and the screen stayed empty." data-testid="report-text" />
            <p className="mt-2 text-xs text-ink-mute">Sent with it: the page you are on (<b>{open ? where() : ''}</b>) and your kind of device. Nothing else, and no passwords.</p>
            {error && <p role="alert" className="mt-2 text-sm text-terracotta-dark">{error}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="submit" className="btn-primary" disabled={busy || !text.trim()} data-testid="report-send">{busy ? 'Sending…' : session?.token ? 'Send' : 'Copy to send to my teacher'}</button>
              <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
            </div>
            {!session?.token && <p className="mt-2 text-xs text-ink-mute">You are not logged in, so this is copied for you to paste into a message. Log in and it is sent for you.</p>}
          </form>
        )}
      </Sheet>
    </>
  );
}
