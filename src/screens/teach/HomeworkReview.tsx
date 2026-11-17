import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { ProgressRing, Sheet } from '../../components/ui';
import { CATEGORY_LABEL, CATEGORY_TIP, spellingSlip } from '../../lib/answer';
import { usePlatform } from '../../lib/platform/context';
import { describeActivity } from '../../lib/platform/homework';
import { markLabel, segmentsWithCorrections } from '../../lib/platform/marking';
import { fmtDateTime, relative, utcIsoToZoned, zonedToUtcIso } from '../../lib/platform/time';
import { FOCUS_TAG_LABEL, HOMEWORK_KIND_LABEL, type Correction, type FocusTag, type Homework, type MarkedItem, type Person } from '../../lib/platform/types';
import { useStore } from '../../lib/store';
import type { ErrorCategory } from '../../types';
import { ConfirmButton, ErrorText, Field, StatusChip, ZoneSelect, nameOf, toneFor, useAction } from './shared';

const TAGS = Object.keys(FOCUS_TAG_LABEL) as FocusTag[];
/** In a sentence, what the student was asked to do, so the teacher can talk it through without opening the exercise. */
function whatItWas(prompt: string, kind: string): string {
  if (/^Match /.test(prompt)) return 'A matching exercise: tap a pronoun, then tap the verb form that goes with it. Every wrong pairing tried is listed.';
  if (/^Grow the sentence:/.test(prompt)) return 'A sentence that gets longer step by step. The sentence so far was on screen and they typed the part that is missing: the verb, a time word, or a linking phrase such as pero, porque or sin embargo.';
  if (/^Fill the gap:/.test(prompt)) return 'A Spanish sentence with the verb missing, shown here with its gap, the verb to use and the English meaning. They typed the verb.';
  if (/^Build( the sentence)?:/.test(prompt)) return 'The words of a sentence in a jumbled order, shown here as they were given. They tapped them into the right order.';
  if (/^Fix the mistake:/.test(prompt)) return 'A Spanish sentence with one wrong verb form, shown here struck through. They chose the form that should replace it.';
  if (/^Translate:/.test(prompt)) return 'An English sentence to write in Spanish.';
  if (/^Dictation:/.test(prompt)) return 'They heard the sentence read aloud and typed what they heard. Accents and punctuation are forgiven.';
  if (/^Meaning of /.test(prompt) || /^¿Qué significa/.test(prompt)) return 'A Spanish word with several English meanings to choose from.';
  if (/^Q: /.test(prompt)) return 'An open question from you. They typed a free answer, and the app does not mark it.';
  if (/^Reply to: /.test(prompt)) return 'A line said to them in a story scene. They chose a reply: natural, acceptable, or one that does not work.';
  if (/\(game\)$/.test(prompt)) return 'A round in an arcade game, played against the clock. The right answer is shown, and what they did when they missed.';
  if (/^Say it in Spanish: /.test(prompt)) return 'An English word or phrase to say or type in Spanish, from their memory deck.';
  if (/^.+ \+ .+ \(.+\)$/.test(prompt)) return 'A pronoun and a verb in a given tense. They had to give the right form of the verb.';
  if (/___/.test(prompt)) return 'A sentence with a gap. They typed or chose what goes in it.';
  return kind === 'vocabulary' ? 'A card from their memory deck: they recall the Spanish and the app checks it.' : 'One question from this homework.';
}

