import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { ProgressRing, Sheet } from '../../components/ui';
import { usePlatform } from '../../lib/platform/context';
import { describeActivity } from '../../lib/platform/homework';
import { fmtDateTime, relative, utcIsoToZoned, zonedToUtcIso } from '../../lib/platform/time';
import { HOMEWORK_KIND_LABEL, type Homework, type Person } from '../../lib/platform/types';
import { useStore } from '../../lib/store';
import { ConfirmButton, ErrorText, Field, StatusChip, ZoneSelect, nameOf, toneFor, useAction } from './shared';

/** Details of one homework item: the result the student produced, Dina's feedback, deadline and deletion. */
export function HomeworkReview({ homework, people, viewZone, onClose }: { homework: Homework | null; people: Person[]; viewZone: string; onClose: () => void }) {
  const { backend } = usePlatform();
  const { notify } = useStore();
  const { run, busy, error, setError } = useAction();
  const last = useRef<Homework | null>(null);
  if (homework) last.current = homework;
  const h = homework ?? last.current;
  const [feedback, setFeedback] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [dueZone, setDueZone] = useState(viewZone);
  const [editDue, setEditDue] = useState(false);

  useEffect(() => {
    if (!homework) return;
    setFeedback(homework.feedback?.body ?? '');
    const z = utcIsoToZoned(homework.dueAt, viewZone);
    setDueDate(z.date);
    setDueTime(z.time);
    setDueZone(viewZone);
    setEditDue(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homework?.id]);

  const review = async (e: FormEvent) => {
    e.preventDefault();
    if (!backend || !h) return;
    if (!feedback.trim()) return setError('Write a few words of feedback first.');
    const saved = await run(() => backend.reviewHomework(h.id, feedback.trim()), people);
    if (saved) {
      notify('Homework reviewed', `${nameOf(people, saved.studentId)} will see your feedback on their homework page.`);
      onClose();
    }
  };

  const saveDue = async () => {
    if (!backend || !h) return;
    let dueAt = '';
    try {
      dueAt = zonedToUtcIso(dueDate, dueTime, dueZone);
    } catch {
      return setError('Choose a valid date and time.');
    }
    const saved = await run(() => backend.updateHomework(h.id, { dueAt }), people);
    if (saved) {
      notify('Deadline updated', fmtDateTime(saved.dueAt, viewZone));
      setEditDue(false);
    }
  };

  const remove = async () => {
    if (!backend || !h) return;
    const ok = await run(async () => { await backend.deleteHomework(h.id); return true; }, people);
    if (ok) {
      notify('Homework deleted', h.activity.title);
      onClose();
    }
  };

  const tone = h ? toneFor(people, h.studentId) : null;
  const r = h?.result;

  return (
    <Sheet open={!!homework} onClose={onClose} title={h?.activity.title ?? 'Homework'}>
      {h && tone && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex items-center gap-1.5 font-semibold ${tone.text}`}><span className={`h-2 w-2 rounded-full ${tone.bg}`} aria-hidden />{nameOf(people, h.studentId)}</span>
            <StatusChip status={h.status} />
            <span className="text-ink-mute">{HOMEWORK_KIND_LABEL[h.activity.kind]}</span>
          </div>
          <div className="rounded-2xl bg-cream-100 p-4 text-sm">
            <p className="font-semibold">{describeActivity(h.activity)}</p>
            {h.activity.prompt && <p className="mt-1 italic text-ink-soft">“{h.activity.prompt}”</p>}
            {h.instructions && <p className="mt-2 text-ink-soft"><span className="eyebrow mr-1.5 !text-[10px]">Instructions</span>{h.instructions}</p>}
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-ink-mute">
              <dt>Assigned</dt><dd>{fmtDateTime(h.assignedAt, viewZone)}</dd>
              <dt>Due</dt>
              <dd>
                {fmtDateTime(h.dueAt, viewZone)} ({relative(h.dueAt)})
                {h.status === 'assigned' && !editDue && <button type="button" className="ml-2 font-semibold text-azul underline-offset-2 hover:underline" onClick={() => setEditDue(true)}>Change</button>}
              </dd>
              {r && <><dt>Completed</dt><dd>{fmtDateTime(r.completedAt, viewZone)} ({relative(r.completedAt)})</dd></>}
            </dl>
          </div>

          {editDue && (
            <div className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-ink/10">
              <div className="grid grid-cols-2 gap-3">
                <Field id="rv-due-date" label="New deadline"><input id="rv-due-date" type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
                <Field id="rv-due-time" label="Time"><input id="rv-due-time" type="time" step={300} className="input" value={dueTime} onChange={(e) => setDueTime(e.target.value)} /></Field>
              </div>
              <ZoneSelect id="rv-due-zone" value={dueZone} onChange={setDueZone} />
              <div className="flex gap-2">
                <button type="button" className="btn-dark !py-2" disabled={busy} onClick={saveDue}>Update deadline</button>
                <button type="button" className="ctrl" onClick={() => setEditDue(false)}>Cancel</button>
              </div>
            </div>
          )}

          {r ? (
            <section className="rounded-2xl bg-white p-4 ring-1 ring-ink/10" aria-label="Result">
              <p className="eyebrow mb-2">What {nameOf(people, h.studentId)} did</p>
              <div className="flex items-start gap-4">
                {typeof r.score === 'number' && (
                  <ProgressRing value={r.score} size={64} stroke={7} color={r.score >= 0.8 ? 'rgb(var(--c-tertiary))' : r.score >= 0.6 ? 'rgb(var(--c-secondary))' : 'rgb(var(--c-primary))'} label={`Score ${Math.round(r.score * 100)}%`}>
                    <b className="font-display text-lg">{Math.round(r.score * 100)}%</b>
                  </ProgressRing>
                )}
                <div className="min-w-0 flex-1 text-sm">
                  {r.summary && <p className="font-semibold">{r.summary}</p>}
                  {typeof r.correct === 'number' && typeof r.attempts === 'number' && <p className="text-ink-soft">{r.correct} of {r.attempts} correct</p>}
                  {r.recordingId && <p className="mt-1 text-ink-mute"><Icon name="mic" size={13} className="mr-1 inline" />A voice recording was saved on the student’s device — it isn’t uploaded, so listen together in your lesson.</p>}
                </div>
              </div>
              {r.text && (
                <blockquote className="mt-3 whitespace-pre-wrap rounded-xl bg-cream-100 p-3 text-[15px] leading-relaxed" lang="es">{r.text}</blockquote>
              )}
            </section>
          ) : (
            <p className="text-sm text-ink-mute"><Icon name="clock" size={14} className="mr-1 inline" />Not submitted yet. The student opens this from their homework page; the result appears here as soon as they finish.</p>
          )}

          {h.feedback && h.status === 'reviewed' && (
            <div className="rounded-2xl bg-olive-50 p-3 text-sm">
              <p className="eyebrow mb-1 !text-olive">Your feedback · {fmtDateTime(h.feedback.at, viewZone)}</p>
              <p className="whitespace-pre-wrap">{h.feedback.body}</p>
            </div>
          )}

          <form className="grid gap-2" onSubmit={review} noValidate>
            <Field id="rv-feedback" label={h.status === 'reviewed' ? 'Edit your feedback' : `Feedback for ${nameOf(people, h.studentId)}`} hint={h.status === 'assigned' ? 'You can leave feedback before they submit — it still marks the homework as reviewed.' : 'Corrections, praise, what to do next.'}>
              <textarea id="rv-feedback" aria-describedby="rv-feedback-hint" className="input min-h-[96px]" value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={1500} placeholder="¡Muy bien! …" />
            </Field>
            <ErrorText error={error} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className="btn-primary" disabled={busy}><Icon name="check" size={16} /> {busy ? 'Saving…' : h.status === 'reviewed' ? 'Update feedback' : 'Save review'}</button>
              <ConfirmButton confirmLabel="Yes, delete" disabled={busy} onConfirm={remove}><Icon name="trash" size={14} /> Delete homework</ConfirmButton>
            </div>
            <p className="text-xs text-ink-mute">Saved to the workspace{backend?.kind === 'demo' ? ' on this device' : ''} — the student sees it the next time they open their homework. No message is sent.</p>
          </form>
        </div>
      )}
    </Sheet>
  );
}
