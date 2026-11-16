import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { PageHeader, Segmented } from '../../components/ui';
import { isPresent } from '../../../supabase/functions/_shared/lesson';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { BLOCK_LABEL, draftLesson, exampleLesson, newBlock } from '../../lib/platform/lessonDraft';
import type { LessonBlock, LessonPlan } from '../../lib/platform/types';
import { navigate } from '../../lib/router';
import { useStore } from '../../lib/store';
import { ErrorText, Loading, useStudents } from '../teach/shared';
import { BlockView } from './Blocks';
import { useLesson } from './useLesson';

const today = () => new Date().toISOString().slice(0, 10);
const TYPES: LessonBlock['type'][] = ['text', 'question', 'gap', 'choice', 'vocab'];

/** The teacher's lessons: one list, newest first, with a button to plan a new one. */
export function RoomList() {
  const { backend } = usePlatform();
  const students = useStudents();
  const lessons = usePlatformQuery((b) => b.lessons(), []);
  const [studentId, setStudentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const people = students.data?.people ?? [];
  const nameOf = (id: string) => people.find((p) => p.id === id)?.firstName ?? 'Student';
  useEffect(() => { if (!studentId && people[0]) setStudentId(people[0].id); }, [people, studentId]);

  const create = async (kind: 'draft' | 'blank' | 'example') => {
    if (!backend || !studentId) return;
    setBusy(true); setError(null);
    try {
      const name = nameOf(studentId);
      const blocks = kind === 'draft' ? draftLesson(students.data?.progress[studentId] ?? null, name) : kind === 'example' ? exampleLesson(name) : [newBlock('question')];
      const plan = await backend.saveLesson({ studentId, title: kind === 'example' ? 'Example lesson: el pretérito de ir y ser' : `Lesson with ${name}`, date: today(), notes: '', blocks, live: { on: false, current: null } });
      navigate(`teach/room/${plan.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the lesson.'); }
    setBusy(false);
  };

  return (
    <div data-testid="room-list">
      <PageHeader eyebrow="Aula · Lesson room" title="Lesson room" subtitle="Plan a lesson, share your screen, and open each part to your student when you are ready. They follow and answer on their own phone or tablet." />
      <section className="card p-5">
        <h2 className="text-lg font-semibold">Plan a lesson</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-medium">For
            <select className="input !w-48" value={studentId} onChange={(e) => setStudentId(e.target.value)} data-testid="room-student">{people.map((p) => <option key={p.id} value={p.id}>{p.firstName}</option>)}</select>
          </label>
          <button type="button" className="btn-primary" disabled={busy || !studentId} onClick={() => void create('draft')} data-testid="room-draft"><Icon name="sparkle" size={18} /> Draft it from their week</button>
          <button type="button" className="btn-ghost" disabled={busy || !studentId} onClick={() => void create('blank')} data-testid="room-blank">Start blank</button>
          <button type="button" className="btn-ghost" disabled={busy || !studentId} onClick={() => void create('example')} data-testid="room-example"><Icon name="eye" size={16} /> Open an example lesson</button>
        </div>
        <p className="mt-2 text-sm text-ink-mute">A draft uses what the student has actually been getting wrong: a warm-up, their hardest point explained with their own mistakes, the exact forms they missed, and a wrap-up. You edit it from there.</p>
        {students.data && people.length === 0 && <p className="mt-2 rounded-xl bg-saffron-50 px-3 py-2 text-sm">Add a student first (Students, Add a student). A lesson is always planned for one student, even a practice one.</p>}
        <p className="mt-1 text-sm text-ink-mute"><b>Open an example lesson</b> makes a finished seven-part lesson for the student you chose, to try the room with. They see nothing until you start it and open a part, and you can delete it afterwards.</p>
        <ErrorText error={error} />
      </section>

      <h2 className="mb-2 mt-6 text-xl font-semibold">Your lessons</h2>
      {!lessons.data ? <Loading /> : lessons.data.length === 0 ? <p className="text-sm text-ink-mute">No lessons planned yet.</p> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {lessons.data.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => navigate(`teach/room/${l.id}`)} className="card flex w-full items-center gap-3 p-4 text-left hover:shadow-lift" data-testid="room-open">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${l.live.on ? 'bg-olive text-white' : 'bg-cream-100 text-ink-soft'}`}><Icon name={l.live.on ? 'video' : 'book'} size={20} /></span>
                <span className="min-w-0 flex-1"><b className="block truncate">{l.title}</b><span className="text-sm text-ink-mute">{nameOf(l.studentId)} · {l.date || l.createdAt.slice(0, 10)} · {l.blocks.length} part{l.blocks.length === 1 ? '' : 's'}{l.live.on ? ' · running now' : ''}</span></span>
                <Icon name="arrowRight" size={16} className="text-ink-mute" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BlockEditor({ b, i, n, onChange, onMove, onDelete, onDuplicate }: { b: LessonBlock; i: number; n: number; onChange: (b: LessonBlock) => void; onMove: (d: -1 | 1) => void; onDelete: () => void; onDuplicate: () => void }) {
  const set = (patch: Partial<LessonBlock>) => onChange({ ...b, ...patch });
  return (
    <li className="card p-4" data-testid="block-editor">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs font-bold text-cream">{i + 1}</span>
        <select className="input !w-44 !py-1.5 text-sm" value={b.type} onChange={(e) => set({ ...newBlock(e.target.value as LessonBlock['type']), id: b.id, title: b.title, body: b.body, open: b.open })} aria-label="Kind of part">{TYPES.map((t) => <option key={t} value={t}>{BLOCK_LABEL[t]}</option>)}</select>
        <input className="input min-w-0 flex-1 !py-1.5" value={b.title} onChange={(e) => set({ title: e.target.value })} placeholder="Heading" aria-label="Heading" />
        <div className="flex gap-1">
          <button type="button" className="ctrl !px-2" disabled={i === 0} onClick={() => onMove(-1)} aria-label="Move up">↑</button>
          <button type="button" className="ctrl !px-2" disabled={i === n - 1} onClick={() => onMove(1)} aria-label="Move down">↓</button>
          <button type="button" className="ctrl !px-2" onClick={onDuplicate} aria-label="Duplicate"><Icon name="copy" size={14} /></button>
          <button type="button" className="ctrl !px-2" onClick={onDelete} aria-label="Delete this part"><Icon name="trash" size={14} /></button>
        </div>
      </div>
      {b.type !== 'vocab' && <textarea className="input mt-2 min-h-[70px] w-full" value={b.body} onChange={(e) => set({ body: e.target.value })} placeholder={b.type === 'gap' ? 'The sentence, with ___ where the answer goes' : b.type === 'text' ? 'What you want to show or explain' : 'The question'} lang="es" spellCheck={false} data-testid="block-body" />}
      {b.type === 'gap' && <label className="mt-2 grid gap-1 text-sm font-medium">Right answer <span className="font-normal text-ink-mute">(more than one? separate with |)</span><input className="input" value={b.answer ?? ''} onChange={(e) => set({ answer: e.target.value })} placeholder="fui" lang="es" data-testid="block-answer" /></label>}
      {b.type === 'choice' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">Options <span className="font-normal text-ink-mute">(one per line)</span><textarea className="input min-h-[84px]" value={(b.options ?? []).join('\n')} onChange={(e) => set({ options: e.target.value.split('\n') })} lang="es" data-testid="block-options" /></label>
          <label className="grid content-start gap-1 text-sm font-medium">Right answer<select className="input" value={b.answer ?? ''} onChange={(e) => set({ answer: e.target.value })} data-testid="block-answer"><option value="">Choose…</option>{(b.options ?? []).filter((o) => o.trim()).map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
        </div>
      )}
      {b.type === 'vocab' && <label className="mt-2 grid gap-1 text-sm font-medium">Words <span className="font-normal text-ink-mute">(one per line: español = English)</span><textarea className="input min-h-[110px]" value={(b.pairs ?? []).map((p) => `${p.es} = ${p.en}`).join('\n')} onChange={(e) => set({ pairs: e.target.value.split('\n').map((l) => { const [es, ...en] = l.split('='); return { es: es.trim(), en: en.join('=').trim() }; }) })} lang="es" data-testid="block-pairs" /></label>}
    </li>
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

  const save = async (p: LessonPlan) => {
    if (!backend) return;
    setSaved('saving');
    try { await backend.saveLesson({ id: p.id, studentId: p.studentId, title: p.title, date: p.date, notes: p.notes, blocks: p.blocks, live: p.live }); if (latest.current === p) setSaved('saved'); setError(null); }
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
  if (!loaded || (!plan && !syncError)) return <Loading />;
  if (!plan) return <div className="card p-6"><p>{syncError ?? 'Lesson not found.'}</p><button className="btn-primary mt-3" onClick={() => navigate('teach/room')}>Back to the lesson room</button></div>;

  const here = isPresent(work, now);
  const setBlock = (bid: string, patch: Partial<LessonBlock>, immediate = false) => change((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === bid ? { ...b, ...patch } : b)) }), immediate);
  const cur = plan.blocks.find((b) => b.id === plan.live.current) ?? null;
  const idx = cur ? plan.blocks.indexOf(cur) : -1;
  const go = (b: LessonBlock, alsoOpen = false) => change((p) => ({ ...p, blocks: alsoOpen ? p.blocks.map((x) => (x.id === b.id ? { ...x, open: true } : x)) : p.blocks, live: { ...p.live, current: b.id } }), true);
  const openCount = plan.blocks.filter((b) => b.open).length;

  return (
    <div data-testid="teacher-room">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" className="ctrl" onClick={() => navigate('teach/room')}><Icon name="arrowLeft" size={14} /> Lesson room</button>
        <Segmented label="View" value={tab} onChange={setTab} options={[{ value: 'plan', label: 'Plan' }, { value: 'present', label: 'Present' }]} />
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${here ? 'bg-olive-50 text-olive ring-olive/40' : 'bg-white text-ink-mute ring-ink/10'}`} data-testid="presence" data-here={here}><span className={`h-2 w-2 rounded-full ${here ? 'bg-olive' : 'bg-ink/25'}`} /> {here ? `${name} is here` : `${name} is not in the lesson`}</span>
        <span className="ml-auto text-sm text-ink-mute" data-testid="save-state">{saved === 'saved' ? 'Saved' : saved === 'saving' ? 'Saving…' : 'Not saved yet'}</span>
      </div>
      <ErrorText error={error ?? syncError} />

      {tab === 'plan' && (
        <div className="grid gap-4">
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
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => setTab('present')} data-testid="to-present"><Icon name="video" size={18} /> Go to the Present screen</button>
            <button type="button" className="btn-ghost" onClick={async () => { if (!backend || !window.confirm('Delete this lesson and the answers given in it?')) return; await backend.deleteLesson(plan.id); notify('Lesson deleted'); navigate('teach/room'); }}><Icon name="trash" size={16} /> Delete this lesson</button>
          </div>
        </div>
      )}

      {tab === 'present' && (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <aside className="grid content-start gap-3">
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
            <ol className="grid gap-1.5" data-testid="block-list">
              {plan.blocks.map((b, i) => {
                const a = work?.answers[b.id];
                return (
                  <li key={b.id} className={`flex items-center gap-2 rounded-2xl p-2 ring-1 ${cur?.id === b.id ? 'bg-terracotta-50 ring-terracotta/50' : 'bg-white ring-ink/5'}`}>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => go(b)} data-testid={`goto-${i}`}>
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cream-100 text-xs font-bold">{i + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{b.title || BLOCK_LABEL[b.type]}</span><span className="block truncate text-xs text-ink-mute">{BLOCK_LABEL[b.type]}{a ? ` · answered${a.correct === true ? ' ✓' : a.correct === false ? ' ✗' : ''}` : ''}</span></span>
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

          <section className="min-w-0" data-testid="stage">
            {cur ? (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink-mute">Part {idx + 1} of {plan.blocks.length}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cur.open ? 'bg-olive text-white' : 'bg-saffron text-ink'}`} data-testid="stage-status">{cur.open ? `${name} can see this` : `Only you can see this`}</span>
                  {!cur.open && <button type="button" className="btn-primary !py-2" onClick={() => go(cur, true)} data-testid="show-to-student"><Icon name="eye" size={16} /> Show it to {name}</button>}
                  {(cur.type === 'gap' || cur.type === 'choice') && <button type="button" className="ctrl" onClick={() => setBlock(cur.id, { reveal: !cur.reveal }, true)} aria-pressed={!!cur.reveal} data-testid="reveal">{cur.reveal ? 'Hide the answer' : 'Show the answer'}</button>}
                </div>
                <BlockView block={cur} mode="present" answer={work?.answers[cur.id]} current />
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn-ghost" disabled={idx <= 0} onClick={() => go(plan.blocks[idx - 1])}><Icon name="arrowLeft" size={16} /> Back</button>
                  <button type="button" className="btn-dark" disabled={idx >= plan.blocks.length - 1} onClick={() => go(plan.blocks[idx + 1])} data-testid="next-part">Next <Icon name="arrowRight" size={16} /></button>
                </div>
              </>
            ) : <div className="card p-8 text-center text-ink-soft">{plan.blocks.length ? 'Choose a part on the left to put it on the screen.' : 'This lesson has no parts yet. Add some on the Plan tab.'}</div>}
          </section>
        </div>
      )}
    </div>
  );
}
