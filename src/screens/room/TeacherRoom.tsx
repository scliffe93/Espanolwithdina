import { useEffect, useMemo, useRef, useState } from 'react';
import { DinaArt } from '../../components/Dina';
import { Icon, type IconName } from '../../components/Icon';
import { Segmented, Sheet } from '../../components/ui';
import { isPresent } from '../../../supabase/functions/_shared/lesson';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { BLOCK_LABEL, draftLesson, exampleLesson, newBlock } from '../../lib/platform/lessonDraft';
import { homeworkFromLesson, homeworkItems } from '../../lib/platform/lessonHomework';
import { WORDING_LABEL, adaptPlan, detectWording, reword, stageOf, type Wording } from '../../lib/platform/lessonAdapt';
import { overallLevel } from '../../lib/platform/level';
import { describeImport, type ImportedPlan } from '../../lib/platform/lessonImport';
import { extractText, sourceKindOf } from '../../lib/extractText';
import type { LessonAnswer, LessonBlock, LessonPlan, LibraryPlan, StudentGroup, StudentSettings } from '../../lib/platform/types';
import type { AppState, Cefr } from '../../types';
import { navigate } from '../../lib/router';
import { useStore } from '../../lib/store';
import { ErrorText, Loading, useStudents } from '../teach/shared';
import { BLOCK_THEME, BlockView, LessonClock, LessonTrail } from './Blocks';
import { useGroupWork, useLesson } from './useLesson';
import { Whiteboard } from './Whiteboard';
import { SYS, bankCandidates, bankOf, releaseVerbsTo, boardOf, draftSummary, isSystem, partsOf, summaryOf, withBank, withBoard, withNotes, withSummary, type BankItem } from '../../lib/platform/lessonExtras';
import { VERB_BY_INF } from '../../data/verbs';
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
function PartChips({ blocks: every }: { blocks: LessonBlock[] }) {
  const blocks = partsOf(every); // the extras (whiteboard, notes, banks) are not parts
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
function PlanReview({ plan, source, sourceName, adapted, teachWith, topics, busy, onSave, onUse, onClose, onDelete }: { plan: Draft; topics: string[]; source?: string; sourceName?: string; adapted: string[]; teachWith: string | null; busy: boolean; onSave: (d: Draft, then: 'stay' | 'close') => void; onUse: (d: Draft) => void; onClose: () => void; onDelete: () => void }) {
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
            <p className="mt-2 max-w-2xl text-cream/80">{sourceName ? <>Made from <b className="text-cream">{sourceName}</b> and filed in your plans under {d.level}. </> : null}Check it, change anything, then mark it ready. It can be taught to any student or group, as often as you like.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-full bg-cream/10 px-5 py-3 font-semibold text-cream ring-1 ring-cream/20 hover:bg-cream/15" disabled={busy} onClick={() => onSave({ ...d, status: 'review' }, 'close')} data-testid="review-cancel">Save, review later</button>
            <button type="button" className={`inline-flex items-center gap-2 rounded-full px-5 py-3 font-bold transition ${d.status === 'ready' ? 'bg-olive text-white' : 'bg-cream text-ink hover:scale-[1.02]'}`} disabled={busy || blocks.length === 0} onClick={() => { setD((x) => ({ ...x, status: 'ready' })); onSave({ ...d, status: 'ready' }, 'stay'); }} data-testid="review-ready"><Icon name="check" size={18} /> {d.status === 'ready' ? 'Ready' : 'Mark as ready'}</button>
            {teachWith && <button type="button" className="inline-flex items-center gap-2 rounded-full bg-saffron px-6 py-3 font-bold text-ink shadow-lift transition hover:scale-[1.02] disabled:opacity-60" disabled={busy || blocks.length === 0} onClick={() => onUse(d)} data-testid="review-create"><Icon name="video" size={18} /> Teach this lesson</button>}
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
        <p className="mt-2 text-sm text-ink-soft" data-testid="review-for">This plan belongs to no student. The level is only the folder it is filed in, and the wording is yours to choose: it is not set by anyone’s level.</p>
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
          <div className="card mt-3 flex flex-wrap items-center gap-2 p-4">
            <span className="mr-1 text-sm font-semibold">Add a part:</span>
            {TYPES.map((t) => <button key={t} type="button" className="ctrl" onClick={() => setBlocks((bs) => [...bs, newBlock(t)])} data-testid={`review-add-${t}`}><Icon name="plus" size={14} /> {BLOCK_LABEL[t]}</button>)}
          </div>
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

/**
 * Teaching a plan: who is it for, and how should it be worded this time? One student, several, or a named group;
 * nobody is chosen to begin with. The wording starts as the plan's own and is hers to change for this lesson. It has
 * nothing to do with the level in a student's account.
 */
function TeachSheet({ open, plan, people, classes, preselect, busy, error, onClose, onStart, onSaveGroup, onDeleteGroup }: { open: boolean; plan: Draft | null; people: { id: string; firstName: string }[]; classes: StudentGroup[]; preselect: string[]; busy: boolean; error: string | null; onClose: () => void; onStart: (ids: string[], wording: Wording) => void; onSaveGroup: (name: string, ids: string[]) => Promise<void>; onDeleteGroup: (id: string) => Promise<void> }) {
  const [ids, setIds] = useState<string[]>([]);
  const [wording, setWording] = useState<Wording>('both');
  const [naming, setNaming] = useState<string | null>(null);
  useEffect(() => { if (open && plan) { setIds(preselect.filter((x) => people.some((p) => p.id === x))); setWording(plan.wording); setNaming(null); } }, [open, plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const nameOf = (id: string) => people.find((p) => p.id === id)?.firstName ?? 'Student';
  const members = (g: StudentGroup) => g.studentIds.filter((x) => people.some((p) => p.id === x));
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const picked = classes.find((g) => same(members(g), ids) && ids.length > 0);
  return (
    <Sheet open={open} onClose={onClose} title="Teach this lesson">
      {plan && (
        <div data-testid="teach-sheet">
          <p className="rounded-2xl bg-cream-100 px-4 py-3"><b className="block">{plan.title}</b><span className="text-sm text-ink-mute">{plan.level}{plan.minutes ? ` · ${plan.minutes} min` : ''} · {plan.blocks.length} parts</span></p>

          <p className="mt-4 font-semibold">Who is it for?</p>
          <p className="text-sm text-ink-soft" data-testid="room-class-summary">{ids.length === 0 ? 'Nobody chosen yet. Tap one student, or as many as you like for a group.' : ids.length === 1 ? `${nameOf(ids[0])}, one to one` : `${picked ? `${picked.name}: ` : ''}a group of ${ids.length}`}</p>
          {classes.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {classes.map((g) => { const on = picked?.id === g.id; return (
                <span key={g.id} className={`inline-flex items-center overflow-hidden rounded-full text-sm font-semibold ring-1 ${on ? 'bg-olive text-white ring-olive' : 'bg-olive-50 text-ink ring-olive/30'}`}>
                  <button type="button" className="px-3 py-1.5" aria-pressed={on} onClick={() => setIds(on ? [] : members(g))} data-testid="class-chip">{g.name} <span className="opacity-60">{members(g).length}</span></button>
                  <button type="button" className="border-l border-ink/10 px-2 py-1.5 opacity-60 hover:opacity-100" aria-label={`Delete the group ${g.name}`} onClick={() => { if (window.confirm(`Delete the group “${g.name}”? The students and their lessons are kept.`)) void onDeleteGroup(g.id); }}><Icon name="x" size={12} /></button>
                </span>
              ); })}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Students">
            {people.length === 0 ? <span className="text-sm text-ink-mute">Add a student first, on the Students page.</span> : people.map((p) => { const on = ids.includes(p.id); return <button key={p.id} type="button" aria-pressed={on} onClick={() => setIds((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]))} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition ${on ? 'bg-ink text-cream ring-ink' : 'bg-white text-ink ring-ink/15 hover:ring-ink/40'}`} data-testid="class-student" data-on={on || undefined}>{on && <Icon name="check" size={13} />}{p.firstName}</button>; })}
            {ids.length > 0 && <button type="button" className="rounded-full px-3 py-2 text-sm text-ink-mute hover:text-ink" onClick={() => setIds([])} data-testid="room-class-clear">Clear</button>}
          </div>
          {ids.length > 1 && !picked && (
            naming === null ? <button type="button" className="ctrl mt-2" onClick={() => setNaming('')} data-testid="class-save">Save these {ids.length} as a named group</button> : (
              <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (naming.trim()) void onSaveGroup(naming, ids).then(() => setNaming(null)); }}>
                <input className="input !w-56 !py-1.5" value={naming} onChange={(e) => setNaming(e.target.value)} placeholder="Name, e.g. Tuesday beginners" maxLength={40} autoFocus data-testid="class-name" />
                <button type="submit" className="btn-soft !py-1.5" disabled={!naming.trim()} data-testid="class-name-save">Save group</button>
                <button type="button" className="text-sm text-ink-mute" onClick={() => setNaming(null)}>Cancel</button>
              </form>
            )
          )}
          {ids.length > 1 && <p className="mt-2 rounded-2xl bg-olive-50 px-3 py-2 text-sm ring-1 ring-olive/30" data-testid="room-group-note"><b>A group lesson for {ids.map(nameOf).join(', ')}.</b> Each joins on their own device and answers for themselves. Your screen tells you when everyone has.</p>}

          <p className="mt-5 font-semibold">How should the instructions be worded this time?</p>
          <p className="text-sm text-ink-soft">Your choice for this lesson. It is not tied to anyone’s level, and you can change it again inside the lesson.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Wording">
            {(['en', 'both', 'es'] as Wording[]).map((w) => <button key={w} type="button" role="radio" aria-checked={wording === w} onClick={() => setWording(w)} className={`rounded-2xl px-3 py-2.5 text-left text-sm ring-1 transition ${wording === w ? 'bg-ink text-cream ring-ink' : 'bg-white ring-ink/15 hover:ring-ink/40'}`} data-testid={`teach-wording-${w}`}><b className="block">{WORDING_LABEL[w]}</b><span className={wording === w ? 'text-cream/75' : 'text-ink-mute'}>{w === 'en' ? 'Start with: Me llamo…' : w === 'both' ? 'Empieza con · Start with' : 'Empieza con: Me llamo…'}</span></button>)}
          </div>

          <ErrorText error={error} />
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={busy || ids.length === 0} onClick={() => onStart(ids, wording)} data-testid="teach-go"><Icon name="video" size={18} /> {ids.length === 0 ? 'Choose who it is for' : ids.length === 1 ? `Open the lesson for ${nameOf(ids[0])}` : `Open the lesson for ${picked ? picked.name : `these ${ids.length}`}`}</button>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** The teacher's lesson room: her plans in level folders, a tab for each student, and who she is teaching now. */
export function RoomList() {
  const { backend } = usePlatform();
  const { notify } = useStore();
  const students = useStudents();
  const lessons = usePlatformQuery((b) => b.lessons(), []);
  const library = usePlatformQuery((b) => b.libraryPlans(), []);
  const groups = usePlatformQuery((b) => b.lessonGroups(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const people = students.data?.people ?? [];
  const nameOf = (id: string) => people.find((p) => p.id === id)?.firstName ?? 'Student';

  // Who the next lesson is taught to. A plan belongs to nobody: it is given to a student, or a group, when it is taught.
  // Who a lesson is for is chosen when a plan is taught, on the plan itself: never beforehand, and never stored in the plan.
  const classes = usePlatformQuery((b) => b.studentGroups(), []);
  const [teaching, setTeaching] = useState<{ plan: Draft; save: boolean } | null>(null);
  const [preselect, setPreselect] = useState<string[]>([]);
  const groupTagsOf = (sid: string) => (classes.data ?? []).filter((g) => g.studentIds.includes(sid)).map((g) => g.name);

  // What is on show: a level folder of plans, or one student's lessons.
  const [view, setView] = useState<{ kind: 'level'; level: Cefr | 'all' } | { kind: 'student'; id: string }>({ kind: 'level', level: 'all' });
  const [topic, setTopic] = useState('');
  const settings = usePlatformQuery((b) => (view.kind === 'student' ? b.studentSettings(view.id) : Promise.resolve(null)), [view.kind === 'student' ? view.id : '']);

  /** One lesson, or the same lesson for each student in the class (same parts, same ids) kept together as a group. */
  const makeLesson = async (ids: string[], input: { title: string; notes: string; blocks: LessonBlock[] }) => {
    const made: LessonPlan[] = [];
    for (const sid of ids) made.push(await backend!.saveLesson({ studentId: sid, title: input.title, date: today(), notes: input.notes, blocks: input.blocks, live: { on: false, current: null } }));
    if (made.length > 1) { await backend!.saveLessonGroup(made.map((m) => ({ lessonId: m.id, studentId: m.studentId }))); groups.reload(); }
    return made[0];
  };

  // A plan the teacher uploads, pastes or starts is filed in her library, then opened for her to work on.
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [review, setReview] = useState<{ plan: Draft; source?: string; name?: string; adapted: string[] } | null>(null);
  const folder: Cefr = view.kind === 'level' && view.level !== 'all' ? view.level : 'A1';
  const file = async (text: string, name: string, fallback: string) => {
    if (!backend) return;
    const made = adaptPlan(text, fallback);
    if (!made.blocks.length) { setError('Nothing could be read from that. If it is a scanned page or a photo, paste the text instead.'); return; }
    setError(null);
    const saved = await backend.saveLibraryPlan({ title: made.title, topic: topicFrom(made.title), level: made.level ?? folder, status: 'review', blocks: made.blocks, notes: made.notes, minutes: made.minutes, wording: made.wording, source: name });
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
  /** A new plan written in the app: blank, or the worked example. It belongs to no student. */
  const newPlan = async (kind: 'blank' | 'example') => {
    if (!backend) return;
    setBusy(true); setError(null);
    try {
      const saved = await backend.saveLibraryPlan(kind === 'example'
        ? { title: 'Example lesson: el pretérito de ir y ser', topic: 'El pretérito', level: 'A2', status: 'ready', blocks: exampleLesson('your student'), notes: '', wording: 'both' }
        : { title: 'New lesson', topic: '', level: folder, status: 'review', blocks: [newBlock('question')], notes: '', wording: 'both' });
      library.reload(); setReview({ plan: saved, adapted: [] }); window.scrollTo({ top: 0 });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the plan.'); }
    setBusy(false);
  };
  const savePlan = async (d: Draft, then: 'stay' | 'close') => {
    if (!backend) return;
    setBusy(true); setError(null);
    try { const saved = await backend.saveLibraryPlan(d); library.reload(); if (then === 'close') setReview(null); else setReview((r) => (r ? { ...r, plan: saved } : r)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save the plan.'); }
    setBusy(false);
  };
  /** Teach a plan: first ask who it is for and in which wording. The plan stays in the library for next time. */
  const teach = (d: Draft, save = true) => setTeaching({ plan: d, save });
  const start = async (ids: string[], wording: Wording) => {
    if (!backend || !teaching || !ids.length) return;
    const d = teaching.plan;
    setBusy(true); setError(null);
    try {
      if (teaching.save) { await backend.saveLibraryPlan(d); library.reload(); }
      const plan = await makeLesson(ids, { title: d.title.trim() || 'Lesson', notes: d.notes, blocks: reword(d.blocks, wording).map((b) => ({ ...b, open: false, reveal: false })) });
      navigate(`teach/room/${plan.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the lesson.'); setBusy(false); }
  };
  /** The one kind of lesson that is about a single student from the start: built from their own week. */
  const draftFor = async (sid: string) => {
    if (!backend) return;
    setBusy(true); setError(null);
    try { const plan = await makeLesson([sid], { title: `Lesson with ${nameOf(sid)}`, notes: '', blocks: draftLesson(students.data?.progress[sid] ?? null, nameOf(sid)) }); navigate(`teach/room/${plan.id}`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create the lesson.'); }
    setBusy(false);
  };

  const chooser = (
    <TeachSheet open={!!teaching} plan={teaching?.plan ?? null} people={people} classes={classes.data ?? []} preselect={preselect} busy={busy} error={error}
      onClose={() => setTeaching(null)} onStart={(ids, w) => void start(ids, w)}
      onSaveGroup={async (name, ids) => { await backend?.saveStudentGroup({ name, studentIds: ids }); classes.reload(); notify('Group saved', `Pick “${name.trim()}” next time to choose them all at once.`); }}
      onDeleteGroup={async (gid) => { await backend?.deleteStudentGroup(gid); classes.reload(); }} />
  );
  if (review) return (<>{chooser}<ErrorText error={error} /><PlanReview key={review.plan.id} topics={[...new Set((library.data ?? []).map((x) => x.topic ?? '').filter(Boolean))].sort()} plan={review.plan} source={review.source} sourceName={review.name} adapted={review.adapted} teachWith={people.length ? 'someone' : null} busy={busy} onSave={(d, then) => void savePlan(d, then)} onUse={(d) => void teach(d)} onClose={() => { setReview(null); setError(null); }} onDelete={() => { void backend?.deleteLibraryPlan(review.plan.id).then(() => { library.reload(); setReview(null); notify('Plan deleted'); }); }} /></>);

  const none = !!students.data && people.length === 0;
  const all = lessons.data ?? [];
  const running = all.filter((l) => l.live.on);
  const plans = library.data ?? [];
  const level = view.kind === 'level' ? view.level : 'all';
  const shown = plans.filter((p) => (level === 'all' || p.level === level) && (!topic || (p.topic ?? '') === topic));
  const allTopics = [...new Set(plans.map((p) => p.topic ?? '').filter(Boolean))].sort();
  const waiting = plans.filter((p) => p.status === 'review').length;
  const isMemberCopy = (l: LessonPlan) => (groups.data ?? []).some((g) => g.members.slice(1).some((m) => m.lessonId === l.id));
  const groupOf = (l: LessonPlan) => (groups.data ?? []).find((g) => g.members.some((m) => m.lessonId === l.id));
  const day = (l: LessonPlan) => new Date(`${l.date || l.createdAt.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const PlanCard = ({ p }: { p: LibraryPlan }) => (
    <li className={`rounded-3xl bg-white p-4 ring-1 ${p.status === 'review' ? 'ring-2 ring-saffron/70' : 'ring-ink/10'}`} data-testid="library-plan" data-status={p.status}>
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
        <button type="button" className={p.status === 'ready' ? 'btn-primary !py-2' : 'ctrl'} disabled={busy || !people.length} onClick={() => teach(p, false)} data-testid="library-use"><Icon name="video" size={14} /> Teach this lesson</button>
      </div>
    </li>
  );

  return (
    <div data-testid="room-list">
      {chooser}
      <section className="relative overflow-hidden rounded-4xl bg-ink p-6 text-cream shadow-lift sm:p-7">
        <div className="absolute -right-10 -top-12 h-52 w-52 rounded-full bg-terracotta/40 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <div className="shrink-0"><DinaArt size={88} expression="beam" /></div>
          <div className="min-w-0 flex-1 basis-72">
            <p className="eyebrow !text-saffron-light">Aula · Lesson room</p>
            <h1 className="mt-1 font-display text-3xl font-semibold leading-tight sm:text-4xl">Plan a lesson, then teach it</h1>
            <p className="mt-2 max-w-2xl text-cream/80">A plan belongs to no student. You choose who it is for, and how it is worded, each time you teach it.</p>
          </div>
        </div>
        <ol className="relative mt-5 grid gap-2 sm:grid-cols-3">
          {[['Plan a lesson', 'Upload one, paste one, or write a new one. It is filed under its level.'], ['Teach it', 'Press “Teach this lesson” on a plan and choose who it is for: one student, several, or a named group.'], ['Use it again', 'The plan stays here. Teach it to someone else whenever you like.']].map(([t, dsc], i) => (
            <li key={t} className="flex items-start gap-3 rounded-2xl bg-cream/10 p-3 ring-1 ring-cream/10"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-saffron text-sm font-bold text-ink">{i + 1}</span><span><b className="block">{t}</b><span className="text-sm text-cream/75">{dsc}</span></span></li>
          ))}
        </ol>
      </section>
      {none && <p className="mt-3 rounded-2xl bg-saffron-50 px-4 py-3 text-sm ring-1 ring-saffron/40">Add a student first (Students, Add a student). You can still build and file plans now.</p>}

      {running.length > 0 && (
        <button type="button" onClick={() => navigate(`teach/room/${running.find((l) => !isMemberCopy(l))?.id ?? running[0].id}`)} className="mt-4 flex w-full items-center gap-4 rounded-3xl bg-olive p-4 text-left text-white shadow-lift" data-testid="room-running">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20"><Icon name="video" size={22} /></span>
          <span className="min-w-0 flex-1"><span className="eyebrow !text-white/80">Running now</span><b className="block truncate text-lg">{running[0].title} · {running.filter((l) => l.title === running[0].title).map((l) => nameOf(l.studentId)).join(', ')}</b></span>
          <span className="rounded-full bg-white px-4 py-2 font-bold text-ink">Go back in</span>
        </button>
      )}

      {/* The folders: levels across the top, the students beneath. */}
      <nav className="mt-6 rounded-3xl bg-white p-3 shadow-soft ring-1 ring-ink/5" aria-label="Plans and students" data-testid="room-tabs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-20 text-xs font-bold uppercase tracking-[0.12em] text-ink-mute">Levels</span>
          {(['all', ...LEVELS] as (Cefr | 'all')[]).map((l) => { const n = l === 'all' ? plans.length : plans.filter((p) => p.level === l).length; const on = view.kind === 'level' && view.level === l; return <button key={l} type="button" className="chip !py-1.5 text-sm" aria-pressed={on} onClick={() => setView({ kind: 'level', level: l })} data-testid={`library-${l}`}>{l === 'all' ? 'All levels' : l} <span className="opacity-60">{n}</span></button>; })}
          {waiting > 0 && <span className="ml-auto rounded-full bg-saffron px-2.5 py-1 text-xs font-bold text-ink" data-testid="library-waiting">{waiting} to review</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-ink/5 pt-2">
          <span className="mr-1 w-20 text-xs font-bold uppercase tracking-[0.12em] text-ink-mute">Students</span>
          {people.length === 0 ? <span className="text-sm text-ink-mute">None yet</span> : people.map((p) => { const n = all.filter((l) => l.studentId === p.id).length; const on = view.kind === 'student' && view.id === p.id; return <button key={p.id} type="button" className="chip !py-1.5 text-sm" aria-pressed={on} onClick={() => setView({ kind: 'student', id: p.id })} data-testid="student-tab">{p.firstName} <span className="opacity-60">{n}</span>{groupTagsOf(p.id).length ? <span className="ml-1 text-xs opacity-60">· {groupTagsOf(p.id).join(', ')}</span> : null}</button>; })}
        </div>
      </nav>

      {view.kind === 'level' ? (
        <section className="mt-5" data-testid="room-library">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-2xl font-semibold">{level === 'all' ? 'All my lesson plans' : `${level} lesson plans`}</h2>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,application/pdf,text/plain" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} data-testid="room-file" />
            <button type="button" className="btn-primary !py-2.5" disabled={busy} onClick={() => fileRef.current?.click()} data-testid="room-upload"><Icon name="upload" size={16} /> {busy ? 'Working…' : 'Upload a plan'}</button>
            <button type="button" className="btn-ghost !py-2.5" disabled={busy} onClick={() => setPasting(!pasting)} data-testid="room-paste-toggle"><Icon name="copy" size={16} /> Paste</button>
            <button type="button" className="btn-ghost !py-2.5" disabled={busy} onClick={() => void newPlan('blank')} data-testid="room-blank"><Icon name="plus" size={16} /> New plan</button>
            <button type="button" className="btn-ghost !py-2.5" disabled={busy} onClick={() => void newPlan('example')} data-testid="room-example"><Icon name="eye" size={16} /> Add the example</button>
          </div>
          {preselect.length > 0 && <p className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-olive-50 px-4 py-2.5 text-sm ring-1 ring-olive/30" data-testid="preselect-note"><span>Choosing a plan for <b>{preselect.map(nameOf).join(', ')}</b>: press “Teach this lesson” on one and they are already picked.</span><button type="button" className="ctrl !py-1" onClick={() => setPreselect([])}>Not just them</button></p>}
          {pasting && (
            <div className="card mb-3 p-4" data-testid="room-import">
              <label className="font-semibold" htmlFor="room-paste">Paste your lesson plan</label>
              <textarea id="room-paste" className="input mt-2 min-h-[180px] w-full" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={'El pretérito: ir y ser\n\nCalentamiento\n¿Qué hiciste el fin de semana?\n\nPráctica:\nAyer yo ___ (ir) al mercado. [fui]\n\nVocabulario\nayer = yesterday\nanoche = last night'} data-testid="room-paste" />
              <button type="button" className="btn-primary mt-2" disabled={busy || !pasted.trim()} onClick={() => void file(pasted, 'your pasted plan', 'Lesson')} data-testid="room-paste-go"><Icon name="eye" size={16} /> Review it</button>
            </div>
          )}
          {allTopics.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Topic">
              <span className="mr-1 text-sm font-semibold text-ink-soft">Topic</span>
              <button type="button" className="chip !py-1.5 text-sm" aria-pressed={!topic} onClick={() => setTopic('')}>All</button>
              {allTopics.map((t) => <button key={t} type="button" className="chip !py-1.5 text-sm" aria-pressed={topic === t} onClick={() => setTopic(topic === t ? '' : t)} data-testid="library-topic">{t} <span className="opacity-60">{plans.filter((p) => p.topic === t).length}</span></button>)}
            </div>
          )}
          {!library.data ? <Loading /> : shown.length === 0 ? (
            <p className="card p-6 text-center text-ink-soft" data-testid="library-none">{plans.length === 0 ? 'No plans yet. Upload one you already have, start a new one, or add the example. Each is filed under its level and can be taught to any student.' : 'No plans here yet for that level and topic.'}</p>
          ) : level === 'all' ? (
            LEVELS.filter((l) => shown.some((p) => p.level === l)).map((l) => (
              <div key={l} className="mb-5" data-testid={`folder-${l}`}>
                <p className="mb-2 flex items-center gap-2"><span className="rounded-xl bg-azul px-2.5 py-1 text-sm font-bold text-white">{l}</span><span className="text-sm text-ink-mute">{shown.filter((p) => p.level === l).length} plan{shown.filter((p) => p.level === l).length === 1 ? '' : 's'}</span></p>
                <ul className="grid gap-3 sm:grid-cols-2">{shown.filter((p) => p.level === l).map((p) => <PlanCard key={p.id} p={p} />)}</ul>
              </div>
            ))
          ) : <ul className="grid gap-3 sm:grid-cols-2">{shown.map((p) => <PlanCard key={p.id} p={p} />)}</ul>}
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
        </section>
      ) : (() => {
        const sid = view.id; const mine = all.filter((l) => l.studentId === sid);
        const lv = levelOf(settings.data, students.data?.progress[sid]);
        return (
          <section className="mt-5" data-testid="student-folder">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-2xl font-semibold">{nameOf(sid)} <span className="ml-1 rounded-xl bg-azul px-2.5 py-1 align-middle text-sm font-bold text-white" data-testid="student-level">{lv}</span>{groupTagsOf(sid).map((g) => <span key={g} className="ml-1.5 rounded-xl bg-olive-50 px-2.5 py-1 align-middle text-sm font-bold text-olive" data-testid="student-group-tag">{g}</span>)}</h2>
              <button type="button" className="btn-primary !py-2.5" disabled={busy} onClick={() => void draftFor(sid)} data-testid="room-draft"><Icon name="sparkle" size={16} /> Draft a lesson from their week</button>
              <button type="button" className="btn-ghost !py-2.5" onClick={() => { setPreselect([sid]); setView({ kind: 'level', level: lv }); }} data-testid="student-plans"><Icon name="book" size={16} /> Teach them a {lv} plan</button>
              <button type="button" className="btn-ghost !py-2.5" onClick={() => navigate(`teach/student/${sid}`)}><Icon name="user" size={16} /> Their profile</button>
            </div>
            <p className="mb-3 text-sm text-ink-soft">What {nameOf(sid)} has worked on with you: {mine.length} lesson{mine.length === 1 ? '' : 's'}. Open one to see the parts and their answers, or to teach it again.</p>
            {!lessons.data ? <Loading /> : mine.length === 0 ? <p className="card p-6 text-center text-ink-soft" data-testid="room-none">No lessons with {nameOf(sid)} yet. Draft one from their week, or teach them a plan from the {lv} folder.</p> : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {mine.map((l) => { const g = groupOf(l); const lead = g?.members[0]?.lessonId ?? l.id; return (
                  <li key={l.id}>
                    <button type="button" onClick={() => navigate(`teach/room/${lead}`)} className={`flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-soft ${l.live.on ? 'ring-2 ring-olive' : 'ring-ink/10'}`} data-testid="room-open">
                      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${l.live.on ? 'bg-olive text-white' : 'bg-cream-100 text-ink-soft'}`}><Icon name={l.live.on ? 'video' : 'book'} size={22} /></span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[16px]">{l.title}</b>
                        <span className="block text-sm text-ink-mute">{g ? <span className="mr-1 rounded-full bg-olive-50 px-2 py-0.5 text-xs font-bold text-olive">Group</span> : null}{g ? `with ${g.members.filter((m) => m.studentId !== sid).map((m) => nameOf(m.studentId)).join(', ')} · ` : ''}{day(l)}{l.live.on ? ' · running now' : ''}</span>
                        <span className="mt-1.5 block"><PartChips blocks={l.blocks} /></span>
                      </span>
                      <Icon name="arrowRight" size={16} className="shrink-0 text-ink-mute" />
                    </button>
                  </li>
                ); })}
              </ul>
            )}
          </section>
        );
      })()}
      <ErrorText error={error} />
    </div>
  );
}

type WordPair = { es: string; en: string };
const pairsOf = (text: string): WordPair[] => text.split('\n').map((l) => { const [es, ...en] = l.split('='); return { es: es.trim(), en: en.join('=').trim() }; });
const pairsText = (pairs: WordPair[]) => pairs.map((p) => (p.en ? `${p.es} = ${p.en}` : p.es)).join('\n');
const samePairs = (a: WordPair[], b: WordPair[]) => a.length === b.length && a.every((p, k) => p.es === b[k].es && p.en === b[k].en);

/** The word list box. It keeps exactly what was typed (spaces, a half-written line) and only reads the pairs out of
 *  it; redrawing the box from the tidied pairs is what used to swallow each space and add an "=" on its own. */
function PairsField({ pairs, onChange }: { pairs: WordPair[]; onChange: (pairs: WordPair[]) => void }) {
  const [text, setText] = useState(() => pairsText(pairs));
  // The list changed from outside (another part's words, or a fresh draft): show that instead.
  useEffect(() => { if (!samePairs(pairsOf(text), pairs)) setText(pairsText(pairs)); }, [pairs]); // eslint-disable-line react-hooks/exhaustive-deps
  return <textarea className="input min-h-[110px]" value={text} onChange={(e) => { setText(e.target.value); onChange(pairsOf(e.target.value)); }} lang="es" data-testid="block-pairs" />;
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
        {b.type === 'vocab' && <label className="mt-3 grid gap-1 text-sm font-medium">Words <span className="font-normal text-ink-mute">(one per line: español = English)</span><PairsField pairs={b.pairs ?? []} onChange={(pairs) => set({ pairs })} /></label>}
        {flag && <p className="mt-2 text-sm font-semibold text-ink" role="status">No answer was found in your plan for this one. Add it above.</p>}
        {preview && <div className="mt-3 rounded-3xl bg-cream-100 p-3"><p className="eyebrow mb-2">As your student sees it</p><BlockView block={b} mode="present" wording="both" /></div>}
      </div>
    </li>
  );
}