/** The question as the student saw it: a word marked «like this» is the mistake they were shown, drawn struck through. */
function Asked({ text }: { text: string }) {
  const parts = text.split(/(«[^»]+»)/);
  return <>{parts.map((x, i) => (/^«.+»$/.test(x) ? <s key={i} className="rounded bg-terracotta-50 px-1 font-semibold text-terracotta-dark decoration-2">{x.slice(1, -1)}</s> : <span key={i}>{x}</span>))}</>;
}

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
  const [expanded, setExpanded] = useState<number | null>(null);
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
    setExpanded(null);
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
                  <p className="eyebrow mb-2 !text-[10px]">Answer by answer · {items.length} · click an answer to see it in full</p>
                  <ol className="grid gap-1.5 text-sm">
                    {items.map((it, i) => {
                      const m = marked[i];
                      const ok = m?.ok ?? it.correct;
                      const isMatch = /^Match /.test(it.prompt);
                      const slip = isMatch ? null : spellingSlip(it.given, it.expected, it.category);
                      // An open question has no verdict from the app: it waits for the teacher's Right or Wrong.
                      const open = it.prompt.startsWith('Q: ') && it.expected === undefined;
                      return (
                        <li key={i} className={`rounded-xl px-3 py-2 ring-1 ${open && m?.ok === undefined ? 'bg-azul-50 ring-azul/20' : ok ? 'bg-white ring-ink/5' : 'bg-terracotta-50 ring-terracotta/20'}`} data-testid={`rv-answer-${i}`}>
                          <div className="flex cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-0.5" onClick={(e) => { if (!(e.target as HTMLElement).closest('button,input')) setExpanded(expanded === i ? null : i); }} data-testid={`rv-row-${i}`}>
                            <span className="w-5 shrink-0 text-xs text-ink-mute">{i + 1}.</span>
                            <span className="text-ink-soft" lang="es"><Asked text={it.prompt} /></span>
                            <span lang="es" className={`font-semibold ${ok ? 'text-olive' : 'text-terracotta-dark'}`}>{it.given || '—'}</span>
                            {!ok && it.expected && !isMatch && <span lang="es" className="text-ink-soft">→ <b className="text-ink">{it.expected}</b></span>}
                            {!ok && it.category && !slip && <span className="text-xs text-ink-mute">{categoryLabel(it.category)}</span>}
                            {!ok && slip && <span className="rounded-full bg-saffron-50 px-2 py-0.5 text-xs font-semibold text-ink ring-1 ring-saffron/50" data-testid={`rv-slip-${i}`}>{slip === 'accents' ? 'Only the accents are different' : 'Looks like a small spelling slip'}</span>}
                            {open && m?.ok === undefined && <span className="text-xs font-semibold text-azul">for you to mark</span>}
                            {!open && m?.ok !== undefined && <span className="text-xs text-azul">you changed this</span>}
                            <span className="ml-auto flex shrink-0 gap-1">
                              {([true, false] as const).map((v) => {
                                const on = open ? m?.ok === v : ok === v;
                                return <button key={String(v)} type="button" aria-pressed={on} className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition ${on ? (v ? 'bg-olive text-white ring-olive' : 'bg-terracotta text-white ring-terracotta') : 'bg-white text-ink-soft ring-ink/15 hover:ring-ink/40'}`} onClick={() => setItem(i, { ok: !open && v === it.correct ? undefined : v })} data-testid={`rv-${v ? 'right' : 'wrong'}-${i}`}>{v ? '✓ Right' : '✗ Wrong'}</button>;
                              })}
                              <button type="button" className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink-soft ring-1 ring-ink/15 hover:ring-ink/40" onClick={() => setOpenNote(openNote === i ? null : i)} data-testid={`rv-note-${i}`}>{m?.comment ? 'Edit note' : 'Note'}</button>
                            </span>
                          </div>
                          {expanded === i && (
                            <dl className="mt-2 grid gap-x-3 gap-y-1 rounded-xl bg-cream-100 p-3 text-sm sm:grid-cols-[auto_1fr]" data-testid={`rv-detail-${i}`}>
                              <dt className="text-ink-mute">The exercise</dt><dd className="text-ink-soft">{whatItWas(it.prompt, h.activity.kind)}</dd>
                              <dt className="text-ink-mute">Asked</dt><dd lang="es" data-testid={`rv-asked-${i}`}><Asked text={it.prompt} /></dd>
                              <dt className="text-ink-mute">{name} answered</dt><dd lang="es" className="font-semibold">{it.given || (it.correct ? 'Completed. This kind of exercise does not keep each answer.' : 'No answer was kept.')}</dd>
                              {it.expected && !isMatch && <><dt className="text-ink-mute">Right answer</dt><dd lang="es" className="font-semibold">{it.expected}</dd></>}
                              {it.expected && isMatch && <><dt className="text-ink-mute">The right pairs</dt><dd lang="es" className="flex flex-wrap gap-1.5">{it.expected.split(' · ').map((pair) => { const [pro, ...form] = pair.includes(' → ') ? pair.split(' → ') : [pair]; const missed = !!it.given && it.given.startsWith('Mixed up') && (it.given.includes(`: ${pro} + `) || it.given.includes(`, ${pro} + `)); return <span key={pair} className={`rounded-full px-2.5 py-1 ring-1 ${missed ? 'bg-terracotta-50 ring-terracotta/40' : 'bg-white ring-ink/10'}`}>{pro} <b>{form.join(' → ')}</b>{missed ? ' ✗' : ''}</span>; })}</dd></>}
                              {!ok && it.category && <><dt className="text-ink-mute">Kind of slip</dt><dd>{categoryLabel(it.category)}</dd></>}
                              {!ok && it.category && it.category in CATEGORY_TIP && <><dt className="text-ink-mute">To explain it</dt><dd data-testid={`rv-tip-${i}`}>{CATEGORY_TIP[it.category as ErrorCategory]}</dd></>}
                              {!ok && slip && <><dt className="text-ink-mute">Worth knowing</dt><dd>{slip === 'accents' ? 'Only the accents are different, so they knew the word.' : 'This is a letter or two off, so it may be a typing slip, not a gap in what they know.'}</dd></>}
                              <dt className="text-ink-mute">The app said</dt><dd>{open ? 'Nothing: this one is for you to mark' : it.correct ? 'Right' : 'Wrong'}{m?.ok !== undefined && !open ? `, and you changed it to ${m.ok ? 'right' : 'wrong'}` : ''}</dd>
                            </dl>
                          )}
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
