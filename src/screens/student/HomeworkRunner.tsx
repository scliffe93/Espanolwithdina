import { motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DinaArt } from '../../components/Dina';
import { Icon } from '../../components/Icon';
import { Bar, Empty } from '../../components/ui';
import { playUrl, useRecorder } from '../../hooks/useRecorder';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { describeActivity, homeworkRoute } from '../../lib/platform/homework';
import { fmtDateTime, relative } from '../../lib/platform/time';
import { HOMEWORK_KIND_LABEL, type Homework } from '../../lib/platform/types';
import { navigate } from '../../lib/router';
import { addSpeakingAttempt } from '../../lib/state';
import { mediaEnd, mediaStart, useStore } from '../../lib/store';
import { DemoChip, ErrorCard, HomeworkStatus, Loading } from './shared';

// ───────────────────────────────────────────────────────────────
// Homework runner — performs written and speaking homework in place.
// Other kinds launch the real activity (verb gym, chapter, game, review)
// with ?hw=<id>, which submits the result when the activity finishes.
// Drafts live in localStorage on this device; recordings in IndexedDB.
// ───────────────────────────────────────────────────────────────

interface Draft { text: string; seconds?: number; savedAt: number }
const draftKey = (id: string) => `lwd-hw-draft:${id}`;
function loadDraft(id: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function saveDraft(id: string, d: Omit<Draft, 'savedAt'>): number {
  const savedAt = Date.now();
  try { localStorage.setItem(draftKey(id), JSON.stringify({ ...d, savedAt })); } catch { /* storage blocked: the draft only lives in memory */ }
  return savedAt;
}
function clearDraft(id: string) {
  try { localStorage.removeItem(draftKey(id)); } catch { /* ignore */ }
}

export const wordCount = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const ACCENTS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'];

/** Toolbar that inserts Spanish characters at the caret of a textarea. */
function AccentBar({ target, value, onChange, disabled }: { target: React.RefObject<HTMLTextAreaElement>; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const insert = (ch: string) => {
    const el = target.current;
    const s = el?.selectionStart ?? value.length;
    const e = el?.selectionEnd ?? s;
    onChange(value.slice(0, s) + ch + value.slice(e));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(s + ch.length, s + ch.length);
    });
  };
  return (
    <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Insert Spanish characters">
      {ACCENTS.map((c) => <button key={c} type="button" lang="es" className="ctrl !px-3 font-semibold" onClick={() => insert(c)} aria-label={`Insert ${c}`} disabled={disabled}>{c}</button>)}
    </div>
  );
}

