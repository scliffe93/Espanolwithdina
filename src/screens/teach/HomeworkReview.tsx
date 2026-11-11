import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { ProgressRing, Sheet } from '../../components/ui';
import { CATEGORY_LABEL } from '../../lib/answer';
import { usePlatform } from '../../lib/platform/context';
import { describeActivity } from '../../lib/platform/homework';
import { markLabel, segmentsWithCorrections } from '../../lib/platform/marking';
import { fmtDateTime, relative, utcIsoToZoned, zonedToUtcIso } from '../../lib/platform/time';
import { FOCUS_TAG_LABEL, HOMEWORK_KIND_LABEL, type Correction, type FocusTag, type Homework, type MarkedItem, type Person } from '../../lib/platform/types';
import { useStore } from '../../lib/store';
import type { ErrorCategory } from '../../types';
import { ConfirmButton, ErrorText, Field, StatusChip, ZoneSelect, nameOf, toneFor, useAction } from './shared';

const TAGS = Object.keys(FOCUS_TAG_LABEL) as FocusTag[];
const categoryLabel = (c?: string) => (c && c in CATEGORY_LABEL ? CATEGORY_LABEL[c as ErrorCategory] : c ?? '');

/**
 * Details of one homework item: what the student did, answer by answer; the teacher's
 * mark, notes on single answers and corrections to written or spoken work; feedback;
 * deadline and deletion. Saving marks the homework reviewed.
 */
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
  // Marking
  const [percent, setPercent] = useState('');
  const [grade, setGrade] = useState('');
  const [marked, setMarked] = useState<Record<number, MarkedItem>>({});
  const [openNote, setOpenNote] = useState<number | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [draft, setDraft] = useState<Correction>({ quote: '', correction: '', note: '', category: undefined });
  const textRef = useRef<HTMLQuoteElement>(null);

  useEffect(() => {
    if (!homework) return;
    setFeedback(homework.feedback?.body ?? '');
    const z = utcIsoToZoned(homework.dueAt, viewZone);
    setDueDate(z.date);
    setDueTime(z.time);
    setDueZone(viewZone);
    setEditDue(false);
    setError(null);
    const m = homework.marking;
    const score = m?.score ?? homework.result?.score;
    setPercent(typeof score === 'number' ? String(Math.round(score * 100)) : '');
    setGrade(m?.grade ?? '');
    setMarked(Object.fromEntries((m?.items ?? []).map((x) => [x.index, x])));
    setOpenNote(null);
    setCorrections(m?.corrections ?? []);
    setDraft({ quote: '', correction: '', note: '', category: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homework?.id]);

  const review = async (e: FormEvent) => {
    e.preventDefault();
    if (!backend || !h) return;
    if (!feedback.trim()) return setError('Write a few words of feedback first.');
    const pct = percent.trim() === '' ? undefined : Number(percent);
    if (pct !== undefined && (!Number.isFinite(pct) || pct < 0 || pct > 100)) return setError('The mark must be between 0 and 100.');
    const items = Object.values(marked).filter((x) => x.ok !== undefined || x.comment?.trim()).map((x) => ({ index: x.index, ...(x.ok !== undefined ? { ok: x.ok } : {}), ...(x.comment?.trim() ? { comment: x.comment.trim() } : {}) }));
    const marking = { ...(pct !== undefined ? { score: pct / 100 } : {}), ...(grade.trim() ? { grade: grade.trim() } : {}), ...(items.length ? { items } : {}), ...(corrections.length ? { corrections } : {}) };
    const saved = await run(() => backend.reviewHomework(h.id, feedback.trim(), marking), people);
    if (saved) {
      notify('Homework reviewed', `${nameOf(people, saved.studentId)} will see your marking and feedback on their homework page.`);
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

  const setItem = (index: number, patch: Partial<MarkedItem>) => setMarked((m) => ({ ...m, [index]: { ...(m[index] ?? {}), ...patch, index } }));
  const useSelection = () => {
    const sel = window.getSelection?.()?.toString().trim() ?? '';
    if (sel && textRef.current && window.getSelection()?.anchorNode && textRef.current.contains(window.getSelection()!.anchorNode)) setDraft((d) => ({ ...d, quote: sel }));
    else setError('Select some of the student’s words first, then press “Use selection”.');
  };
  const addCorrection = () => {
    if (!draft.quote.trim() || !draft.correction.trim()) return setError('A correction needs the student’s words and what they should be.');
    if (h?.result?.text && !h.result.text.toLowerCase().includes(draft.quote.trim().toLowerCase())) return setError('Those words are not in the student’s answer. Copy them exactly.');
    setError(null);
    setCorrections((c) => [...c, { quote: draft.quote.trim(), correction: draft.correction.trim(), ...(draft.note?.trim() ? { note: draft.note.trim() } : {}), ...(draft.category ? { category: draft.category } : {}) }]);
    setDraft({ quote: '', correction: '', note: '', category: undefined });
  };

  const tone = h ? toneFor(people, h.studentId) : null;
  const r = h?.result;
  const name = h ? nameOf(people, h.studentId) : '';
  const items = r?.items ?? [];
  const wrong = items.filter((it, i) => !((marked[i]?.ok) ?? it.correct)).length;

  return (
    <Sheet open={!!homework} onClose={onClose} title={h?.activity.title ?? 'Homework'} wide>
      {h && tone && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex items-center gap-1.5 font-semibold ${tone.text}`}><span className={`h-2 w-2 rounded-full ${tone.bg}`} aria-hidden />{name}</span>
            <StatusChip status={h.status} />
            <span className="text-ink-mute">{HOMEWORK_KIND_LABEL[h.activity.kind]}</span>
            {markLabel(h.marking) && <span className="rounded-full bg-olive-50 px-2 py-0.5 text-xs font-semibold text-olive">Marked {markLabel(h.marking)}</span>}
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
              <p className="eyebrow mb-2">What {name} did</p>
              <div className="flex items-start gap-4">
                {typeof r.score === 'number' && (
                  <ProgressRing value={r.score} size={64} stroke={7} color={r.score >= 0.8 ? 'rgb(var(--c-tertiary))' : r.score >= 0.6 ? 'rgb(var(--c-secondary))' : 'rgb(var(--c-primary))'} label={`Score ${Math.round(r.score * 100)}%`}>
                    <b className="font-display text-lg">{Math.round(r.score * 100)}%</b>
                  </ProgressRing>
                )}
                <div className="min-w-0 flex-1 text-sm">
                  {r.summary && <p className="font-semibold">{r.summary}</p>}
                  {typeof r.correct === 'number' && typeof r.attempts === 'number' && <p className="text-ink-soft">{r.correct} of {r.attempts} correct{items.length ? ` · ${wrong} to look at` : ''}</p>}
                  {r.recordingId && <p className="mt-1 text-ink-mute"><Icon name="mic" size={13} className="mr-1 inline" />A voice recording was saved on the student’s device — it isn’t uploaded, so listen together in your lesson.</p>}
                </div>
              </div>
              {r.text && (
                <>
                  <blockquote ref={textRef} className="mt-3 whitespace-pre-wrap rounded-xl bg-cream-100 p-3 text-[15px] leading-relaxed" lang="es" data-testid="rv-text">
                    {segmentsWithCorrections(r.text, corrections).map((s, i) => s.correction ? <mark key={i} className="rounded bg-terracotta-50 px-0.5 text-terracotta-dark underline decoration-terracotta decoration-wavy" title={`→ ${s.correction.correction}`}>{s.text}</mark> : <span key={i}>{s.text}</span>)}
                  </blockquote>
                  <div className="mt-3 rounded-xl bg-cream-50 p-3 ring-1 ring-ink/5" data-testid="rv-corrections">
                    <p className="eyebrow mb-2 !text-[10px]">Corrections · {corrections.length}</p>
                    {corrections.length > 0 && (
                      <ul className="mb-3 grid gap-1.5 text-sm">
                        {corrections.map((c, i) => (
                          <li key={i} className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-ink/5">
                            <span lang="es" className="text-terracotta-dark line-through decoration-terracotta/60">{c.quote}</span>
                            <span lang="es" className="font-semibold text-olive">{c.correction}</span>
                            {c.category && <span className="text-xs text-ink-mute">{FOCUS_TAG_LABEL[c.category]}</span>}
                            {c.note && <span className="w-full text-xs text-ink-soft">{c.note}</span>}
                            <button type="button" className="ml-auto text-xs text-ink-mute hover:text-ink" aria-label={`Remove correction of ${c.quote}`} onClick={() => setCorrections((cs) => cs.filter((_, k) => k !== i))}><Icon name="x" size={12} /></button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-medium">The student wrote
                        <div className="flex gap-1"><input lang="es" className="input !py-1.5 text-sm" value={draft.quote} onChange={(e) => setDraft((d) => ({ ...d, quote: e.target.value }))} placeholder="estoy de Londres" data-testid="rv-quote" /><button type="button" className="ctrl shrink-0 !px-2 !text-xs" onClick={useSelection} title="Fill in with the words you selected above">Use selection</button></div>
                      </label>
                      <label className="grid gap-1 text-xs font-medium">It should be
                        <input lang="es" className="input !py-1.5 text-sm" value={draft.correction} onChange={(e) => setDraft((d) => ({ ...d, correction: e.target.value }))} placeholder="soy de Londres" data-testid="rv-correction" />
                      </label>
                      <label className="grid gap-1 text-xs font-medium">Why (optional)
                        <input className="input !py-1.5 text-sm" value={draft.note ?? ''} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} placeholder="origin takes ser" />
                      </label>
                      <label className="grid gap-1 text-xs font-medium">Type of slip
                        <select className="input !py-1.5 text-sm" value={draft.category ?? ''} onChange={(e) => setDraft((d) => ({ ...d, category: (e.target.value || undefined) as FocusTag | undefined }))} data-testid="rv-category">
                          <option value="">Not tagged</option>
                          {TAGS.map((t) => <option key={t} value={t}>{FOCUS_TAG_LABEL[t]}</option>)}
                        </select>
                      </label>
                    </div>
                    <button type="button" className="btn-soft mt-2 !py-1.5 !text-sm" onClick={addCorrection} data-testid="rv-add-correction"><Icon name="plus" size={14} /> Add correction</button>
                  </div>
                </>
              )}
              {items.length > 0 && (
                <div className="mt-3" data-testid="rv-answers">
                  <p className="eyebrow mb-2 !text-[10px]">Answer by answer · {items.length}</p>
                  <ol className="grid gap-1.5 text-sm">
                    {items.map((it, i) => {
                      const m = marked[i];
                      const ok = m?.ok ?? it.correct;
                      return (
                        <li key={i} className={`rounded-xl px-3 py-2 ring-1 ${ok ? 'bg-white ring-ink/5' : 'bg-terracotta-50 ring-terracotta/20'}`} data-testid={`rv-answer-${i}`}>
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="w-5 shrink-0 text-xs text-ink-mute">{i + 1}.</span>
                            <span className="text-ink-soft">{it.prompt}</span>
                            <span lang="es" className={`font-semibold ${ok ? 'text-olive' : 'text-terracotta-dark'}`}>{it.given || '—'}</span>
                            {!ok && it.expected && <span lang="es" className="text-ink-soft">→ <b className="text-ink">{it.expected}</b></span>}
                            {!ok && it.category && <span className="text-xs text-ink-mute">{categoryLabel(it.category)}</span>}
                            {m?.ok !== undefined && <span className="text-xs text-azul">your call: {m.ok ? 'correct' : 'wrong'}</span>}
                            <span className="ml-auto flex shrink-0 gap-1">
                              <button type="button" className="rounded-md px-1.5 py-0.5 text-xs text-ink-mute hover:bg-cream-100 hover:text-ink" onClick={() => setItem(i, { ok: m?.ok === undefined ? !it.correct : undefined })} title={m?.ok === undefined ? (it.correct ? 'Count as wrong' : 'Accept this answer') : 'Back to the app’s verdict'}>{m?.ok === undefined ? (it.correct ? 'mark wrong' : 'accept') : 'undo'}</button>
                              <button type="button" className="rounded-md px-1.5 py-0.5 text-xs text-ink-mute hover:bg-cream-100 hover:text-ink" onClick={() => setOpenNote(openNote === i ? null : i)} data-testid={`rv-note-${i}`}>{m?.comment ? 'edit note' : 'note'}</button>
                            </span>
                          </div>
                          {(openNote === i || m?.comment) && (
                            <input className="input mt-1.5 !py-1.5 text-sm" value={m?.comment ?? ''} onChange={(e) => setItem(i, { comment: e.target.value })} placeholder="A word for the student on this one" maxLength={300} autoFocus={openNote === i} data-testid={`rv-note-input-${i}`} />
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
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

          <form className="grid gap-3" onSubmit={review} noValidate>
            {r && (
              <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                <Field id="rv-mark" label="Mark (%)" hint={typeof r.score === 'number' ? `The app scored ${Math.round(r.score * 100)}%.` : 'Optional.'}>
                  <input id="rv-mark" type="number" min={0} max={100} className="input" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="—" data-testid="rv-mark" />
                </Field>
                <Field id="rv-grade" label="Grade (optional)" hint="e.g. B+ or 8/10.">
                  <input id="rv-grade" className="input" value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={12} placeholder="—" data-testid="rv-grade" />
                </Field>
              </div>
            )}
            <Field id="rv-feedback" label={h.status === 'reviewed' ? 'Edit your feedback' : `Feedback for ${name}`} hint={h.status === 'assigned' ? 'You can leave feedback before they submit — it still marks the homework as reviewed.' : 'Corrections, praise, what to do next.'}>
              <textarea id="rv-feedback" aria-describedby="rv-feedback-hint" className="input min-h-[96px]" value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={1500} placeholder="¡Muy bien! …" />
            </Field>
            <ErrorText error={error} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className="btn-primary" disabled={busy} data-testid="rv-save"><Icon name="check" size={16} /> {busy ? 'Saving…' : h.status === 'reviewed' ? 'Update marking' : 'Save marking'}</button>
              <ConfirmButton confirmLabel="Yes, delete" disabled={busy} onConfirm={remove}><Icon name="trash" size={14} /> Delete homework</ConfirmButton>
            </div>
            <p className="text-xs text-ink-mute">Saved to the workspace{backend?.kind === 'demo' ? ' on this device' : ''} — the student sees the mark, your notes and corrections the next time they open their homework. No message is sent.</p>
          </form>
        </div>
      )}
    </Sheet>
  );
}
