import { useEffect, useMemo, useRef, useState } from 'react';
import { DinaArt } from '../../components/Dina';
import { Icon, type IconName } from '../../components/Icon';
import { Segmented } from '../../components/ui';
import { isPresent } from '../../../supabase/functions/_shared/lesson';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { BLOCK_LABEL, draftLesson, exampleLesson, newBlock } from '../../lib/platform/lessonDraft';
import { homeworkFromLesson, homeworkItems } from '../../lib/platform/lessonHomework';
import { WORDING_LABEL, adaptPlan, reword, stageOf, wordingFor, type Wording } from '../../lib/platform/lessonAdapt';
import { overallLevel } from '../../lib/platform/level';
import { describeImport, type ImportedPlan } from '../../lib/platform/lessonImport';
import { extractText, sourceKindOf } from '../../lib/extractText';
import type { LessonAnswer, LessonBlock, LessonPlan, LibraryPlan, StudentSettings } from '../../lib/platform/types';
import type { AppState, Cefr } from '../../types';
import { navigate } from '../../lib/router';
import { useStore } from '../../lib/store';
import { ErrorText, Loading, useStudents } from '../teach/shared';
import { BLOCK_THEME, BlockView, LessonClock, LessonTrail } from './Blocks';
import { useGroupWork, useLesson } from './useLesson';
import { sfx } from '../../lib/fx';

const today = () => new Date().toISOString().slice(0, 10);
const TYPES: LessonBlock['type'][] = ['text', 'question', 'gap', 'choice', 'vocab'];

/** Each kind of part has its own colour and icon, so a plan can be read at a glance. */
export const TYPE_STYLE: Record<LessonBlock['type'], { icon: IconName; tile: string; bar: string; chip: string }> = {
  text: { icon: 'book', tile: 'bg-azul-50 text-azul', bar: 'bg-azul', chip: 'bg-azul-50 text-azul' },
  question: { icon: 'chat', tile: 'bg-terracotta-50 text-terracotta', bar: 'bg-terracotta', chip: 'bg-terracotta-50 text-terracotta-dark' },
  gap: { icon: 'edit', tile: 'bg-saffron-50 text-ink', bar: 'bg-saffron', chip: 'bg-saffron-50 text-ink' },
  choice: { icon: 'check', tile: 'bg-olive-50 text-olive', bar: 'bg-olive', chip: 'bg-olive-50 text-olive' },
  vocab: { icon: 'translate', tile: 'bg-rosa-50 text-ink', bar: 'bg-rosa', chip: 'bg-rosa-50 text-ink' },
};