/**
 * After a lesson: the words and verbs worth keeping. The teacher sees everything the lesson offers (its word lists,
 * the "word = meaning" lines on the whiteboard, any verb the app knows), ticks what she wants, adds her own, and
 * saves. The student then finds them in their word bank and verb bank.
 */
function LessonBank({ blocks, name, notes = [], embedded = false, onSave, onChange }: { blocks: LessonBlock[]; name: string; notes?: string[]; embedded?: boolean; onSave?: (bank: { words: BankItem[]; verbs: BankItem[] }) => void; onChange?: (bank: { words: BankItem[]; verbs: BankItem[] }) => void }) {
  const saved = bankOf(blocks);
  const offer = bankCandidates(blocks, notes);
  const [open, setOpen] = useState(embedded);
  const [words, setWords] = useState<BankItem[]>(saved.words);
  const [verbs, setVerbs] = useState<BankItem[]>(saved.verbs);
  const [extra, setExtra] = useState('');
  const tell = useRef(onChange); tell.current = onChange;
  useEffect(() => { tell.current?.({ words, verbs }); }, [words, verbs]);
  const has = (list: BankItem[], x: BankItem) => list.some((y) => y.es.toLowerCase() === x.es.toLowerCase());
  const flip = (list: BankItem[], set: (l: BankItem[]) => void, x: BankItem) => set(has(list, x) ? list.filter((y) => y.es.toLowerCase() !== x.es.toLowerCase()) : [...list, x]);
  const allWords = [...offer.words, ...saved.words.filter((x) => !has(offer.words, x)), ...words.filter((x) => !has(offer.words, x) && !has(saved.words, x))];
  const allVerbs = [...offer.verbs, ...saved.verbs.filter((x) => !has(offer.verbs, x)), ...verbs.filter((x) => !has(offer.verbs, x) && !has(saved.verbs, x))];
  const add = () => {
    const m = extra.match(/^\s*(.{1,48}?)\s*(?:=|→|–|—)\s*(.{1,70})\s*$/); const es = (m ? m[1] : extra).trim(); if (!es) return;
    const known = VERB_BY_INF[es.toLowerCase()];
    if (known) setVerbs((l) => (has(l, { es, en: '' }) ? l : [...l, { es: es.toLowerCase(), en: known.en.split(' (')[0] }]));
    else setWords((l) => (has(l, { es, en: '' }) ? l : [...l, { es, en: m ? m[2].trim() : '' }]));
    setExtra('');
  };
  const Tick = ({ x, on, onClick, testid }: { x: BankItem; on: boolean; onClick: () => void; testid: string }) => (
    <button type="button" aria-pressed={on} onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 transition ${on ? 'bg-ink text-cream ring-ink' : 'bg-white text-ink ring-ink/15 hover:ring-ink/40'}`} data-testid={testid} data-on={on || undefined}>{on && <Icon name="check" size={13} />}<b lang="es">{x.es}</b>{x.en && <span className={on ? 'text-cream/70' : 'text-ink-mute'}>{x.en}</span>}</button>
  );
  return (
    <section className={embedded ? '' : 'card p-4'} data-testid={embedded ? 'end-bank' : 'lesson-bank'}>
      {!embedded && (<>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rosa-50 text-ink"><Icon name="translate" size={18} /></span>
        <div className="min-w-0 flex-1 basis-56">
          <b className="block">Add words and verbs to {name}’s banks</b>
          <span className="text-sm text-ink-soft" data-testid="lesson-bank-count">{saved.words.length + saved.verbs.length ? `${saved.words.length} word${saved.words.length === 1 ? '' : 's'} and ${saved.verbs.length} verb${saved.verbs.length === 1 ? '' : 's'} banked from this lesson.` : `This lesson offers ${offer.words.length} word${offer.words.length === 1 ? '' : 's'} and ${offer.verbs.length} verb${offer.verbs.length === 1 ? '' : 's'}. Nothing is banked until you choose.`}</span>
        </div>
        <button type="button" className="btn-soft" onClick={() => { setWords(saved.words); setVerbs(saved.verbs); setOpen(!open); }} data-testid="lesson-bank-open">{open ? 'Close' : 'Choose'}</button>
      </div>
      </>)}
      {open && (
        <div className={embedded ? '' : 'mt-3 border-t border-ink/5 pt-3'}>
          <p className="eyebrow mb-1.5">Words · {words.length} chosen <button type="button" className="ml-2 normal-case tracking-normal text-ink-mute underline" onClick={() => setWords(allWords)}>tick all</button></p>
          <div className="flex flex-wrap gap-1.5">{allWords.length ? allWords.map((x) => <Tick key={x.es} x={x} on={has(words, x)} onClick={() => flip(words, setWords, x)} testid="bank-word" />) : <span className="text-sm text-ink-mute">No words found in the lesson, the whiteboard or the notes. Add your own below.</span>}</div>
          <p className="eyebrow mb-1.5 mt-3">Verbs · {verbs.length} chosen <button type="button" className="ml-2 normal-case tracking-normal text-ink-mute underline" onClick={() => setVerbs(allVerbs)}>tick all</button></p>
          <div className="flex flex-wrap gap-1.5">{allVerbs.length ? allVerbs.map((x) => <Tick key={x.es} x={x} on={has(verbs, x)} onClick={() => flip(verbs, setVerbs, x)} testid="bank-verb" />) : <span className="text-sm text-ink-mute">No verbs found in the lesson, the whiteboard or the notes. Add your own below.</span>}</div>
          <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
            <input className="input min-w-0 flex-1" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Add your own: la playa = the beach, or a verb such as volver" lang="es" data-testid="bank-add" />
            <button type="submit" className="ctrl" disabled={!extra.trim()} data-testid="bank-add-go"><Icon name="plus" size={14} /> Add</button>
          </form>
          {!embedded && <button type="button" className="btn-primary mt-3" onClick={() => { onSave?.({ words, verbs }); setOpen(false); }} data-testid="lesson-bank-save">Save {words.length} word{words.length === 1 ? '' : 's'} and {verbs.length} verb{verbs.length === 1 ? '' : 's'}</button>}
        </div>
      )}
    </section>
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
    const made = fn(plan);
    // The extras always sit after the teaching parts, so a part's place in the list is its place in the lesson.
    const next = { ...made, blocks: [...partsOf(made.blocks), ...made.blocks.filter(isSystem)] };
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
  const [screen, setScreen] = useState<'lesson' | 'board'>('lesson');
  const [ending, setEnding] = useState(false);
  const [summary, setSummary] = useState('');
  const [pubBoard, setPubBoard] = useState(true);
  const [pubSummary, setPubSummary] = useState(true);
  const endBank = useRef<{ words: BankItem[]; verbs: BankItem[] } | null>(null);
  const [boardFull, setBoardFull] = useState(false);
  useEffect(() => { const on = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', on); return () => document.removeEventListener('fullscreenchange', on); }, []);
  const keyNav = useRef<(d: number) => void>(() => undefined);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.target as HTMLElement | null)?.closest('input,textarea,select')) return; if (e.key === 'ArrowRight') keyNav.current(1); else if (e.key === 'ArrowLeft') keyNav.current(-1); };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  }, []);

  if (!loaded || (!plan && !syncError)) return <Loading />;
  if (!plan) return <div className="card p-6"><p>{syncError ?? 'Lesson not found.'}</p><button className="btn-primary mt-3" onClick={() => navigate('teach/room')}>Back to the lesson room</button></div>;

  // The teaching parts, without the extras (whiteboard, the student's notes, the banks), which are never listed.
  const parts = partsOf(plan.blocks);
  const board = boardOf(plan.blocks);
  const here = isPresent(work, now);
  // Everyone in the lesson, with their answers: one person, or the whole group.
  const firstName = (sid: string) => students.data?.people.find((x) => x.id === sid)?.firstName ?? 'Student';
  const everyone = [{ studentId: plan.studentId, name: firstName(plan.studentId), work, here }, ...others.map((m) => ({ studentId: m.studentId, name: firstName(m.studentId), work: groupWork[m.lessonId]?.work ?? null, here: isPresent(groupWork[m.lessonId]?.work, groupWork[m.lessonId]?.now ?? now) }))];
  const isGroup = everyone.length > 1;
  const answeredBy = (bid: string) => everyone.filter((e) => e.work?.answers[bid]);
  // What the trail shows for a group: a part counts as answered when everyone has, and right when everyone was right.
  const merged: Record<string, LessonAnswer> = {};
  if (isGroup) for (const b of parts) { const got = answeredBy(b.id); if (got.length === everyone.length) merged[b.id] = { value: '', at: '', ...(got.every((e) => e.work!.answers[b.id].correct !== undefined) ? { correct: got.every((e) => e.work!.answers[b.id].correct === true) } : {}) }; }
  const setBlock = (bid: string, patch: Partial<LessonBlock>, immediate = false) => change((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === bid ? { ...b, ...patch } : b)) }), immediate);
  const cur = parts.find((b) => b.id === plan.live.current) ?? null;
  const idx = cur ? parts.indexOf(cur) : -1;
  const go = (b: LessonBlock, alsoOpen = false) => change((p) => ({ ...p, blocks: alsoOpen ? p.blocks.map((x) => (x.id === b.id ? { ...x, open: true } : x)) : p.blocks, live: { ...p.live, current: b.id } }), true);
  const openCount = parts.filter((b) => b.open).length;
  // Tell the teacher, once for each part, when the whole group has answered it.
  if (isGroup && cur && (cur.type !== 'text' && cur.type !== 'vocab') && answeredBy(cur.id).length === everyone.length && !doneFor.current.has(cur.id)) {
    doneFor.current.add(cur.id);
    window.setTimeout(() => { sfx.win(); notify('Everyone has answered', `All ${everyone.length} are in for part ${idx + 1}.`); }, 0);
  }
  const studentLevel = levelOf(settingsQ.data, students.data?.progress[plan.studentId]);
  const wording = detectWording(parts);
  const planStages = stagesOf(parts);
  const plannedMinutes = planStages.reduce((n, st) => n + st.minutes, 0);
  const toggleFull = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void stageRef.current?.requestFullscreen?.().catch(() => undefined); };
  keyNav.current = (d) => { if (tab !== 'present' || idx < 0) return; const b = parts[idx + d]; if (b) go(b, d > 0 && !!cur?.open && autoOpen); };

  const hasBoard = !!board.text.trim() || board.strokes.length > 0;
  // What was written in the lesson: the teacher's own notes and each student's notes. Verbs and words are offered from here.
  const writtenNotes = [plan.notes ?? '', ...everyone.map((e) => e.work?.answers[SYS.notes]?.value ?? '')].filter((t) => t.trim());
  const releaseBank = (bank: { words: BankItem[]; verbs: BankItem[] }) => {
    if (!backend) return;
    void releaseVerbsTo(backend, everyone.map((e) => e.studentId), bank.verbs).catch(() => notify('The verbs are banked', 'They could not be added to the verb gym just now. Save the choice again from the Plan tab.'));
  };
  const finish = (publish: boolean) => {
    const bank = publish ? endBank.current : null;
    change((p) => {
      let blocks = p.blocks;
      if (bank) blocks = withBank(blocks, bank);
      if (publish && pubBoard) blocks = withBoard(blocks, { ...boardOf(blocks), open: true }).blocks;
      if (publish && pubSummary) blocks = withSummary(blocks, summary);
      return { ...p, blocks, live: { ...p.live, on: false } };
    }, true);
    setEnding(false);
    if (bank) releaseBank(bank);
    const released = bank ? bank.words.length + bank.verbs.length : 0;
    if (released) notify('Released', `${bank!.words.length} word${bank!.words.length === 1 ? '' : 's'} and ${bank!.verbs.length} verb${bank!.verbs.length === 1 ? '' : 's'} added to ${isGroup ? 'the group’s accounts' : `${name}’s account`}.`);
    if (publish && (pubSummary || (pubBoard && hasBoard))) notify('Lesson ended', `${[pubSummary && summary.trim() ? 'The summary' : '', pubBoard && hasBoard ? 'the whiteboard' : ''].filter(Boolean).join(' and ')} ${isGroup ? 'are with the group' : `is with ${name}`}, in their Feedback.`);
  };
  return (
    <div data-testid="teacher-room">
      <Sheet open={ending} onClose={() => setEnding(false)} title="End the lesson" wide>
        <div data-testid="end-sheet">
          <p className="text-ink-soft">Choose what {isGroup ? 'the group gets' : `${name} gets`} afterwards. It appears in their <b>Feedback</b> and under the lesson in their notes.</p>
          <label className="mt-4 flex items-start gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink/10"><input type="checkbox" className="mt-1" checked={pubSummary} onChange={(e) => setPubSummary(e.target.checked)} data-testid="end-pub-summary" /><span className="min-w-0 flex-1"><b className="block">A summary of the lesson</b><span className="text-sm text-ink-mute">A first draft is written for you from what the lesson covered. Change it as you like.</span>
            <textarea className="input mt-2 min-h-[170px] w-full" value={summary} onChange={(e) => setSummary(e.target.value)} disabled={!pubSummary} maxLength={3900} data-testid="end-summary" /></span></label>
          <label className={`mt-3 flex items-start gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink/10 ${hasBoard ? '' : 'opacity-60'}`}><input type="checkbox" className="mt-1" checked={pubBoard && hasBoard} disabled={!hasBoard} onChange={(e) => setPubBoard(e.target.checked)} data-testid="end-pub-board" /><span><b className="block">The whiteboard</b><span className="text-sm text-ink-mute">{hasBoard ? 'As you left it: the text and the drawing.' : 'Nothing was put on the whiteboard in this lesson.'}</span></span></label>
          <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-ink/10">
            <b className="block">Words and verbs to release</b>
            <span className="text-sm text-ink-mute">Found in the lesson, on the whiteboard and in the notes. Only the ones you tick are added to {isGroup ? 'their accounts' : `${name}’s account`}: words go to their word bank, verbs to their verb bank and verb practice.</span>
            <div className="mt-3">{ending && <LessonBank embedded blocks={plan.blocks} notes={writtenNotes} name={isGroup ? 'the group' : name} onChange={(b) => { endBank.current = b; }} />}</div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => finish(true)} data-testid="end-confirm"><Icon name="check" size={18} /> End the lesson and publish</button>
            <button type="button" className="btn-ghost" onClick={() => finish(false)} data-testid="end-quiet">End without publishing</button>
            <button type="button" className="btn-ghost" onClick={() => setEnding(false)}>Carry on teaching</button>
          </div>
        </div>
      </Sheet>
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
            ['Instructions written in', <select key="w" className="input !py-1.5" defaultValue={wording} onChange={(e) => change((p) => ({ ...p, blocks: reword(p.blocks, e.target.value as Wording) }))} data-testid="plan-wording">{(['en', 'both', 'es'] as Wording[]).map((x) => <option key={x} value={x}>{WORDING_LABEL[x]}</option>)}</select>],
            ['Planned time', plannedMinutes ? `${plannedMinutes} minutes · ${planStages.length} stages` : 'No timings'],
            ['Parts', `${parts.length}, ${parts.filter((b) => b.type === 'gap' || b.type === 'choice').length} marked by the app`],
          ]} />
          <section className="card grid gap-3 p-5 sm:grid-cols-[1fr_auto]">
            <label className="grid gap-1 text-sm font-medium">Title<input className="input text-lg" value={plan.title} onChange={(e) => change((p) => ({ ...p, title: e.target.value }))} data-testid="room-title" /></label>
            <label className="grid gap-1 text-sm font-medium">Day<input type="date" className="input" value={plan.date ?? ''} onChange={(e) => change((p) => ({ ...p, date: e.target.value }))} /></label>
            <label className="grid gap-1 text-sm font-medium sm:col-span-2">Your own notes <span className="font-normal text-ink-mute">(only you see these: they are never sent to {name}, and they stay hidden on the Present screen unless you open them)</span><textarea className="input min-h-[70px]" value={plan.notes ?? ''} onChange={(e) => change((p) => ({ ...p, notes: e.target.value }))} data-testid="room-notes" /></label>
          </section>
          <ol className="grid gap-3">
            {parts.map((b, i) => (
              <BlockEditor key={b.id} b={b} i={i} n={parts.length} onChange={(nb) => change((p) => ({ ...p, blocks: p.blocks.map((x) => (x.id === b.id ? nb : x)) }))}
                onMove={(d) => change((p) => { const arr = [...p.blocks]; const j = i + d; [arr[i], arr[j]] = [arr[j], arr[i]]; return { ...p, blocks: arr }; })}
                onDelete={() => change((p) => ({ ...p, blocks: p.blocks.filter((x) => x.id !== b.id), live: { ...p.live, current: p.live.current === b.id ? null : p.live.current } }))}
                onDuplicate={() => change((p) => { const arr = [...p.blocks]; arr.splice(i + 1, 0, { ...b, id: newBlock(b.type).id, open: false, reveal: false }); return { ...p, blocks: arr }; })} />
            ))}
          </ol>
          <div className="card flex flex-wrap items-center gap-2 p-4">
            <span className="mr-1 text-sm font-semibold">Add a part:</span>
            {TYPES.map((t) => <button key={t} type="button" className="ctrl" onClick={() => change((p) => ({ ...p, blocks: [...partsOf(p.blocks), newBlock(t), ...p.blocks.filter(isSystem)] }))} data-testid={`add-${t}`}><Icon name="plus" size={14} /> {BLOCK_LABEL[t]}</button>)}
          </div>
          <LessonBank key={ending ? 'x' : 'y'} blocks={plan.blocks} notes={writtenNotes} name={isGroup ? 'the group' : name} onSave={(bank) => { change((p) => ({ ...p, blocks: withBank(p.blocks, bank) }), true); releaseBank(bank); notify('Saved to their banks', `${bank.words.length} word${bank.words.length === 1 ? '' : 's'} and ${bank.verbs.length} verb${bank.verbs.length === 1 ? '' : 's'} from this lesson.`); }} />
          <SendHomework plan={plan} name={isGroup ? 'the group' : name} studentIds={everyone.map((e) => e.studentId)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={async () => { if (!backend) return; await backend.saveLibraryPlan({ title: plan.title, topic: topicFrom(plan.title), level: studentLevel, status: 'ready', blocks: parts.map((b) => ({ ...b, open: false, reveal: false })), notes: plan.notes ?? '', minutes: plannedMinutes || undefined, wording }); notify('Saved to your plans', `Filed under ${studentLevel}. You can teach it to anyone from there.`); }} data-testid="save-as-plan"><Icon name="book" size={16} /> Save as a plan to reuse</button>
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
                <button type="button" className="btn-ghost w-full justify-center" onClick={() => { setSummary(summaryOf(plan.blocks) || draftSummary(plan.blocks, isGroup ? undefined : work?.answers)); setPubBoard(true); setPubSummary(true); setEnding(true); }} data-testid="end-lesson"><Icon name="stop" size={16} /> End the lesson</button>
              ) : (
                <button type="button" className="btn-primary w-full justify-center" onClick={() => change((p) => ({ ...p, blocks: withNotes(p.blocks), live: { on: true, current: p.live.current ?? p.blocks[0]?.id ?? null, startedAt: new Date().toISOString() } }), true)} data-testid="start-lesson"><Icon name="video" size={18} /> Start the lesson</button>
              )}
              <p className="mt-2 text-xs text-ink-mute">{plan.live.on ? `${name}’s phone is told the lesson is open. They join from their home page.` : `Starting tells ${name}’s phone the lesson is open. Nothing is shown to them until you open a part.`}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button type="button" className="ctrl" onClick={() => change((p) => ({ ...p, blocks: p.blocks.map((b) => (isSystem(b) ? b : { ...b, open: true })) }), true)} data-testid="open-all">Open all</button>
                <button type="button" className="ctrl" onClick={() => change((p) => ({ ...p, blocks: p.blocks.map((b) => (isSystem(b) ? b : { ...b, open: false })) }), true)}>Close all</button>
              </div>
              <p className="mt-2 text-xs text-ink-mute">{openCount} of {parts.length} parts open to {name}.</p>
            </div>
            <ol className="grid min-w-0 gap-1.5" data-testid="block-list">
              {parts.map((b, i) => {
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
          </aside>

          <section ref={stageRef} className={`min-w-0 ${full ? 'flex h-full flex-col overflow-y-auto bg-cream p-5 sm:p-8' : ''}`} data-testid="stage">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Segmented label="On the screen" value={screen} onChange={setScreen} options={[{ value: 'lesson', label: 'Lesson' }, { value: 'board', label: 'Whiteboard' }]} />
              {screen === 'board' && <>
                <label className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-ink/10"><input type="checkbox" checked={board.open} onChange={(e) => change((p) => ({ ...p, blocks: withBoard(p.blocks, { ...boardOf(p.blocks), open: e.target.checked }).blocks }), true)} data-testid="board-share" /> {isGroup ? 'Everyone' : name} can see it on their device now</label>
                <span className="ml-auto"><LessonClock startedAt={plan.live.on ? plan.live.startedAt : undefined} blocks={parts} current={cur?.id} compact /></span>
                <button type="button" className="ctrl" onClick={toggleFull}><Icon name="video" size={14} /> {full ? 'Leave full screen' : 'Full screen to share'}</button>
              </>}
            </div>
            {screen === 'board' ? (
              <div className={full ? 'mx-auto w-full max-w-6xl' : ''}>
                <Whiteboard board={board} full={full} onChange={(b) => { const made = withBoard(plan.blocks, b); setBoardFull(made.dropped > 0); change((p) => ({ ...p, blocks: withBoard(p.blocks, b).blocks })); }} />
                {boardFull && <p className="mt-2 rounded-2xl bg-saffron-50 px-4 py-2 text-sm ring-1 ring-saffron/40" role="status">The board is full: the newest lines are not being saved. Wipe some of it to carry on.</p>}
                <p className="mt-2 text-xs text-ink-mute">The whiteboard is saved with this lesson and given to {isGroup ? 'the group' : name} to look back at when you end the lesson. On a call they see it now through your shared screen.</p>
              </div>
            ) : cur ? (
              <>
                <div className="mb-3 rounded-3xl bg-white p-3 shadow-soft ring-1 ring-ink/5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-cream">{idx + 1} / {parts.length}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cur.open ? 'bg-olive text-white' : 'bg-saffron text-ink'}`} data-testid="stage-status">{cur.open ? `${isGroup ? 'Everyone' : name} can see this` : `Only you can see this`}</span>
                    {!cur.open && <button type="button" className="btn-primary !py-2" onClick={() => go(cur, true)} data-testid="show-to-student"><Icon name="eye" size={16} /> Show it to {isGroup ? 'everyone' : name}</button>}
                    {(cur.type === 'gap' || cur.type === 'choice') && <button type="button" className="ctrl" onClick={() => setBlock(cur.id, { reveal: !cur.reveal }, true)} aria-pressed={!!cur.reveal} data-testid="reveal">{cur.reveal ? 'Hide the answer' : 'Show the answer'}</button>}
                    <span className="ml-auto"><LessonClock startedAt={plan.live.on ? plan.live.startedAt : undefined} blocks={parts} current={cur.id} /></span>
                    <button type="button" className="ctrl" onClick={toggleFull} data-testid="stage-full"><Icon name="video" size={14} /> {full ? 'Leave full screen' : 'Full screen to share'}</button>
                  </div>
                  <div className="mt-3"><LessonTrail blocks={parts} answers={isGroup ? merged : work?.answers} current={cur.id} onGo={(bid) => { const b = parts.find((x) => x.id === bid); if (b) go(b); }} /></div>
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
                  <button type="button" className="btn-ghost" disabled={idx <= 0} onClick={() => go(parts[idx - 1])}><Icon name="arrowLeft" size={16} /> Back</button>
                  <button type="button" className="btn-dark" disabled={idx >= parts.length - 1} onClick={() => go(parts[idx + 1], cur.open && autoOpen)} data-testid="next-part">Next <Icon name="arrowRight" size={16} /></button>
                  <label className="ml-2 flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={autoOpen} onChange={(e) => setAutoOpen(e.target.checked)} data-testid="auto-open" /> Show each part to {isGroup ? 'everyone' : name} as I go</label>
                  <span className="ml-auto hidden text-xs text-ink-mute sm:inline">← → keys also move</span>
                </div>
              </>
            ) : <div className="card p-8 text-center text-ink-soft">{parts.length ? 'Choose a part on the left to put it on the screen.' : 'This lesson has no parts yet. Add some on the Plan tab.'}</div>}
          </section>
          <details className="card p-4 lg:col-start-2" data-testid="present-notes">
            <summary className="cursor-pointer font-semibold">My notes <span className="font-normal text-ink-mute">· only you see these. They are not on the whiteboard and are never sent to {isGroup ? 'the group' : name}.</span></summary>
            <textarea className="input mt-3 min-h-[110px] w-full" value={plan.notes ?? ''} onChange={(e) => change((p) => ({ ...p, notes: e.target.value }))} maxLength={6000} placeholder="Things to remember, what to come back to next time…" data-testid="present-notes-text" />
            <p className="mt-1 text-xs text-ink-mute">If you are sharing your whole screen, keep this closed while you share.</p>
          </details>
        </div>
      )}
    </div>
  );
}