function Frame({ h, now, readOnly, children }: { h: Homework; now: number; readOnly: boolean; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl" data-testid="homework-runner">
      <button className="ctrl mb-4" onClick={() => navigate(readOnly ? 'teach/homework' : 'student/homework')}><Icon name="arrowLeft" size={15} /> {readOnly ? 'Homework overview' : 'My homework'}</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{HOMEWORK_KIND_LABEL[h.activity.kind]}</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight text-balance sm:text-[36px]">{h.activity.title}</h1>
          <p className="mt-1 text-ink-soft">{describeActivity(h.activity)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><DemoChip /><HomeworkStatus h={h} now={now} /></div>
      </div>
      <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-mute"><Icon name="clock" size={14} /> Due {relative(h.dueAt, now)} · {fmtDateTime(h.dueAt)}</p>
      {readOnly && <p className="mt-3 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink-soft">You’re viewing this as the teacher. Only the student can submit it.</p>}
      {children}
    </div>
  );
}

function PromptCard({ h }: { h: Homework }) {
  return (
    <section className="card mt-4 flex gap-4 p-5" aria-label="The task">
      <div className="hidden shrink-0 sm:block" aria-hidden><DinaArt size={72} expression="smile" /></div>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">Dina asks</p>
        {h.activity.prompt && <p lang="es" className="mt-1 font-display text-xl font-semibold leading-snug sm:text-2xl">{h.activity.prompt}</p>}
        {h.instructions.trim() ? <p className="mt-2 text-sm text-ink-soft">{h.instructions}</p> : !h.activity.prompt && <p className="mt-1 text-sm text-ink-soft">No extra instructions — just do the activity below.</p>}
      </div>
    </section>
  );
}

function Previous({ h, now }: { h: Homework; now: number }) {
  const r = h.result;
  if (!r) return null;
  return (
    <section className="card mt-4 p-5" aria-label="Your previous submission">
      <p className="eyebrow">{h.status === 'reviewed' ? 'Reviewed by Dina' : 'Already submitted'} · {relative(r.completedAt, now)}</p>
      {r.summary && <p className="mt-1 text-sm font-medium">{r.summary}</p>}
      {r.text && <blockquote lang="es" className="mt-2 whitespace-pre-wrap rounded-2xl bg-cream-100 p-3 text-sm leading-relaxed">{r.text}</blockquote>}
      {h.feedback && (
        <div className="mt-3 rounded-2xl bg-olive-50 p-3 text-sm">
          <p className="eyebrow !text-olive">Dina’s feedback · {relative(h.feedback.at, now)}</p>
          <p className="mt-1 leading-relaxed">{h.feedback.body}</p>
        </div>
      )}
      {h.status !== 'reviewed' && <p className="mt-2 text-xs text-ink-mute">Submitting again replaces this answer.</p>}
    </section>
  );
}

function Submitted({ h, summary }: { h: Homework; summary: string }) {
  const { backend } = usePlatform();
  return (
    <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="card mt-4 flex flex-col items-center gap-3 p-8 text-center" role="status" data-testid="hw-submitted">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-olive text-white" aria-hidden><Icon name="check" size={28} /></span>
      <h2 className="font-display text-2xl font-semibold">¡Muy bien! Homework submitted</h2>
      <p className="max-w-md text-ink-soft">{summary}. {backend?.kind === 'demo' ? 'It’s saved on this device — switch to Dina in the Demo menu to see it on her dashboard.' : 'Dina will see it on her dashboard and can leave feedback.'}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button className="btn-primary" onClick={() => navigate(`student/homework?done=${encodeURIComponent(h.id)}`)} data-testid="hw-back">Back to my homework</button>
        <button className="btn-ghost" onClick={() => navigate('student')}>My lessons</button>
      </div>
    </motion.section>
  );
}

function SubmitError({ error }: { error: string | null }) {
  return error ? <p role="alert" className="mt-3 rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{error}</p> : null;
}

// ── Written ─────────────────────────────────────────────────────

function WrittenRunner({ h, now, readOnly }: { h: Homework; now: number; readOnly: boolean }) {
  const { backend, bump } = usePlatform();
  const [text, setText] = useState(() => loadDraft(h.id)?.text ?? h.result?.text ?? '');
  const [savedAt, setSavedAt] = useState<number | null>(() => loadDraft(h.id)?.savedAt ?? null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const words = wordCount(text);
  const target = h.activity.minWords ?? 0;

  const save = () => {
    setSavedAt(saveDraft(h.id, { text }));
    setDirty(false);
  };
  // Autosave a little after typing stops, so nothing is lost on a reload.
  useEffect(() => {
    if (!dirty || readOnly) return;
    const t = window.setTimeout(save, 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, dirty]);

  const submit = async () => {
    if (!backend || !text.trim()) return;
    setBusy(true);
    setError(null);
    const summary = `${words} word${words === 1 ? '' : 's'}`;
    try {
      await backend.submitHomework(h.id, { completedAt: new Date().toISOString(), text: text.trim(), summary });
      clearDraft(h.id);
      bump();
      setDone(summary);
    } catch (e) {
      setError((e as Error).message || 'Couldn’t submit. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) return <Submitted h={h} summary={done} />;
  return (
    <>
      <PromptCard h={h} />
      <Previous h={h} now={now} />
      <section className="card mt-4 p-5" aria-label="Your answer">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="hw-text" className="font-semibold">Your answer, in Spanish</label>
          <span className="text-sm tabular-nums text-ink-mute" aria-live="polite" data-testid="hw-words">{words}{target ? ` / ${target}` : ''} words</span>
        </div>
        <div className="mt-2"><AccentBar target={ref} value={text} onChange={(v) => { setText(v); setDirty(true); }} disabled={readOnly} /></div>
        <textarea id="hw-text" ref={ref} lang="es" className="input mt-3 min-h-[220px] resize-y leading-relaxed" value={text} onChange={(e) => { setText(e.target.value); setDirty(true); }} placeholder="Escribe aquí…" spellCheck disabled={readOnly} data-testid="hw-text" />
        {target > 0 && (
          <div className="mt-2">
            <Bar value={words / target} color={words >= target ? 'bg-olive' : 'bg-terracotta'} />
            <p className="mt-1 text-xs text-ink-mute">{words >= target ? `Dina’s target of ${target} words reached.` : `Dina asked for at least ${target} words — ${target - words} to go. You can still submit a shorter answer.`}</p>
          </div>
        )}
        <SubmitError error={error} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={submit} disabled={busy || readOnly || !text.trim()} data-testid="hw-submit"><Icon name="send" size={16} /> {busy ? 'Submitting…' : h.result ? 'Submit again' : 'Submit to Dina'}</button>
          <button className="btn-ghost" onClick={save} disabled={readOnly || !text.trim()}><Icon name="edit" size={16} /> Save draft</button>
          <span className="text-xs text-ink-mute" aria-live="polite">{dirty ? 'Unsaved changes' : savedAt ? `Draft saved on this device ${relative(new Date(savedAt).toISOString(), now)}` : 'Drafts are kept only on this device.'}</span>
        </div>
      </section>
    </>
  );
}

// ── Speaking ────────────────────────────────────────────────────

function SpeakingRunner({ h, now, readOnly }: { h: Homework; now: number; readOnly: boolean }) {
  const { backend, bump } = usePlatform();
  const { update } = useStore();
  const recId = `hw-${h.id}`;
  const [note, setNote] = useState(() => loadDraft(h.id)?.text ?? h.result?.text ?? '');
  const [seconds, setSeconds] = useState(() => loadDraft(h.id)?.seconds ?? 0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const rec = useRecorder(recId, { maxMs: 180_000, onSaved: () => update((s) => addSpeakingAttempt(s)) });
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // Recording counts as active learning time (like "Let me try" in the chapters).
  const mediaOn = useRef(false);
  useEffect(() => {
    const live = rec.state === 'recording' || rec.state === 'requesting';
    if (live && !mediaOn.current) { mediaStart(); mediaOn.current = true; }
    if (!live && mediaOn.current) { mediaEnd(); mediaOn.current = false; }
  }, [rec.state]);
  useEffect(() => () => { if (mediaOn.current) mediaEnd(); }, []);

  // Length of a recording made earlier (when the browser reports it).
  useEffect(() => {
    if (!rec.url || seconds) return;
    const a = new Audio(rec.url);
    a.onloadedmetadata = () => { if (Number.isFinite(a.duration) && a.duration > 0) setSeconds(Math.round(a.duration)); };
  }, [rec.url, seconds]);

  useEffect(() => {
    if (readOnly) return;
    const t = window.setTimeout(() => saveDraft(h.id, { text: note, seconds }), 800);
    return () => window.clearTimeout(t);
  }, [note, seconds, h.id, readOnly]);

  const stop = () => {
    setSeconds(Math.max(1, Math.round(rec.elapsed / 1000)));
    rec.stop();
  };
  const play = async () => {
    if (!rec.url) return;
    setPlaying(true);
    mediaStart();
    await playUrl(rec.url);
    mediaEnd();
    setPlaying(false);
  };
  const submit = async () => {
    if (!backend || !rec.url) return;
    setBusy(true);
    setError(null);
    const summary = `Recording submitted (stays on this device)${seconds ? ` · ${seconds}s` : ''}`;
    try {
      await backend.submitHomework(h.id, { completedAt: new Date().toISOString(), recordingId: recId, text: note.trim() || undefined, summary });
      clearDraft(h.id);
      bump();
      setDone(summary);
    } catch (e) {
      setError((e as Error).message || 'Couldn’t submit. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) return <Submitted h={h} summary={done} />;
  const recording = rec.state === 'recording';
  return (
    <>
      <PromptCard h={h} />
      <Previous h={h} now={now} />
      <section className="card mt-4 p-5" aria-label="Your recording">
        <h2 className="font-semibold">Your recording</h2>
        <p className="mt-1 text-sm text-ink-soft">Read the task, think for a moment, then record yourself answering in Spanish. Up to 3 minutes.</p>
        {!rec.supported ? (
          <p className="mt-3 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink-soft">Recording isn’t supported in this browser. Try Chrome, Edge or Safari, or write your answer in the note below.</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {recording ? (
              <button className="btn-primary !py-2.5" onClick={stop} data-testid="hw-stop">
                <span className="relative flex h-3 w-3" aria-hidden><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" /><span className="relative inline-flex h-3 w-3 rounded-full bg-white" /></span>
                Stop ({Math.ceil(rec.elapsed / 1000)}s)
              </button>
            ) : (
              <button className="btn-primary !py-2.5" onClick={rec.start} disabled={rec.state === 'requesting' || readOnly} data-testid="hw-record"><Icon name="mic" size={18} /> {rec.state === 'requesting' ? 'Allow the microphone…' : rec.url ? 'Record again' : 'Record'}</button>
            )}
            {recording && (
              <div className="flex h-8 items-end gap-0.5" aria-hidden>
                {Array.from({ length: 12 }).map((_, i) => <span key={i} className="w-1 rounded-full bg-terracotta" style={{ height: `${8 + rec.level * 24 * (0.5 + Math.abs(Math.sin(i + rec.elapsed / 120)) / 2)}px` }} />)}
              </div>
            )}
            {rec.url && !recording && (
              <>
                <button className="ctrl" onClick={play} disabled={playing}><Icon name="play" size={16} /> {playing ? 'Playing…' : 'Play'}</button>
                {!readOnly && <button className="ctrl" onClick={() => { rec.remove(); setSeconds(0); }}><Icon name="trash" size={16} /> Delete</button>}
                <span className="inline-flex items-center gap-1 text-sm text-olive"><Icon name="check" size={14} /> {seconds ? `${seconds}s recorded` : 'Recording ready'}</span>
              </>
            )}
          </div>
        )}
        {rec.state === 'denied' && <p className="mt-2 text-sm text-terracotta-dark" role="alert">Microphone access was blocked. Allow it in your browser’s site settings to record.</p>}
        {rec.state === 'error' && <p className="mt-2 text-sm text-terracotta-dark" role="alert">Couldn’t start recording on this device.</p>}
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-cream-100 p-3 text-xs text-ink-soft"><Icon name="info" size={14} className="mt-0.5 shrink-0" /> Your recording stays on this device — it isn’t uploaded anywhere. In the demo, Dina can listen to it only by opening the app on this same device.</p>

        <label htmlFor="hw-note" className="mt-5 block font-semibold">Add a note for Dina <span className="font-normal text-ink-mute">(optional)</span></label>
        <div className="mt-2"><AccentBar target={noteRef} value={note} onChange={setNote} disabled={readOnly} /></div>
        <textarea id="hw-note" ref={noteRef} lang="es" className="input mt-2 min-h-[90px] resize-y" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Por ejemplo: una frase que no sabía cómo decir…" disabled={readOnly} />
        <SubmitError error={error} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={submit} disabled={busy || readOnly || !rec.url || recording} data-testid="hw-submit"><Icon name="send" size={16} /> {busy ? 'Submitting…' : h.result ? 'Submit again' : 'Submit to Dina'}</button>
          {!rec.url && <span className="text-xs text-ink-mute">Record your answer first.</span>}
        </div>
      </section>
    </>
  );
}

// ── Everything else launches the real activity ──────────────────

function ActivityRunner({ h, now }: { h: Homework; now: number }) {
  return (
    <>
      <PromptCard h={h} />
      <Previous h={h} now={now} />
      <section className="card mt-4 p-5">
        <p className="text-ink-soft">This homework is done inside the app — <b className="text-ink">{describeActivity(h.activity)}</b>. When you finish, your result goes to Dina automatically and you’re brought back here.</p>
        <button className="btn-primary mt-4" onClick={() => navigate(homeworkRoute(h))} data-testid={`hw-start-${h.id}`}><Icon name="play" size={18} filled /> {h.result ? 'Do it again' : 'Start'}</button>
      </section>
    </>
  );
}

export function HomeworkRunner({ id }: { id: string }) {
  const { me } = usePlatform();
  const { data, loading, error, reload } = usePlatformQuery((b) => b.homework(), [id]);
  const now = Date.now();
  const h = data?.find((x) => x.id === id);
  const readOnly = me?.role === 'teacher';

  if (error) return <div className="mx-auto max-w-3xl"><ErrorCard error={error} retry={reload} /></div>;
  if (loading && !data) return <div className="mx-auto max-w-3xl"><Loading what="your homework" /></div>;
  if (!h) {
    return (
      <div className="mx-auto max-w-3xl">
        <Empty icon="book" title="We couldn’t find that homework" body="It may have been removed by Dina, or the link is out of date." action={<button className="btn-primary" onClick={() => navigate(readOnly ? 'teach/homework' : 'student/homework')}>{readOnly ? 'Homework overview' : 'Back to my homework'}</button>} />
      </div>
    );
  }
  const kind = h.activity.kind;
  return (
    <Frame h={h} now={now} readOnly={readOnly}>
      {kind === 'written' ? <WrittenRunner key={h.id} h={h} now={now} readOnly={readOnly} /> : kind === 'speaking' ? <SpeakingRunner key={h.id} h={h} now={now} readOnly={readOnly} /> : <ActivityRunner h={h} now={now} />}
    </Frame>
  );
}
