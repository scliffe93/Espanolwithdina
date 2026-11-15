import { useEffect, useState } from 'react';
import { buildReport, clearIssues, getIssues, onIssuesChange, refreshApp, type Issue } from '../lib/diagnostics';
import { hasSpanishVoice, spanishVoices, speak, ttsSupported } from '../lib/speech';
import { useAccount } from '../lib/account';
import { useStore } from '../lib/store';
import { Icon } from './Icon';

const KIND: Record<Issue['kind'], string> = { crash: 'A page stopped', error: 'Something failed', voice: 'Voice', note: 'Note' };

/** Settings → Troubleshooting: test the voice, refresh the app, and see or share what went wrong recently. */
export function Troubleshooting() {
  const { state } = useStore();
  const { session } = useAccount();
  const region = state.profile?.region ?? 'spain';
  const [issues, setIssues] = useState(getIssues);
  const [voice, setVoice] = useState<'idle' | 'playing' | 'ok' | 'silent'>('idle');
  const [copied, setCopied] = useState(false);
  useEffect(() => onIssuesChange(() => setIssues(getIssues())), []);

  const report = () => buildReport([`Spanish voices on this device: ${ttsSupported ? spanishVoices(region).map((v) => v.name).slice(0, 6).join(', ') || 'none' : 'speech not supported'}`, `Chosen voice: ${state.settings.voiceURI ?? 'automatic'} · speed ${state.settings.speechRate}`]);
  const testVoice = async () => {
    setVoice('playing');
    const before = getIssues().length;
    await speak('Hola, soy Dina. ¿Me oyes bien?', { region, rate: state.settings.speechRate });
    setVoice(getIssues().length > before ? 'silent' : 'ok');
  };
  const copy = async () => { try { await navigator.clipboard.writeText(report()); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* blocked */ } };
  const share = async () => { try { await navigator.share({ title: 'Learning with Dina: troubleshooting report', text: report() }); } catch { /* closed */ } };

  return (
    <div className="grid gap-4" data-testid="troubleshooting">
      <div className="flex flex-wrap gap-2">
        {ttsSupported && <button className="ctrl" onClick={() => void testVoice()} disabled={voice === 'playing'} data-testid="voice-test"><Icon name="volume" size={16} /> {voice === 'playing' ? 'Playing…' : 'Test the voice'}</button>}
        <button className="ctrl" onClick={() => void refreshApp()} data-testid="refresh-app"><Icon name="refresh" size={16} /> Refresh the app</button>
      </div>
      {voice === 'ok' && <p className="text-sm text-ink-soft">Did you hear “Hola, soy Dina”? If not, check the phone is not on silent and the volume is up, then try another voice in Settings above.</p>}
      {voice === 'silent' && <p className="text-sm text-terracotta-dark">The voice did not start on this device. Turn off silent mode, check the volume, and try choosing another Spanish voice above.</p>}
      {ttsSupported && !hasSpanishVoice() && <p className="text-sm text-ink-soft">This device has no Spanish voice installed, so Spanish is read with a default voice. Adding a Spanish voice in the device settings makes it sound right.</p>}
      <p className="text-sm text-ink-mute">“Refresh the app” fetches a clean copy and keeps all your progress. Try it first if something looks stuck or out of date.</p>

      <div>
        <p className="font-medium">Recent problems</p>
        {issues.length === 0 ? <p className="mt-1 text-sm text-ink-mute" data-testid="no-issues">Nothing has gone wrong on this device.</p> : (
          <ul className="mt-2 grid gap-1.5" data-testid="issue-list">
            {issues.slice().reverse().slice(0, 8).map((i) => (
              <li key={i.at + i.message} className="rounded-xl bg-cream-100 p-3 text-sm">
                <span className="font-semibold">{KIND[i.kind]}</span> <span className="text-ink-mute">· {new Date(i.at).toLocaleString()} · on “{i.where}”</span>
                <span className="block break-words text-ink-soft">{i.message}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="ctrl" onClick={() => void copy()} data-testid="copy-report">{copied ? 'Copied' : 'Copy report'}</button>
          {typeof navigator !== 'undefined' && 'share' in navigator && <button className="ctrl" onClick={() => void share()}>Send to Dina…</button>}
          {issues.length > 0 && <button className="ctrl" onClick={clearIssues}>Clear the list</button>}
        </div>
        <p className="mt-2 text-xs text-ink-mute">{session ? 'While you are logged in, these problems are sent to the app’s administrator automatically so they can be fixed.' : 'Log in and problems are sent to the app’s administrator automatically.'} A report holds the problem, the page and your device type. It never holds your password or your answers.</p>
      </div>
    </div>
  );
}