/** A small row of chips: how many of each kind of part a lesson has. */
function PartChips({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {TYPES.filter((t) => blocks.some((b) => b.type === t)).map((t) => (
        <span key={t} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_STYLE[t].chip}`}><Icon name={TYPE_STYLE[t].icon} size={11} /> {blocks.filter((b) => b.type === t).length}</span>
      ))}
    </span>
  );
}

const LEVELS: Cefr[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
/** The topic of a plan, read from its title: "Spanish A1 — Lesson 1: Greetings & Introductions" → "Greetings & Introductions". */
export const topicFrom = (title: string): string => { const t = title.split(/[:—–]\s+/).pop()?.trim() ?? ''; return t && t !== title.trim() && t.length <= 40 ? t : ''; };
/** The level a student is working at, as the teacher sees it: her ceiling, else the level she confirmed, else theirs. */
const levelOf = (settings: StudentSettings | null | undefined, state: AppState | null | undefined): Cefr => settings?.maxLevel ?? settings?.verified?.level ?? overallLevel(state?.profile?.levels);

/** The stages of a lesson with their planned minutes, read back from the parts' headings. */
function stagesOf(blocks: LessonBlock[]): { no: number; name: string; minutes: number; parts: number }[] {
  const out: { no: number; name: string; minutes: number; parts: number }[] = [];
  for (const b of blocks) { const s = stageOf(b.title); if (!s) continue; const at = out.find((x) => x.no === s.no); if (at) at.parts++; else out.push({ no: s.no, name: s.name, minutes: s.minutes, parts: 1 }); }
  return out;
}

/** The facts of a plan in one table: who it is for, the level, the wording, the time. */
function PlanFacts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid overflow-hidden rounded-3xl bg-white text-sm shadow-soft ring-1 ring-ink/5 sm:grid-cols-2 lg:grid-cols-4" data-testid="plan-facts">
      {rows.map(([k, v]) => <div key={k} className="border-b border-ink/5 p-3.5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"><dt className="eyebrow !text-[10px]">{k}</dt><dd className="mt-1 font-semibold">{v}</dd></div>)}
    </dl>
  );
}

type Draft = Omit<LibraryPlan, 'teacherId' | 'createdAt' | 'updatedAt'>;

/**
 * A plan from the library, open for review: the facts at the top, what was adapted, the parts to edit. An uploaded
 * plan arrives here "to review". The teacher marks it ready when she is happy, and uses it for a student whenever.
 */
function PlanReview({ plan, source, sourceName, adapted, student, topics, busy, onSave, onUse, onClose, onDelete }: { plan: Draft; topics: string[]; source?: string; sourceName?: string; adapted: string[]; student: { name: string; level: Cefr } | null; busy: boolean; onSave: (d: Draft, then: 'stay' | 'close') => void; onUse: (d: Draft) => void; onClose: () => void; onDelete: () => void }) {
  const [d, setD] = useState<Draft>(plan);
  const [showSource, setShowSource] = useState(!!source);
  const blocks = d.blocks;
  const setBlocks = (f: (bs: LessonBlock[]) => LessonBlock[]) => setD((x) => ({ ...x, blocks: f(x.blocks) }));
  const missing = blocks.filter((b) => (b.type === 'gap' || b.type === 'choice') && !(b.answer ?? '').trim()).length;
  const stages = stagesOf(blocks);
  const counts = Object.fromEntries(TYPES.map((t) => [t, blocks.filter((x) => x.type === t).length])) as ImportedPlan['counts'];
  return (
    <div data-testid="import-review">
      <section className="relative overflow-hidden rounded-4xl bg-ink p-6 text-cream shadow-lift sm:p-7">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-olive/40 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1 basis-72">
            <p className="eyebrow !text-saffron-light">Revisa tu clase · {d.status === 'ready' ? 'Ready to teach' : 'To review'}</p>
            <h1 className="mt-1 font-display text-3xl font-semibold leading-tight sm:text-4xl">{d.title || 'Lesson plan'}</h1>
            <p className="mt-2 max-w-2xl text-cream/80">{sourceName ? <>Made from <b className="text-cream">{sourceName}</b> and filed in your plans under {d.level}. </> : null}Check it, change anything, then mark it ready. It can be used for any student, as often as you like.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-full bg-cream/10 px-5 py-3 font-semibold text-cream ring-1 ring-cream/20 hover:bg-cream/15" disabled={busy} onClick={() => onSave({ ...d, status: 'review' }, 'close')} data-testid="review-cancel">Save, review later</button>
            <button type="button" className={`inline-flex items-center gap-2 rounded-full px-5 py-3 font-bold transition ${d.status === 'ready' ? 'bg-olive text-white' : 'bg-cream text-ink hover:scale-[1.02]'}`} disabled={busy || blocks.length === 0} onClick={() => { setD((x) => ({ ...x, status: 'ready' })); onSave({ ...d, status: 'ready' }, 'stay'); }} data-testid="review-ready"><Icon name="check" size={18} /> {d.status === 'ready' ? 'Ready' : 'Mark as ready'}</button>
            {student && <button type="button" className="inline-flex items-center gap-2 rounded-full bg-saffron px-6 py-3 font-bold text-ink shadow-lift transition hover:scale-[1.02] disabled:opacity-60" disabled={busy || blocks.length === 0} onClick={() => onUse(d)} data-testid="review-create"><Icon name="video" size={18} /> Use it for {student.name}</button>}
          </div>
        </div>
      </section>

      <div className="mt-4" data-testid="review-facts">
        <PlanFacts rows={[
          ['Topic', <input key="t" className="input !py-1.5" list="plan-topics" value={d.topic ?? ''} onChange={(e) => setD((x) => ({ ...x, topic: e.target.value }))} placeholder="Greetings, food, the past…" maxLength={40} data-testid="review-topic" />],
          ['Filed under level', <select key="l" className="input !w-28 !py-1.5" value={d.level} onChange={(e) => setD((x) => ({ ...x, level: e.target.value as Cefr }))} data-testid="review-level">{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>],
          ['Instructions written in', <select key="w" className="input !py-1.5" value={d.wording} onChange={(e) => { const to = e.target.value as Wording; setD((x) => ({ ...x, wording: to, blocks: reword(x.blocks, to) })); }} data-testid="review-wording">{(['en', 'both', 'es'] as Wording[]).map((w) => <option key={w} value={w}>{WORDING_LABEL[w]}</option>)}</select>],
          ['Planned time', d.minutes ? `${d.minutes} minutes · ${stages.length} stage${stages.length === 1 ? '' : 's'}` : 'No timings in the plan'],
        ]} />
        <datalist id="plan-topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
        <p className="mt-2 text-sm text-ink-soft"><b data-testid="review-summary">{describeImport({ title: d.title, blocks, counts, needAnswers: missing })}</b></p>
        {student && <p className="mt-2 text-sm text-ink-soft" data-testid="review-for">Used for <b>{student.name}</b> ({student.level}), the instructions are rewritten in <b>{WORDING_LABEL[wordingFor(student.level)].toLowerCase()}</b>: less English as the level rises. The Spanish of your plan is never changed.</p>}
      </div>

      {stages.length > 1 && (
        <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-ink/5" data-testid="review-stages">
          <div className="flex h-3">{stages.map((s, i) => <span key={s.no} style={{ flexGrow: Math.max(1, s.minutes) }} className={['bg-terracotta', 'bg-azul', 'bg-olive', 'bg-saffron', 'bg-rosa', 'bg-ink'][i % 6]} />)}</div>
          <ol className="grid gap-px bg-ink/5 sm:grid-cols-2 lg:grid-cols-5">
            {stages.map((s) => <li key={s.no} className="bg-white p-3 text-sm"><b className="block">{s.no}. {s.name}</b><span className="text-ink-mute">{s.minutes ? `${s.minutes} min · ` : ''}{s.parts} part{s.parts === 1 ? '' : 's'}</span></li>)}
          </ol>
        </div>
      )}

      <div className={`mt-5 grid gap-5 ${showSource && source ? 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]' : ''}`}>
        {showSource && source && (
          <aside className="lg:sticky lg:top-4 lg:self-start" data-testid="review-source">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-ink/5 bg-cream-100 px-4 py-2.5"><p className="eyebrow">Your document</p><button type="button" className="text-xs font-semibold text-ink-mute hover:text-ink" onClick={() => setShowSource(false)}>Hide</button></div>
              <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words p-4 font-sans text-[14px] leading-relaxed text-ink-soft" lang="es">{source.replace(/^# /gm, '').replace(/\t/g, '   ')}</pre>
            </div>
          </aside>
        )}
        <div className="min-w-0">
          <div className="card mb-3 flex flex-wrap items-end gap-3 p-4">
            <label className="grid min-w-0 flex-1 gap-1 text-sm font-medium">Title of the lesson<input className="input text-lg" value={d.title} onChange={(e) => setD((x) => ({ ...x, title: e.target.value }))} data-testid="review-title" /></label>
            {!showSource && source && <button type="button" className="ctrl" onClick={() => setShowSource(true)}><Icon name="eye" size={14} /> Show my document</button>}
          </div>
          <p className={`mb-3 rounded-2xl px-4 py-2.5 text-sm font-semibold ring-1 ${missing ? 'bg-saffron-50 ring-saffron/50' : 'bg-olive-50 text-olive ring-olive/30'}`} data-testid="review-missing">{missing ? `${missing} part${missing === 1 ? ' needs' : 's need'} an answer: they are marked below` : 'Every gap and choice has its answer'}</p>
          {adapted.length > 0 && (
            <div className="mb-3 rounded-3xl bg-olive-50 p-4 ring-1 ring-olive/30" data-testid="review-adapted">
              <p className="font-semibold"><Icon name="sparkle" size={15} className="mr-1 inline" /> Built from your plan for a lesson on screen</p>
              <ul className="mt-2 grid gap-1 text-sm">{adapted.map((a) => <li key={a} className="flex gap-2"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-olive" /> <span>{a}</span></li>)}</ul>
            </div>
          )}
          <details className="card mb-3 p-4" data-testid="review-notes">
            <summary className="cursor-pointer font-semibold">Your own notes <span className="font-normal text-ink-mute">· timings, board work and pronunciation points, only you see these</span></summary>
            <textarea className="input mt-3 min-h-[180px] w-full text-sm" value={d.notes} onChange={(e) => setD((x) => ({ ...x, notes: e.target.value }))} maxLength={6000} />
          </details>
          <ol className="grid gap-3">
            {blocks.map((b, i) => (
              <BlockEditor key={b.id} b={b} i={i} n={blocks.length} flag={(b.type === 'gap' || b.type === 'choice') && !(b.answer ?? '').trim()}
                onChange={(nb) => setBlocks((bs) => bs.map((x) => (x.id === b.id ? nb : x)))}
                onMove={(dir) => setBlocks((bs) => { const arr = [...bs]; const j = i + dir; [arr[i], arr[j]] = [arr[j], arr[i]]; return arr; })}
                onDelete={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}
                onDuplicate={() => setBlocks((bs) => { const arr = [...bs]; arr.splice(i + 1, 0, { ...b, id: newBlock(b.type).id }); return arr; })} />
            ))}
          </ol>
          {blocks.length === 0 && <p className="card p-6 text-center text-ink-soft">Every part has been removed.</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={busy || blocks.length === 0} onClick={() => onSave({ ...d, status: 'ready' }, 'close')}><Icon name="check" size={18} /> Save as ready</button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => onSave({ ...d, status: 'review' }, 'close')}>Save, review later</button>
            <button type="button" className="btn-ghost" onClick={onClose}>Close without saving</button>
            <button type="button" className="btn-ghost ml-auto hover:!text-terracotta-dark" disabled={busy} onClick={() => { if (window.confirm('Delete this plan from your library? Lessons already made from it are kept.')) onDelete(); }} data-testid="review-delete"><Icon name="trash" size={16} /> Delete this plan</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One way of starting a lesson, as a card. */
function StartCard({ icon, tone, title, text, onClick, disabled, testid, primary }: { icon: IconName; tone: string; title: string; text: string; onClick: () => void; disabled?: boolean; testid: string; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testid}
      className={`group flex items-start gap-3 rounded-3xl p-4 text-left ring-1 transition disabled:opacity-50 ${primary ? 'bg-terracotta text-white shadow-lift ring-terracotta hover:-translate-y-0.5' : 'bg-white ring-ink/10 hover:-translate-y-0.5 hover:shadow-soft hover:ring-ink/20'}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${primary ? 'bg-white/20 text-white' : tone}`}><Icon name={icon} size={20} /></span>
      <span className="min-w-0"><b className="block text-[16px] leading-tight">{title}</b><span className={`mt-1 block text-sm leading-snug ${primary ? 'text-white/85' : 'text-ink-soft'}`}>{text}</span></span>
    </button>
  );
}

/** The teacher's lesson room: start a lesson, her library of plans by level, and the lessons she has made. */
export function RoomList() {
  const { backend } = usePlatform();
  const students = useStudents();
  const lessons = usePlatformQuery((b) => b.lessons(), []);
  const library = usePlatformQuery((b) => b.libraryPlans(), []);
  const [studentId, setStudentId] = useState('');
  const settings = usePlatformQuery((b) => (studentId ? b.studentSettings(studentId) : Promise.resolve(null)), [studentId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const people = students.data?.people ?? [];
  const nameOf = (id: string) => people.find((p) => p.id === id)?.firstName ?? 'Student';
  useEffect(() => { if (!studentId && people[0]) setStudentId(people[0].id); }, [people, studentId]);
  const studentLevel = levelOf(settings.data, students.data?.progress[studentId]);
  // More students make it a group lesson: each gets their own copy, taught together.
  const [more, setMore] = useState<string[]>([]);
  const groupIds = [studentId, ...more.filter((x) => x !== studentId)].filter(Boolean);
  const groups = usePlatformQuery((b) => b.lessonGroups(), []);
  const student = studentId ? { name: groupIds.length > 1 ? `${nameOf(studentId)} +${groupIds.length - 1}` : nameOf(studentId), level: studentLevel } : null;
  /** One lesson, or the same lesson for each student in the group (same parts, same ids) kept together as a group. */
  const makeLesson = async (input: { title: string; notes: string; blocks: LessonBlock[] }) => {
    const made: LessonPlan[] = [];
    for (const sid of groupIds) made.push(await backend!.saveLesson({ studentId: sid, title: input.title, date: today(), notes: input.notes, blocks: input.blocks, live: { on: false, current: null } }));
    if (made.length > 1) { await backend!.saveLessonGroup(made.map((m) => ({ lessonId: m.id, studentId: m.studentId }))); groups.reload(); }
    return made[0];
  };

  // A plan the teacher uploads or pastes is filed in her library as "to review", then opened for her to check.
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [filter, setFilter] = useState<Cefr | 'all'>('all');
  const [topic, setTopic] = useState('');
  const [review, setReview] = useState<{ plan: Draft; source?: string; name?: string; adapted: string[] } | null>(null);
  const file = async (text: string, name: string, fallback: string) => {
    if (!backend) return;
    const made = adaptPlan(text, fallback);
    if (!made.blocks.length) { setError('Nothing could be read from that. If it is a scanned page or a photo, paste the text instead.'); return; }
    setError(null);
    const saved = await backend.saveLibraryPlan({ title: made.title, topic: topicFrom(made.title), level: made.level ?? studentLevel, status: 'review', blocks: made.blocks, notes: made.notes, minutes: made.minutes, wording: made.wording, source: name });
    library.reload();
    setReview({ plan: saved, source: text.trim(), name, adapted: made.adapted });
    window.scrollTo({ top: 0 });
  };
  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy(true); setError(null);
    try {
      if (!sourceKindOf(f)) throw new Error('Use a Word document (.docx), a PDF or a text file.');
      const r = await extractText(f, { layout: true });
      await file(r.text, f.name, f.name.replace(/\.[^.]+$/, ''));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read that file.'); }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };
  const savePlan = async (d: Draft, then: 'stay' | 'close') => {
    if (!backend) return;
    setBusy(true); setError(null);
    try { const saved = await backend.saveLibraryPlan(d); library.reload(); if (then === 'close') setReview(null); else setReview((r) => (r ? { ...r, plan: saved } : r)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save the plan.'); }
    setBusy(false);
  };
  /** A lesson for the chosen student from a plan, with the instructions in the wording that suits their level. */
  const usePlan = async (d: Draft, save = true) => {
    if (!backend || !studentId) return;
    setBusy(true); setError(null);
    try {
      if (save) { await backend.saveLibraryPlan(d); library.reload(); }
      const plan = await makeLesson({ title: d.title.trim() || 'Lesson', notes: d.notes, blocks: reword(d.blocks, wordingFor(studentLevel)).map((b) => ({ ...b, id: newBlock(b.type).id, open: false, reveal: false })) });
      navigate(`teach/room/${plan.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the lesson.'); setBusy(false); }
  };

  const create = async (kind: 'draft' | 'blank' | 'example') => {
    if (!backend || !studentId) return;
    setBusy(true); setError(null);
    try {
      const name = nameOf(studentId);
      const blocks = kind === 'draft' ? draftLesson(students.data?.progress[studentId] ?? null, name) : kind === 'example' ? exampleLesson(name) : [newBlock('question')];
      const plan = await makeLesson({ title: kind === 'example' ? 'Example lesson: el pretérito de ir y ser' : groupIds.length > 1 ? `Group lesson: ${groupIds.map(nameOf).join(', ')}` : `Lesson with ${name}`, notes: '', blocks });
      navigate(`teach/room/${plan.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the lesson.'); }
    setBusy(false);
  };

  if (review) return (<><ErrorText error={error} /><PlanReview key={review.plan.id} topics={[...new Set((library.data ?? []).map((x) => x.topic ?? '').filter(Boolean))].sort()} plan={review.plan} source={review.source} sourceName={review.name} adapted={review.adapted} student={student} busy={busy} onSave={(d, then) => void savePlan(d, then)} onUse={(d) => void usePlan(d)} onClose={() => { setReview(null); setError(null); }} onDelete={() => { void backend?.deleteLibraryPlan(review.plan.id).then(() => { library.reload(); setReview(null); }); }} /></>);

  const none = !!students.data && people.length === 0;
  const running = (lessons.data ?? []).filter((l) => l.live.on);
  const plans = library.data ?? [];
  const shown = plans.filter((p) => (filter === 'all' || p.level === filter) && (!topic || (p.topic ?? '') === topic));
  const allTopics = [...new Set(plans.map((p) => p.topic ?? '').filter(Boolean))].sort();
  const waiting = plans.filter((p) => p.status === 'review').length;
  return (
    <div data-testid="room-list">
      <section className="relative overflow-hidden rounded-4xl bg-ink p-6 text-cream shadow-lift sm:p-8">
        <div className="absolute -right-10 -top-12 h-52 w-52 rounded-full bg-terracotta/40 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <div className="shrink-0"><DinaArt size={104} expression="beam" /></div>
          <div className="min-w-0 flex-1 basis-72">
            <p className="eyebrow !text-saffron-light">Aula · Lesson room</p>
            <h1 className="mt-1 font-display text-4xl font-semibold leading-tight sm:text-5xl">Teach on one shared screen</h1>
            <p className="mt-2 max-w-xl text-cream/80">Your student follows on their own phone or tablet, and answers there.</p>
          </div>
        </div>
        <ol className="relative mt-6 grid gap-2 sm:grid-cols-3">
          {[['Plan', 'Keep your plans in the library, filed by level. Upload the ones you already have.'], ['Share your screen', 'Open Present on your call and start the lesson. A clock shows how long you have been going.'], ['Open each part', 'They see a part only when you show it. Their answers come to you.']].map(([t, dsc], i) => (
            <li key={t} className="flex items-start gap-3 rounded-2xl bg-cream/10 p-3 ring-1 ring-cream/10"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-saffron text-sm font-bold text-ink">{i + 1}</span><span><b className="block">{t}</b><span className="text-sm text-cream/75">{dsc}</span></span></li>
          ))}
        </ol>
      </section>

      {running.length > 0 && (
        <button type="button" onClick={() => navigate(`teach/room/${running[0].id}`)} className="mt-4 flex w-full items-center gap-4 rounded-3xl bg-olive p-4 text-left text-white shadow-lift" data-testid="room-running">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20"><Icon name="video" size={22} /></span>
          <span className="min-w-0 flex-1"><span className="eyebrow !text-white/80">Running now</span><b className="block truncate text-lg">{running[0].title} · {nameOf(running[0].studentId)}</b></span>
          <span className="rounded-full bg-white px-4 py-2 font-bold text-ink">Go back in</span>
        </button>
      )}

      <section className="mt-6" data-testid="room-start">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold">A lesson for</h2>
          <select className="input !w-48 !py-2" value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label="Student" data-testid="room-student">{people.map((p) => <option key={p.id} value={p.id}>{p.firstName}</option>)}</select>
          {more.filter((x) => x !== studentId).map((x) => <button key={x} type="button" className="chip !py-1.5" aria-pressed onClick={() => setMore(more.filter((y) => y !== x))} data-testid="room-group-member">{nameOf(x)} <Icon name="x" size={13} /></button>)}
          {people.length > groupIds.length && (
            <select className="input !w-auto !py-2 text-sm" value="" onChange={(e) => { if (e.target.value) setMore([...more, e.target.value]); }} aria-label="Add a student to make it a group lesson" data-testid="room-group-add">
              <option value="">+ Add a student (group lesson)</option>
              {people.filter((x) => !groupIds.includes(x.id)).map((x) => <option key={x.id} value={x.id}>{x.firstName}</option>)}
            </select>
          )}
          {student && <span className="rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-ink/10" data-testid="room-student-level">Level <b>{student.level}</b> · instructions in <b>{WORDING_LABEL[wordingFor(student.level)].toLowerCase()}</b></span>}
        </div>
        {none && <p className="mb-3 rounded-2xl bg-saffron-50 px-4 py-3 text-sm ring-1 ring-saffron/40">Add a student first (Students, Add a student). A lesson is always for one student, even a practice one.</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <StartCard primary icon="sparkle" tone="" title="Draft it from their week" text="A warm-up, their hardest point with their own mistakes, the exact forms they missed, a wrap-up." onClick={() => void create('draft')} disabled={busy || !studentId} testid="room-draft" />
          <StartCard icon="eye" tone="bg-saffron-50 text-ink" title="Open an example lesson" text="A finished seven-part lesson on the preterite of ir and ser, to try the room with." onClick={() => void create('example')} disabled={busy || !studentId} testid="room-example" />
          <StartCard icon="edit" tone="bg-cream-100 text-ink-soft" title="Start blank" text="An empty lesson. Add the parts yourself." onClick={() => void create('blank')} disabled={busy || !studentId} testid="room-blank" />
        </div>
        {groupIds.length > 1 && <p className="mt-2 rounded-2xl bg-olive-50 px-4 py-2.5 text-sm ring-1 ring-olive/30" data-testid="room-group-note"><b>A group lesson for {groupIds.map(nameOf).join(', ')}.</b> Each of them joins on their own device and answers for themselves. Your screen shows who has answered, and tells you when everyone has.</p>}
        <p className="mt-2 text-sm text-ink-mute">Or use one of your plans below: press “Use for {student?.name ?? 'your student'}”.</p>
      </section>

      <section className="mt-8" data-testid="room-library">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-2xl font-semibold">My lesson plans{waiting > 0 && <span className="ml-2 rounded-full bg-saffron px-2.5 py-1 align-middle text-xs font-bold text-ink" data-testid="library-waiting">{waiting} to review</span>}</h2>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,application/pdf,text/plain" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} data-testid="room-file" />
          <button type="button" className="btn-primary !py-2.5" disabled={busy} onClick={() => fileRef.current?.click()} data-testid="room-upload"><Icon name="upload" size={16} /> {busy ? 'Reading your plan…' : 'Upload a plan'}</button>
          <button type="button" className="btn-ghost !py-2.5" disabled={busy} onClick={() => setPasting(!pasting)} data-testid="room-paste-toggle"><Icon name="copy" size={16} /> Paste a plan</button>
        </div>
        {pasting && (
          <div className="card mb-3 p-4" data-testid="room-import">
            <label className="font-semibold" htmlFor="room-paste">Paste your lesson plan</label>
            <textarea id="room-paste" className="input mt-2 min-h-[180px] w-full" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={'El pretérito: ir y ser\n\nCalentamiento\n¿Qué hiciste el fin de semana?\n\nPráctica:\nAyer yo ___ (ir) al mercado. [fui]\n\nVocabulario\nayer = yesterday\nanoche = last night'} data-testid="room-paste" />
            <button type="button" className="btn-primary mt-2" disabled={busy || !pasted.trim()} onClick={() => void file(pasted, 'your pasted plan', 'Lesson')} data-testid="room-paste-go"><Icon name="eye" size={16} /> Review it</button>
          </div>
        )}
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Level">
          {(['all', ...LEVELS] as (Cefr | 'all')[]).map((l) => { const n = l === 'all' ? plans.length : plans.filter((p) => p.level === l).length; return <button key={l} type="button" className="chip !py-1.5 text-sm" aria-pressed={filter === l} onClick={() => setFilter(l)} data-testid={`library-${l}`}>{l === 'all' ? 'All levels' : l} <span className="opacity-60">{n}</span>{l === student?.level ? <span className="ml-1 text-xs opacity-70">· {student.name}</span> : null}</button>; })}
        </div>
        {allTopics.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Topic">
            <span className="mr-1 text-sm font-semibold text-ink-soft">Topic</span>
            <button type="button" className="chip !py-1.5 text-sm" aria-pressed={!topic} onClick={() => setTopic('')}>All</button>
            {allTopics.map((t) => <button key={t} type="button" className="chip !py-1.5 text-sm" aria-pressed={topic === t} onClick={() => setTopic(topic === t ? '' : t)} data-testid="library-topic">{t} <span className="opacity-60">{plans.filter((p) => p.topic === t).length}</span></button>)}
          </div>
        )}
        {!library.data ? <Loading /> : shown.length === 0 ? (
          <p className="card p-6 text-center text-ink-soft" data-testid="library-none">{plans.length === 0 ? 'No plans yet. Upload one you already have: it is built into a lesson, filed under its level and waits here for you to review.' : 'No plans match that level and topic.'}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.map((p) => (
              <li key={p.id} className={`rounded-3xl bg-white p-4 ring-1 ${p.status === 'review' ? 'ring-2 ring-saffron/70' : 'ring-ink/10'}`} data-testid="library-plan" data-status={p.status}>
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-azul-50 font-display text-lg font-semibold text-azul">{p.level}</span>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[16px]">{p.title}</b>
                    <span className="block text-sm text-ink-mute">{p.topic ? <span className="mr-1 rounded-full bg-cream-100 px-2 py-0.5 text-xs font-semibold text-ink-soft">{p.topic}</span> : null}{p.minutes ? `${p.minutes} min · ` : ''}{p.blocks.length} parts{p.source ? ` · from ${p.source}` : ''}</span>
                    <span className="mt-1.5 block"><PartChips blocks={p.blocks} /></span>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${p.status === 'review' ? 'bg-saffron text-ink' : 'bg-olive text-white'}`}>{p.status === 'review' ? 'To review' : 'Ready'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="ctrl" onClick={() => { setReview({ plan: p, adapted: [] }); window.scrollTo({ top: 0 }); }} data-testid="library-review"><Icon name="edit" size={14} /> {p.status === 'review' ? 'Review' : 'Open'}</button>
                  <button type="button" className={p.status === 'ready' ? 'btn-primary !py-2' : 'ctrl'} disabled={busy || !studentId} onClick={() => void usePlan(p, false)} data-testid="library-use"><Icon name="video" size={14} /> Use for {student?.name ?? 'student'}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <a href={`${import.meta.env.BASE_URL}guides/lesson-plan-template.docx`} download className="flex items-center gap-3 rounded-2xl bg-azul-50 px-4 py-3 text-sm ring-1 ring-azul/20 transition hover:ring-azul/50" data-testid="room-template">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-azul"><Icon name="download" size={17} /></span>
            <span className="min-w-0 flex-1"><b className="block text-ink">Download the Word template</b><span className="text-ink-soft">A plan laid out the right way, with a page explaining what you can write.</span></span>
          </a>
          <details className="rounded-2xl bg-white px-4 py-3 text-sm text-ink-soft ring-1 ring-ink/5">
            <summary className="cursor-pointer font-semibold text-ink">How a plan is built into a lesson</summary>
            <ul className="mt-2 grid gap-1.5">
              <li><b className="text-ink">Timed stages</b> (“0–8 mins, Stage 1”) set the order and how much each stage holds.</li>
              <li><b className="text-ink">A table of phrases</b> becomes cards to hear, then quick checks made from those phrases.</li>
              <li><b className="text-ink">Questions you are told to ask</b> become speaking turns, each with the words to start the answer.</li>
              <li><b className="text-ink">Worksheet exercises</b> go where your procedure uses them, marked from your answer key.</li>
              <li><b className="text-ink">Writing tasks and role-play cards</b> are released a step or a round at a time.</li>
              <li><b className="text-ink">Timings, board work and pronunciation points</b> go to your own notes.</li>
              <li><b className="text-ink">A simpler plan</b> is read line by line: ___ is a gap, a) b) c) is a choice, a question mark is a question, “word = meaning” is a word list.</li>
            </ul>
          </details>
        </div>
        <ErrorText error={error} />
      </section>

      <h2 className="mb-3 mt-8 text-2xl font-semibold">Your lessons</h2>
      {!lessons.data ? <Loading /> : lessons.data.length === 0 ? <p className="card p-6 text-center text-ink-soft" data-testid="room-none">No lessons yet. Start one above: the example lesson is the quickest way to see how the room works.</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {lessons.data.filter((l) => !(groups.data ?? []).some((g) => g.members.slice(1).some((m) => m.lessonId === l.id))).map((l) => { const g = (groups.data ?? []).find((x) => x.members[0]?.lessonId === l.id); const who = g ? g.members.map((m) => nameOf(m.studentId)).join(', ') : nameOf(l.studentId); return (
            <li key={l.id}>
              <button type="button" onClick={() => navigate(`teach/room/${l.id}`)} className={`flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-soft ${l.live.on ? 'ring-2 ring-olive' : 'ring-ink/10'}`} data-testid="room-open">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${l.live.on ? 'bg-olive text-white' : 'bg-cream-100 text-ink-soft'}`}><Icon name={l.live.on ? 'video' : 'book'} size={22} /></span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[16px]">{l.title}</b>
                  <span className="block text-sm text-ink-mute">{g ? <span className="mr-1 rounded-full bg-olive-50 px-2 py-0.5 text-xs font-bold text-olive">Group</span> : null}{who} · {new Date(`${l.date || l.createdAt.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}{l.live.on ? ' · running now' : ''}</span>
                  <span className="mt-1.5 block"><PartChips blocks={l.blocks} /></span>
                </span>
                <Icon name="arrowRight" size={16} className="shrink-0 text-ink-mute" />
              </button>
            </li>
          ); })}
        </ul>
      )}
    </div>
  );
}

function BlockEditor({ b, i, n, onChange, onMove, onDelete, onDuplicate, flag }: { b: LessonBlock; i: number; n: number; onChange: (b: LessonBlock) => void; onMove: (d: -1 | 1) => void; onDelete: () => void; onDuplicate: () => void; flag?: boolean }) {
  const set = (patch: Partial<LessonBlock>) => onChange({ ...b, ...patch });
  const [preview, setPreview] = useState(false);
  const st = TYPE_STYLE[b.type];
  return (
    <li className={`relative overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ${flag ? 'ring-2 ring-saffron' : 'ring-ink/5'}`} data-testid="block-editor" data-type={b.type} data-flag={flag || undefined}>
      <span className={`absolute inset-y-0 left-0 w-1.5 ${st.bar}`} aria-hidden />
      <div className="p-4 pl-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${st.tile}`}><Icon name={st.icon} size={17} /></span>
          <span className="text-sm font-bold tabular-nums text-ink-mute">{i + 1}</span>
          <select className="input !w-44 !py-1.5 text-sm font-semibold" value={b.type} onChange={(e) => set({ ...newBlock(e.target.value as LessonBlock['type']), id: b.id, title: b.title, body: b.body, open: b.open })} aria-label="Kind of part" data-testid="block-type">{TYPES.map((t) => <option key={t} value={t}>{BLOCK_LABEL[t]}</option>)}</select>
          <input className="input min-w-0 flex-1 basis-48 !py-1.5" value={b.title} onChange={(e) => set({ title: e.target.value })} placeholder="Heading" aria-label="Heading" />
          <div className="flex gap-1">
            <button type="button" className={`ctrl !px-2.5 ${preview ? '!bg-ink !text-cream' : ''}`} onClick={() => setPreview(!preview)} aria-pressed={preview} aria-label="Preview this part as your student sees it" title="Preview"><Icon name="eye" size={14} /></button>
            <button type="button" className="ctrl !px-2.5" disabled={i === 0} onClick={() => onMove(-1)} aria-label="Move up">↑</button>
            <button type="button" className="ctrl !px-2.5" disabled={i === n - 1} onClick={() => onMove(1)} aria-label="Move down">↓</button>
            <button type="button" className="ctrl !px-2.5" onClick={onDuplicate} aria-label="Duplicate"><Icon name="copy" size={14} /></button>
            <button type="button" className="ctrl !px-2.5 hover:!text-terracotta-dark" onClick={onDelete} aria-label="Delete this part"><Icon name="trash" size={14} /></button>
          </div>
        </div>
        {b.type !== 'vocab' && <textarea className="input mt-3 min-h-[70px] w-full text-[16px]" value={b.body} onChange={(e) => set({ body: e.target.value })} placeholder={b.type === 'gap' ? 'The sentence, with ___ where the answer goes' : b.type === 'text' ? 'What you want to show or explain' : 'The question'} lang="es" spellCheck={false} data-testid="block-body" />}
        {b.type === 'gap' && <label className="mt-2 grid gap-1 text-sm font-medium">Right answer <span className="font-normal text-ink-mute">(more than one? separate with |)</span><input className={`input ${flag ? '!ring-2 !ring-saffron' : ''}`} value={b.answer ?? ''} onChange={(e) => set({ answer: e.target.value })} placeholder="fui" lang="es" data-testid="block-answer" /></label>}
        {b.type === 'choice' && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">Options <span className="font-normal text-ink-mute">(one per line)</span><textarea className="input min-h-[84px]" value={(b.options ?? []).join('\n')} onChange={(e) => set({ options: e.target.value.split('\n') })} lang="es" data-testid="block-options" /></label>
            <label className="grid content-start gap-1 text-sm font-medium">Right answer<select className={`input ${flag ? '!ring-2 !ring-saffron' : ''}`} value={b.answer ?? ''} onChange={(e) => set({ answer: e.target.value })} data-testid="block-answer"><option value="">Choose…</option>{(b.options ?? []).filter((o) => o.trim()).map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
          </div>
        )}
        {b.type === 'vocab' && <label className="mt-3 grid gap-1 text-sm font-medium">Words <span className="font-normal text-ink-mute">(one per line: español = English)</span><textarea className="input min-h-[110px]" value={(b.pairs ?? []).map((p) => `${p.es} = ${p.en}`).join('\n')} onChange={(e) => set({ pairs: e.target.value.split('\n').map((l) => { const [es, ...en] = l.split('='); return { es: es.trim(), en: en.join('=').trim() }; }) })} lang="es" data-testid="block-pairs" /></label>}
        {flag && <p className="mt-2 text-sm font-semibold text-ink" role="status">No answer was found in your plan for this one. Add it above.</p>}
        {preview && <div className="mt-3 rounded-3xl bg-cream-100 p-3"><p className="eyebrow mb-2">As your student sees it</p><BlockView block={b} mode="present" wording="both" /></div>}
      </div>
    </li>
  );
}

/** Send the tasks of a lesson to the student as homework, to do on their own afterwards. */
function SendHomework({ plan, name, studentIds }: { plan: LessonPlan; name: string; studentIds: string[] }) {
  const { backend, bump } = usePlatform();
  const { notify } = useStore();
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = homeworkItems(plan.blocks);
  const marked = items.filter((i) => i.kind !== 'question').length;
  const send = async () => {
    if (!backend) return;
    setBusy(true); setError(null);
    try {
      await backend.assignHomework({ studentIds, activity: { kind: 'material', title: `From our lesson: ${plan.title}`, material: homeworkFromLesson(plan.title, plan.blocks) }, instructions: note.trim() || 'The tasks from our lesson, to do again on your own.', dueAt: new Date(`${due}T20:00:00`).toISOString() });
      bump(); setSent(true); setOpen(false); notify(`Homework sent to ${name}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send the homework.'); }
    setBusy(false);
  };
  return (
    <section className="card p-4" data-testid="lesson-homework">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-saffron-50 text-ink"><Icon name="book" size={18} /></span>
        <div className="min-w-0 flex-1 basis-56">
          <b className="block">Send the tasks as homework</b>
          <span className="text-sm text-ink-soft" data-testid="lesson-homework-count">{items.length === 0 ? 'This lesson has no tasks yet. Add a gap, a multiple choice or a question with its answer.' : `${items.length} task${items.length === 1 ? '' : 's'} for ${name} to do alone: ${marked} marked by the app${items.length - marked ? `, ${items.length - marked} for you to mark` : ''}. Explanations are left out.`}</span>
        </div>
        {sent ? <span className="rounded-full bg-olive-50 px-4 py-2 text-sm font-semibold text-olive" data-testid="lesson-homework-sent">Sent. It is in Homework.</span> : <button type="button" className="btn-soft" disabled={items.length === 0} onClick={() => setOpen(!open)} data-testid="lesson-homework-open">Send as homework</button>}
      </div>
      {open && !sent && (
        <div className="mt-3 grid gap-3 border-t border-ink/5 pt-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-sm font-medium">Due<input type="date" className="input" value={due} min={today()} onChange={(e) => setDue(e.target.value)} data-testid="lesson-homework-due" /></label>
          <label className="grid gap-1 text-sm font-medium">A note for {name} <span className="font-normal text-ink-mute">(optional)</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="The tasks from our lesson, to do again on your own." /></label>
          <button type="button" className="btn-primary" disabled={busy || !due} onClick={() => void send()} data-testid="lesson-homework-send">{busy ? 'Sending…' : `Send ${items.length} task${items.length === 1 ? '' : 's'}`}</button>
        </div>
      )}
      <ErrorText error={error} />
    </section>
  );
}

/** One lesson for the teacher: the plan she edits beforehand, and the view she shares during the lesson. */
export function TeacherRoom({ id }: { id: string }) {
  const { backend } = usePlatform();
  const { notify } = useStore();
  const students = useStudents();
  const { plan: remote, work, now, error: syncError, loaded } = useLesson(id);
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [tab, setTab] = useState<'plan' | 'present'>('plan');
  const [saved, setSaved] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [error, setError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const timer = useRef<number>();
  const latest = useRef<LessonPlan | null>(null);
  // The teacher's copy is the one that counts: it is loaded once and then only she changes it.
  useEffect(() => { if (remote && !plan) { setPlan(remote); latest.current = remote; if (remote.live.on) setTab('present'); } }, [remote, plan]);

  // Group lessons: the other students' copies, and their answers.
  const groupsQ = usePlatformQuery((b) => b.lessonGroups(), []);
  const group = groupsQ.data?.find((g) => g.members.some((m) => m.lessonId === id)) ?? null;
  const others = useMemo(() => (group ? group.members.filter((m) => m.lessonId !== id) : []), [group, id]);
  const othersRef = useRef(others); othersRef.current = others;
  const groupWork = useGroupWork(others.map((m) => m.lessonId), tab === 'present');
  const doneFor = useRef(new Set<string>());
  const save = async (p: LessonPlan) => {
    if (!backend) return;
    setSaved('saving');
    try {
      await backend.saveLesson({ id: p.id, studentId: p.studentId, title: p.title, date: p.date, notes: p.notes, blocks: p.blocks, live: p.live });
      // A group lesson: every student's copy is kept the same as this one.
      await Promise.all(othersRef.current.map((m) => backend.saveLesson({ id: m.lessonId, studentId: m.studentId, title: p.title, date: p.date, notes: p.notes, blocks: p.blocks, live: p.live })));
      if (latest.current === p) setSaved('saved'); setError(null);
    }
    catch (e) { setSaved('unsaved'); setError(e instanceof Error ? e.message : 'Could not save.'); }
  };
  /** Changes the plan. Typing is saved a moment after the last key; anything the student should see at once (`now`) is saved straight away. */
  const change = (fn: (p: LessonPlan) => LessonPlan, immediate = false) => {
    if (!plan) return;
    const next = fn(plan);
    setPlan(next); latest.current = next; setSaved('unsaved');
    window.clearTimeout(timer.current);
    if (immediate) void save(next); else timer.current = window.setTimeout(() => void save(next), 700);
  };
  useEffect(() => () => { window.clearTimeout(timer.current); if (latest.current && saved !== 'saved') void save(latest.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const name = useMemo(() => students.data?.people.find((p) => p.id === plan?.studentId)?.firstName ?? 'your student', [students.data, plan?.studentId]);
  // The student's level decides how much English the lesson's small words use.
  const settingsQ = usePlatformQuery((b) => (remote?.studentId ? b.studentSettings(remote.studentId) : Promise.resolve(null)), [remote?.studentId]);
  // The stage can fill the whole screen for sharing on a call, and the arrow keys move through the lesson.
  const stageRef = useRef<HTMLElement>(null);
  const [full, setFull] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [hideNames, setHideNames] = useState(false);
  useEffect(() => { const on = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', on); return () => document.removeEventListener('fullscreenchange', on); }, []);
  const keyNav = useRef<(d: number) => void>(() => undefined);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.target as HTMLElement | null)?.closest('input,textarea,select')) return; if (e.key === 'ArrowRight') keyNav.current(1); else if (e.key === 'ArrowLeft') keyNav.current(-1); };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  }, []);

  if (!loaded || (!plan && !syncError)) return <Loading />;
  if (!plan) return <div className="card p-6"><p>{syncError ?? 'Lesson not found.'}</p><button className="btn-primary mt-3" onClick={() => navigate('teach/room')}>Back to the lesson room</button></div>;

  const here = isPresent(work, now);
  // Everyone in the lesson, with their answers: one person, or the whole group.
  const firstName = (sid: string) => students.data?.people.find((x) => x.id === sid)?.firstName ?? 'Student';
  const everyone = [{ studentId: plan.studentId, name: firstName(plan.studentId), work, here }, ...others.map((m) => ({ studentId: m.studentId, name: firstName(m.studentId), work: groupWork[m.lessonId]?.work ?? null, here: isPresent(groupWork[m.lessonId]?.work, groupWork[m.lessonId]?.now ?? now) }))];
  const isGroup = everyone.length > 1;
  const answeredBy = (bid: string) => everyone.filter((e) => e.work?.answers[bid]);
  // What the trail shows for a group: a part counts as answered when everyone has, and right when everyone was right.
  const merged: Record<string, LessonAnswer> = {};
  if (isGroup) for (const b of plan.blocks) { const got = answeredBy(b.id); if (got.length === everyone.length) merged[b.id] = { value: '', at: '', ...(got.every((e) => e.work!.answers[b.id].correct !== undefined) ? { correct: got.every((e) => e.work!.answers[b.id].correct === true) } : {}) }; }
  const setBlock = (bid: string, patch: Partial<LessonBlock>, immediate = false) => change((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === bid ? { ...b, ...patch } : b)) }), immediate);
  const cur = plan.blocks.find((b) => b.id === plan.live.current) ?? null;
  const idx = cur ? plan.blocks.indexOf(cur) : -1;
  const go = (b: LessonBlock, alsoOpen = false) => change((p) => ({ ...p, blocks: alsoOpen ? p.blocks.map((x) => (x.id === b.id ? { ...x, open: true } : x)) : p.blocks, live: { ...p.live, current: b.id } }), true);
  const openCount = plan.blocks.filter((b) => b.open).length;
  // Tell the teacher, once for each part, when the whole group has answered it.
  if (isGroup && cur && (cur.type !== 'text' && cur.type !== 'vocab') && answeredBy(cur.id).length === everyone.length && !doneFor.current.has(cur.id)) {
    doneFor.current.add(cur.id);
    window.setTimeout(() => { sfx.win(); notify('Everyone has answered', `All ${everyone.length} are in for part ${idx + 1}.`); }, 0);
  }
  const studentLevel = levelOf(settingsQ.data, students.data?.progress[plan.studentId]);
  const wording = wordingFor(studentLevel);
  const planStages = stagesOf(plan.blocks);
  const plannedMinutes = planStages.reduce((n, st) => n + st.minutes, 0);
  const toggleFull = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void stageRef.current?.requestFullscreen?.().catch(() => undefined); };
  keyNav.current = (d) => { if (tab !== 'present' || idx < 0) return; const b = plan.blocks[idx + d]; if (b) go(b, d > 0 && !!cur?.open && autoOpen); };

  return (
    <div data-testid="teacher-room">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" className="ctrl" onClick={() => navigate('teach/room')}><Icon name="arrowLeft" size={14} /> Lesson room</button>
        <Segmented label="View" value={tab} onChange={setTab} options={[{ value: 'plan', label: 'Plan' }, { value: 'present', label: 'Present' }]} />
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${here ? 'bg-olive-50 text-olive ring-olive/40' : 'bg-white text-ink-mute ring-ink/10'}`} data-testid="presence" data-here={isGroup ? everyone.every((e) => e.here) : here} title={isGroup ? everyone.map((e) => `${e.name}: ${e.here ? 'here' : 'not here'}`).join(', ') : undefined}><span className={`h-2 w-2 rounded-full ${here ? 'bg-olive' : 'bg-ink/25'}`} /> {isGroup ? `${everyone.filter((e) => e.here).length} of ${everyone.length} here` : here ? `${name} is here` : `${name} is not in the lesson`}</span>
        <span className="ml-auto text-sm text-ink-mute" data-testid="save-state">{saved === 'saved' ? 'Saved' : saved === 'saving' ? 'Saving…' : 'Not saved yet'}</span>
      </div>
      <ErrorText error={error ?? syncError} />

      {tab === 'plan' && (
        <div className="grid gap-4">
          <PlanFacts rows={[
            ['For', <span key="f" data-testid="plan-for">{isGroup ? `${everyone.map((e) => e.name).join(', ')} · a group of ${everyone.length}` : `${name} · level ${studentLevel}`}</span>],
            ['Instructions written in', <select key="w" className="input !py-1.5" defaultValue={wording} onChange={(e) => change((p) => ({ ...p, blocks: reword(p.blocks, e.target.value as Wording) }))} data-testid="plan-wording">{(['en', 'both', 'es'] as Wording[]).map((x) => <option key={x} value={x}>{WORDING_LABEL[x]}{x === wording ? ` (suits ${studentLevel})` : ''}</option>)}</select>],
            ['Planned time', plannedMinutes ? `${plannedMinutes} minutes · ${planStages.length} stages` : 'No timings'],
            ['Parts', `${plan.blocks.length}, ${plan.blocks.filter((b) => b.type === 'gap' || b.type === 'choice').length} marked by the app`],
          ]} />
          <section className="card grid gap-3 p-5 sm:grid-cols-[1fr_auto]">
            <label className="grid gap-1 text-sm font-medium">Title<input className="input text-lg" value={plan.title} onChange={(e) => change((p) => ({ ...p, title: e.target.value }))} data-testid="room-title" /></label>
            <label className="grid gap-1 text-sm font-medium">Day<input type="date" className="input" value={plan.date ?? ''} onChange={(e) => change((p) => ({ ...p, date: e.target.value }))} /></label>
            <label className="grid gap-1 text-sm font-medium sm:col-span-2">Your own notes <span className="font-normal text-ink-mute">(only you see these: they are never sent to {name}, and they stay hidden on the Present screen unless you open them)</span><textarea className="input min-h-[70px]" value={plan.notes ?? ''} onChange={(e) => change((p) => ({ ...p, notes: e.target.value }))} data-testid="room-notes" /></label>
          </section>
          <ol className="grid gap-3">
            {plan.blocks.map((b, i) => (
              <BlockEditor key={b.id} b={b} i={i} n={plan.blocks.length} onChange={(nb) => change((p) => ({ ...p, blocks: p.blocks.map((x) => (x.id === b.id ? nb : x)) }))}
                onMove={(d) => change((p) => { const arr = [...p.blocks]; const j = i + d; [arr[i], arr[j]] = [arr[j], arr[i]]; return { ...p, blocks: arr }; })}
                onDelete={() => change((p) => ({ ...p, blocks: p.blocks.filter((x) => x.id !== b.id), live: { ...p.live, current: p.live.current === b.id ? null : p.live.current } }))}
                onDuplicate={() => change((p) => { const arr = [...p.blocks]; arr.splice(i + 1, 0, { ...b, id: newBlock(b.type).id, open: false, reveal: false }); return { ...p, blocks: arr }; })} />
            ))}
          </ol>
          <div className="card flex flex-wrap items-center gap-2 p-4">
            <span className="mr-1 text-sm font-semibold">Add a part:</span>
            {TYPES.map((t) => <button key={t} type="button" className="ctrl" onClick={() => change((p) => ({ ...p, blocks: [...p.blocks, newBlock(t)] }))} data-testid={`add-${t}`}><Icon name="plus" size={14} /> {BLOCK_LABEL[t]}</button>)}
          </div>
          <SendHomework plan={plan} name={isGroup ? 'the group' : name} studentIds={everyone.map((e) => e.studentId)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => setTab('present')} data-testid="to-present"><Icon name="video" size={18} /> Go to the Present screen</button>
            <button type="button" className="btn-ghost" onClick={async () => { if (!backend || !window.confirm('Delete this lesson and the answers given in it?')) return; await backend.deleteLesson(plan.id); await Promise.all(others.map((m) => backend.deleteLesson(m.lessonId))); if (group) await backend.deleteLessonGroup(group.id); notify('Lesson deleted'); navigate('teach/room'); }}><Icon name="trash" size={16} /> Delete this lesson</button>
          </div>
        </div>
      )}

      {tab === 'present' && (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="grid min-w-0 content-start gap-3">
            <div className="card p-4">
              {plan.live.on ? (
                <button type="button" className="btn-ghost w-full justify-center" onClick={() => change((p) => ({ ...p, live: { ...p.live, on: false } }), true)} data-testid="end-lesson"><Icon name="stop" size={16} /> End the lesson</button>
              ) : (
                <button type="button" className="btn-primary w-full justify-center" onClick={() => change((p) => ({ ...p, live: { on: true, current: p.live.current ?? p.blocks[0]?.id ?? null, startedAt: new Date().toISOString() } }), true)} data-testid="start-lesson"><Icon name="video" size={18} /> Start the lesson</button>
              )}
              <p className="mt-2 text-xs text-ink-mute">{plan.live.on ? `${name}’s phone is told the lesson is open. They join from their home page.` : `Starting tells ${name}’s phone the lesson is open. Nothing is shown to them until you open a part.`}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button type="button" className="ctrl" onClick={() => change((p) => ({ ...p, blocks: p.blocks.map((b) => ({ ...b, open: true })) }), true)} data-testid="open-all">Open all</button>
                <button type="button" className="ctrl" onClick={() => change((p) => ({ ...p, blocks: p.blocks.map((b) => ({ ...b, open: false })) }), true)}>Close all</button>
              </div>
              <p className="mt-2 text-xs text-ink-mute">{openCount} of {plan.blocks.length} parts open to {name}.</p>
            </div>
            <ol className="grid min-w-0 gap-1.5" data-testid="block-list">
              {plan.blocks.map((b, i) => {
                const a = isGroup ? undefined : work?.answers[b.id];
                const got = isGroup ? answeredBy(b.id).length : 0;
                return (
                  <li key={b.id} className={`flex min-w-0 items-center gap-2 overflow-hidden rounded-2xl p-2 ring-1 ${cur?.id === b.id ? 'bg-terracotta-50 ring-terracotta/50' : 'bg-white ring-ink/5'}`}>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => go(b)} data-testid={`goto-${i}`}>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${BLOCK_THEME[b.type].badge}`}>{i + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{b.title || BLOCK_LABEL[b.type]}</span><span className="block truncate text-xs text-ink-mute">{BLOCK_LABEL[b.type]}{a ? ` · answered${a.correct === true ? ' ✓' : a.correct === false ? ' ✗' : ''}` : ''}{isGroup && got ? ` · ${got}/${everyone.length} answered` : ''}</span></span>
                    </button>
                    <button type="button" className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${b.open ? 'bg-olive text-white' : 'bg-cream-100 text-ink-soft'}`} onClick={() => setBlock(b.id, { open: !b.open }, true)} aria-pressed={!!b.open} aria-label={`${b.open ? 'Close' : 'Open'} part ${i + 1} ${b.open ? 'to' : 'for'} ${name}`} data-testid={`toggle-${i}`}>{b.open ? 'Open' : 'Closed'}</button>
                  </li>
                );
              })}
            </ol>
            <div className="card p-4">
              <button type="button" className="ctrl" onClick={() => setShowNotes(!showNotes)} aria-expanded={showNotes}><Icon name="eye" size={14} /> {showNotes ? 'Hide my notes' : 'My notes'}</button>
              {showNotes && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{plan.notes?.trim() || 'No notes for this lesson.'}</p>}
              <p className="mt-2 text-xs text-ink-mute">If you are sharing your whole screen, your notes are visible while open.</p>
            </div>
          </aside>

          <section ref={stageRef} className={`min-w-0 ${full ? 'flex h-full flex-col overflow-y-auto bg-cream p-5 sm:p-8' : ''}`} data-testid="stage">
            {cur ? (
              <>
                <div className="mb-3 rounded-3xl bg-white p-3 shadow-soft ring-1 ring-ink/5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-cream">{idx + 1} / {plan.blocks.length}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cur.open ? 'bg-olive text-white' : 'bg-saffron text-ink'}`} data-testid="stage-status">{cur.open ? `${isGroup ? 'Everyone' : name} can see this` : `Only you can see this`}</span>
                    {!cur.open && <button type="button" className="btn-primary !py-2" onClick={() => go(cur, true)} data-testid="show-to-student"><Icon name="eye" size={16} /> Show it to {isGroup ? 'everyone' : name}</button>}
                    {(cur.type === 'gap' || cur.type === 'choice') && <button type="button" className="ctrl" onClick={() => setBlock(cur.id, { reveal: !cur.reveal }, true)} aria-pressed={!!cur.reveal} data-testid="reveal">{cur.reveal ? 'Hide the answer' : 'Show the answer'}</button>}
                    <span className="ml-auto"><LessonClock startedAt={plan.live.on ? plan.live.startedAt : undefined} blocks={plan.blocks} current={cur.id} /></span>
                    <button type="button" className="ctrl" onClick={toggleFull} data-testid="stage-full"><Icon name="video" size={14} /> {full ? 'Leave full screen' : 'Full screen to share'}</button>
                  </div>
                  <div className="mt-3"><LessonTrail blocks={plan.blocks} answers={isGroup ? merged : work?.answers} current={cur.id} onGo={(bid) => { const b = plan.blocks.find((x) => x.id === bid); if (b) go(b); }} /></div>
                </div>
                <div className={full ? 'mx-auto w-full max-w-5xl flex-1' : ''}><BlockView key={cur.id} block={cur} mode="present" answer={isGroup ? undefined : work?.answers[cur.id]} current wording={wording} />
                  {isGroup && cur.type !== 'text' && cur.type !== 'vocab' && (() => {
                    const got = answeredBy(cur.id); const all = got.length === everyone.length;
                    return (
                      <div className={`mt-3 rounded-3xl p-4 ring-1 ${all ? 'bg-olive-50 ring-olive/40' : 'bg-white ring-ink/5'}`} data-testid="group-answers" data-all={all || undefined}>
                        <div className="flex flex-wrap items-center gap-3">
                          <b className="text-lg">{all ? 'Everyone has answered' : `${got.length} of ${everyone.length} answered`}</b>
                          <span className="flex h-2.5 min-w-[8rem] flex-1 overflow-hidden rounded-full bg-ink/10"><span className="rounded-full bg-olive transition-all" style={{ width: `${(got.length / everyone.length) * 100}%` }} /></span>
                          {!all && <span className="text-sm text-ink-mute">Waiting for {everyone.filter((e) => !e.work?.answers[cur.id]).map((e) => e.name).join(', ')}</span>}
                        </div>
                        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                          {everyone.map((e) => { const a = e.work?.answers[cur.id]; return (
                            <li key={e.studentId} className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 ring-1 ${!a ? 'bg-cream-100 ring-transparent' : a.correct === true ? 'bg-olive-50 ring-olive/30' : a.correct === false ? 'bg-terracotta-50 ring-terracotta/30' : 'bg-azul-50 ring-azul/20'}`} data-testid="group-answer" data-answered={!!a || undefined}>
                              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white font-bold shadow-soft">{e.name[0]}<span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${e.here ? 'bg-olive' : 'bg-ink/25'}`} /></span>
                              <span className="min-w-0 flex-1"><b className="block text-sm">{e.name}</b><span className="block break-words text-lg" lang="es">{a ? (hideNames ? '•••' : a.value) : <span className="text-base text-ink-mute">…</span>}</span></span>
                              {a?.correct === true && <Icon name="check" size={18} className="mt-1 shrink-0 text-olive" />}{a?.correct === false && <Icon name="x" size={18} className="mt-1 shrink-0 text-terracotta-dark" />}
                            </li>
                          ); })}
                        </ul>
                        <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={hideNames} onChange={(ev) => setHideNames(ev.target.checked)} /> Hide the answers until I am ready to show them</label>
                      </div>
                    );
                  })()}
                </div>
                <div className={`mt-4 flex items-center gap-2 ${full ? 'mx-auto w-full max-w-5xl' : ''}`}>
                  <button type="button" className="btn-ghost" disabled={idx <= 0} onClick={() => go(plan.blocks[idx - 1])}><Icon name="arrowLeft" size={16} /> Back</button>
                  <button type="button" className="btn-dark" disabled={idx >= plan.blocks.length - 1} onClick={() => go(plan.blocks[idx + 1], cur.open && autoOpen)} data-testid="next-part">Next <Icon name="arrowRight" size={16} /></button>
                  <label className="ml-2 flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={autoOpen} onChange={(e) => setAutoOpen(e.target.checked)} data-testid="auto-open" /> Show each part to {isGroup ? 'everyone' : name} as I go</label>
                  <span className="ml-auto hidden text-xs text-ink-mute sm:inline">← → keys also move</span>
                </div>
              </>
            ) : <div className="card p-8 text-center text-ink-soft">{plan.blocks.length ? 'Choose a part on the left to put it on the screen.' : 'This lesson has no parts yet. Add some on the Plan tab.'}</div>}
          </section>
        </div>
      )}
    </div>
  );
}
