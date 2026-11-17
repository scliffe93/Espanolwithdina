import { useEffect, useMemo, useRef, useState } from 'react';
import { DinaArt } from '../../components/Dina';
import { Icon, type IconName } from '../../components/Icon';
import { Segmented } from '../../components/ui';
import { isPresent } from '../../../supabase/functions/_shared/lesson';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { BLOCK_LABEL, draftLesson, exampleLesson, newBlock } from '../../lib/platform/lessonDraft';
import { homeworkFromLesson, homeworkItems } from '../../lib/platform/lessonHomework';
import { adaptPlan, type AdaptedPlan } from '../../lib/platform/lessonAdapt';
import { describeImport, type ImportedPlan } from '../../lib/platform/lessonImport';
import { extractText, sourceKindOf } from '../../lib/extractText';
import type { LessonBlock, LessonPlan } from '../../lib/platform/types';
import { navigate } from '../../lib/router';
import { useStore } from '../../lib/store';
import { ErrorText, Loading, useStudents } from '../teach/shared';
import { BLOCK_THEME, BlockView, LessonTrail } from './Blocks';
import { useLesson } from './useLesson';

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

/**
 * The review of an uploaded or pasted plan, before any lesson exists: her document on one side, the parts made from it
 * on the other. She can retitle it, change what a part is, edit or remove parts and fill in missing answers, and only
 * then create the lesson. Cancelling leaves nothing behind.
 */
function ImportReview({ source, sourceName, made, studentName, busy, onCreate, onCancel }: { source: string; sourceName: string; made: AdaptedPlan; studentName: string; busy: boolean; onCreate: (title: string, blocks: LessonBlock[], notes: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(made.title);
  const [blocks, setBlocks] = useState<LessonBlock[]>(made.blocks);
  const [notes, setNotes] = useState(made.notes);
  const [showSource, setShowSource] = useState(true);
  const missing = blocks.filter((b) => (b.type === 'gap' || b.type === 'choice') && !(b.answer ?? '').trim()).length;
  const empty = blocks.filter((b) => b.type !== 'vocab' && !b.body.trim()).length;
  return (
    <div data-testid="import-review">
      <section className="relative overflow-hidden rounded-4xl bg-ink p-6 text-cream shadow-lift sm:p-7">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-olive/40 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1 basis-72">
            <p className="eyebrow !text-saffron-light">Revisa tu clase · Review before it is created</p>
            <h1 className="mt-1 font-display text-3xl font-semibold leading-tight sm:text-4xl">Here is the lesson made from your plan</h1>
            <p className="mt-2 max-w-2xl text-cream/80">From <b className="text-cream">{sourceName}</b>, for {studentName}. Check it against your document. Change anything that came out wrong, then create the lesson. Nothing has been saved yet.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-full bg-cream/10 px-5 py-3 font-semibold text-cream ring-1 ring-cream/20 hover:bg-cream/15" onClick={onCancel} data-testid="review-cancel">Cancel</button>
            <button type="button" className="inline-flex items-center gap-2 rounded-full bg-saffron px-6 py-3 font-bold text-ink shadow-lift transition hover:scale-[1.02] disabled:opacity-60" disabled={busy || blocks.length === 0} onClick={() => onCreate(title.trim() || 'Lesson', blocks, notes)} data-testid="review-create"><Icon name="check" size={18} /> Create the lesson · {blocks.length} part{blocks.length === 1 ? '' : 's'}</button>
          </div>
        </div>
        <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-cream/10 p-3 ring-1 ring-cream/10"><p className="text-xs text-cream/70">Made from your plan</p><p className="mt-0.5 font-semibold" data-testid="review-summary">{describeImport({ ...made, blocks, counts: Object.fromEntries(TYPES.map((t) => [t, blocks.filter((x) => x.type === t).length])) as ImportedPlan['counts'] })}</p></div>
          <div className={`rounded-2xl p-3 ring-1 ${missing ? 'bg-saffron text-ink ring-saffron' : 'bg-cream/10 ring-cream/10'}`} data-testid="review-missing"><p className={`text-xs ${missing ? 'text-ink/70' : 'text-cream/70'}`}>Answers</p><p className="mt-0.5 font-semibold">{missing ? `${missing} part${missing === 1 ? ' needs' : 's need'} an answer: they are marked below` : 'Every gap and choice has its answer'}</p></div>
          <div className="rounded-2xl bg-cream/10 p-3 ring-1 ring-cream/10"><p className="text-xs text-cream/70">Your student</p><p className="mt-0.5 font-semibold">Sees nothing until you start the lesson and open a part</p></div>
        </div>
      </section>

      <div className={`mt-5 grid gap-5 ${showSource ? 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]' : ''}`}>
        {showSource && (
          <aside className="lg:sticky lg:top-4 lg:self-start" data-testid="review-source">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-ink/5 bg-cream-100 px-4 py-2.5"><p className="eyebrow">Your document</p><button type="button" className="text-xs font-semibold text-ink-mute hover:text-ink" onClick={() => setShowSource(false)}>Hide</button></div>
              <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words p-4 font-sans text-[14px] leading-relaxed text-ink-soft" lang="es">{source.replace(/^# /gm, '').replace(/\t/g, '   ')}</pre>
            </div>
            <p className="mt-2 text-xs text-ink-mute">This is the text read from your file, on this device. In a PDF, headings in larger type start a new part.</p>
          </aside>
        )}
        <div className="min-w-0">
          <div className="card mb-3 flex flex-wrap items-end gap-3 p-4">
            <label className="grid min-w-0 flex-1 gap-1 text-sm font-medium">Title of the lesson<input className="input text-lg" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="review-title" /></label>
            {!showSource && <button type="button" className="ctrl" onClick={() => setShowSource(true)}><Icon name="eye" size={14} /> Show my document</button>}
          </div>
          {made.adapted.length > 0 && (
            <div className="mb-3 rounded-3xl bg-olive-50 p-4 ring-1 ring-olive/30" data-testid="review-adapted">
              <p className="font-semibold"><Icon name="sparkle" size={15} className="mr-1 inline" /> Adapted for a lesson on screen</p>
              <p className="mt-0.5 text-sm text-ink-soft">Your plan was written for a classroom. These parts were turned into things {studentName} does on their own screen:</p>
              <ul className="mt-2 grid gap-1 text-sm">{made.adapted.map((a) => <li key={a} className="flex gap-2"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-olive" /> <span>{a}</span></li>)}</ul>
            </div>
          )}
          {(made.notes || notes) && (
            <details className="card mb-3 p-4" data-testid="review-notes">
              <summary className="cursor-pointer font-semibold">Your own notes <span className="font-normal text-ink-mute">· the timings and steps from your plan, only you see these</span></summary>
              <textarea className="input mt-3 min-h-[180px] w-full text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={6000} />
            </details>
          )}
          {empty > 0 && <p className="mb-3 rounded-2xl bg-saffron-50 px-4 py-2.5 text-sm ring-1 ring-saffron/40">{empty} part{empty === 1 ? ' is' : 's are'} empty. Remove {empty === 1 ? 'it' : 'them'} or type what should be there.</p>}
          <ol className="grid gap-3">
            {blocks.map((b, i) => (
              <BlockEditor key={b.id} b={b} i={i} n={blocks.length} flag={(b.type === 'gap' || b.type === 'choice') && !(b.answer ?? '').trim()}
                onChange={(nb) => setBlocks((bs) => bs.map((x) => (x.id === b.id ? nb : x)))}
                onMove={(d) => setBlocks((bs) => { const arr = [...bs]; const j = i + d; [arr[i], arr[j]] = [arr[j], arr[i]]; return arr; })}
                onDelete={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}
                onDuplicate={() => setBlocks((bs) => { const arr = [...bs]; arr.splice(i + 1, 0, { ...b, id: newBlock(b.type).id }); return arr; })} />
            ))}
          </ol>
          {blocks.length === 0 && <p className="card p-6 text-center text-ink-soft">Every part has been removed. Cancel, or go back and upload the plan again.</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={busy || blocks.length === 0} onClick={() => onCreate(title.trim() || 'Lesson', blocks, notes)}><Icon name="check" size={18} /> Create the lesson</button>
            <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
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

/** The teacher's lessons: one list, newest first, with the ways to start a new one. */
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

  // A lesson from the teacher's own plan: a document she uploads, or text she pastes. It is shown to her for review
  // first; the lesson is only created when she says so.
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [review, setReview] = useState<{ source: string; name: string; made: AdaptedPlan } | null>(null);
  const read = (text: string, name: string, fallback: string) => {
    const made = adaptPlan(text, fallback);
    if (!made.blocks.length) { setError('Nothing could be read from that. If it is a scanned page or a photo, paste the text instead.'); return; }
    setError(null); setReview({ source: text.trim(), name, made });
    window.scrollTo({ top: 0 });
  };
  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      if (!sourceKindOf(file)) throw new Error('Use a Word document (.docx), a PDF or a text file.');
      const r = await extractText(file, { layout: true });
      read(r.text, file.name, file.name.replace(/\.[^.]+$/, ''));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read that file.'); }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };
  const createFromReview = async (title: string, blocks: LessonBlock[], notes: string) => {
    if (!backend || !studentId) return;
    setBusy(true); setError(null);
    try {
      const plan = await backend.saveLesson({ studentId, title, date: today(), notes, blocks, live: { on: false, current: null } });
      navigate(`teach/room/${plan.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the lesson.'); setBusy(false); }
  };

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

  if (review) return (<><ErrorText error={error} /><ImportReview source={review.source} sourceName={review.name} made={review.made} studentName={nameOf(studentId)} busy={busy} onCreate={(t, b, n) => void createFromReview(t, b, n)} onCancel={() => { setReview(null); setError(null); }} /></>);

  const none = !!students.data && people.length === 0;
  const running = (lessons.data ?? []).filter((l) => l.live.on);
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
          {[['Plan', 'Build the lesson beforehand, or bring a plan you already have.'], ['Share your screen', 'Open Present on your call and start the lesson.'], ['Open each part', 'They see a part only when you show it. Their answers come to you.']].map(([t, d], i) => (
            <li key={t} className="flex items-start gap-3 rounded-2xl bg-cream/10 p-3 ring-1 ring-cream/10"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-saffron text-sm font-bold text-ink">{i + 1}</span><span><b className="block">{t}</b><span className="text-sm text-cream/75">{d}</span></span></li>
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
          <h2 className="text-2xl font-semibold">Start a lesson</h2>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-soft">for
            <select className="input !w-48 !py-2" value={studentId} onChange={(e) => setStudentId(e.target.value)} data-testid="room-student">{people.map((p) => <option key={p.id} value={p.id}>{p.firstName}</option>)}</select>
          </label>
        </div>
        {none && <p className="mb-3 rounded-2xl bg-saffron-50 px-4 py-3 text-sm ring-1 ring-saffron/40">Add a student first (Students, Add a student). A lesson is always planned for one student, even a practice one.</p>}
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,application/pdf,text/plain" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} data-testid="room-file" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StartCard primary icon="sparkle" tone="" title="Draft it from their week" text="A warm-up, their hardest point with their own mistakes, the exact forms they missed, a wrap-up." onClick={() => void create('draft')} disabled={busy || !studentId} testid="room-draft" />
          <StartCard icon="upload" tone="bg-azul-50 text-azul" title={busy ? 'Reading your plan…' : 'Upload a plan'} text="A Word document, a PDF or a text file. You review what it makes before the lesson is created." onClick={() => fileRef.current?.click()} disabled={busy || !studentId} testid="room-upload" />
          <StartCard icon="copy" tone="bg-olive-50 text-olive" title="Paste a plan" text="Copy your plan from anywhere and paste it in. You review it first, the same way." onClick={() => setPasting(!pasting)} disabled={busy || !studentId} testid="room-paste-toggle" />
          <StartCard icon="eye" tone="bg-saffron-50 text-ink" title="Open an example lesson" text="A finished seven-part lesson on the preterite of ir and ser, to try the room with." onClick={() => void create('example')} disabled={busy || !studentId} testid="room-example" />
          <StartCard icon="edit" tone="bg-cream-100 text-ink-soft" title="Start blank" text="An empty lesson. Add the parts yourself." onClick={() => void create('blank')} disabled={busy || !studentId} testid="room-blank" />
        </div>
        {pasting && (
          <div className="card mt-3 p-4" data-testid="room-import">
            <label className="font-semibold" htmlFor="room-paste">Paste your lesson plan</label>
            <textarea id="room-paste" className="input mt-2 min-h-[180px] w-full" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={'El pretérito: ir y ser\n\nCalentamiento\n¿Qué hiciste el fin de semana?\n\nPráctica:\nAyer yo ___ (ir) al mercado. [fui]\n\nVocabulario\nayer = yesterday\nanoche = last night'} data-testid="room-paste" />
            <button type="button" className="btn-primary mt-2" disabled={busy || !pasted.trim() || !studentId} onClick={() => read(pasted, 'your pasted plan', 'Lesson')} data-testid="room-paste-go"><Icon name="eye" size={16} /> Review it</button>
          </div>
        )}
        <a href={`${import.meta.env.BASE_URL}guides/lesson-plan-template.docx`} download className="mt-3 flex items-center gap-3 rounded-2xl bg-azul-50 px-4 py-3 text-sm ring-1 ring-azul/20 transition hover:ring-azul/50" data-testid="room-template">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-azul"><Icon name="download" size={17} /></span>
          <span className="min-w-0 flex-1"><b className="block text-ink">Download the Word template</b><span className="text-ink-soft">A lesson plan laid out the right way, with a page explaining everything you can write. Replace the example with your own lesson and upload it.</span></span>
        </a>
        <details className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-ink-soft ring-1 ring-ink/5">
          <summary className="cursor-pointer font-semibold text-ink">How a plan is read</summary>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            <li><b className="text-ink">A heading</b> starts a new part: a short line on its own, a line in capitals, one ending with a colon, or larger type in a PDF.</li>
            <li><b className="text-ink">A sentence with ___</b> becomes fill-the-gap. Put the answer after it in square brackets: <span lang="es">Ayer yo ___ al cine. [fui]</span> Or list them on a line starting “Answers:”.</li>
            <li><b className="text-ink">A question followed by a) b) c)</b> becomes multiple choice. Put a star after the right one.</li>
            <li><b className="text-ink">A line ending in a question mark</b> becomes an open question.</li>
            <li><b className="text-ink">Lines like</b> <span lang="es">la playa = the beach</span> become a word list.</li>
            <li><b className="text-ink">END OF LESSON</b> on a line of its own ends the lesson. Anything below it is your own notes and is not read.</li>
            <li><b className="text-ink">A classroom plan with worksheets</b> is adapted: a phrase table becomes a word list, matching and word-box exercises become multiple choice with the answers from your answer key, role-play cards become a role play for two, and the timed steps written for you go into your own notes.</li>
            <li><b className="text-ink">Everything else</b> becomes an explanation. Nothing is invented and nothing is left out.</li>
          </ul>
          <p className="mt-2">The file is read on this device. A scanned page or a photo has no text to read: paste the text instead.</p>
        </details>
        <ErrorText error={error} />
      </section>

      <h2 className="mb-3 mt-8 text-2xl font-semibold">Your lessons</h2>
      {!lessons.data ? <Loading /> : lessons.data.length === 0 ? <p className="card p-6 text-center text-ink-soft" data-testid="room-none">No lessons yet. Start one above: the example lesson is the quickest way to see how the room works.</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {lessons.data.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => navigate(`teach/room/${l.id}`)} className={`flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-soft ${l.live.on ? 'ring-2 ring-olive' : 'ring-ink/10'}`} data-testid="room-open">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${l.live.on ? 'bg-olive text-white' : 'bg-cream-100 text-ink-soft'}`}><Icon name={l.live.on ? 'video' : 'book'} size={22} /></span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[16px]">{l.title}</b>
                  <span className="block text-sm text-ink-mute">{nameOf(l.studentId)} · {new Date(`${l.date || l.createdAt.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}{l.live.on ? ' · running now' : ''}</span>
                  <span className="mt-1.5 block"><PartChips blocks={l.blocks} /></span>
                </span>
                <Icon name="arrowRight" size={16} className="shrink-0 text-ink-mute" />
              </button>
            </li>
          ))}
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
        {preview && <div className="mt-3 rounded-3xl bg-cream-100 p-3"><p className="eyebrow mb-2">As your student sees it</p><BlockView block={b} mode="present" /></div>}
      </div>
    </li>
  );
}

/** Send the tasks of a lesson to the student as homework, to do on their own afterwards. */
function SendHomework({ plan, name }: { plan: LessonPlan; name: string }) {
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
      await backend.assignHomework({ studentIds: [plan.studentId], activity: { kind: 'material', title: `From our lesson: ${plan.title}`, material: homeworkFromLesson(plan.title, plan.blocks) }, instructions: note.trim() || 'The tasks from our lesson, to do again on your own.', dueAt: new Date(`${due}T20:00:00`).toISOString() });
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
  // The stage can fill the whole screen for sharing on a call, and the arrow keys move through the lesson.
  const stageRef = useRef<HTMLElement>(null);
  const [full, setFull] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  useEffect(() => { const on = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', on); return () => document.removeEventListener('fullscreenchange', on); }, []);
  const keyNav = useRef<(d: number) => void>(() => undefined);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.target as HTMLElement | null)?.closest('input,textarea,select')) return; if (e.key === 'ArrowRight') keyNav.current(1); else if (e.key === 'ArrowLeft') keyNav.current(-1); };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  }, []);

  if (!loaded || (!plan && !syncError)) return <Loading />;
  if (!plan) return <div className="card p-6"><p>{syncError ?? 'Lesson not found.'}</p><button className="btn-primary mt-3" onClick={() => navigate('teach/room')}>Back to the lesson room</button></div>;

  const here = isPresent(work, now);
  const setBlock = (bid: string, patch: Partial<LessonBlock>, immediate = false) => change((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === bid ? { ...b, ...patch } : b)) }), immediate);
  const cur = plan.blocks.find((b) => b.id === plan.live.current) ?? null;
  const idx = cur ? plan.blocks.indexOf(cur) : -1;
  const go = (b: LessonBlock, alsoOpen = false) => change((p) => ({ ...p, blocks: alsoOpen ? p.blocks.map((x) => (x.id === b.id ? { ...x, open: true } : x)) : p.blocks, live: { ...p.live, current: b.id } }), true);
  const openCount = plan.blocks.filter((b) => b.open).length;
  const toggleFull = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void stageRef.current?.requestFullscreen?.().catch(() => undefined); };
  keyNav.current = (d) => { if (tab !== 'present' || idx < 0) return; const b = plan.blocks[idx + d]; if (b) go(b, d > 0 && !!cur?.open && autoOpen); };

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
          <SendHomework plan={plan} name={name} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => setTab('present')} data-testid="to-present"><Icon name="video" size={18} /> Go to the Present screen</button>
            <button type="button" className="btn-ghost" onClick={async () => { if (!backend || !window.confirm('Delete this lesson and the answers given in it?')) return; await backend.deleteLesson(plan.id); notify('Lesson deleted'); navigate('teach/room'); }}><Icon name="trash" size={16} /> Delete this lesson</button>
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
                const a = work?.answers[b.id];
                return (
                  <li key={b.id} className={`flex min-w-0 items-center gap-2 overflow-hidden rounded-2xl p-2 ring-1 ${cur?.id === b.id ? 'bg-terracotta-50 ring-terracotta/50' : 'bg-white ring-ink/5'}`}>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => go(b)} data-testid={`goto-${i}`}>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${BLOCK_THEME[b.type].badge}`}>{i + 1}</span>
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

          <section ref={stageRef} className={`min-w-0 ${full ? 'flex h-full flex-col overflow-y-auto bg-cream p-5 sm:p-8' : ''}`} data-testid="stage">
            {cur ? (
              <>
                <div className="mb-3 rounded-3xl bg-white p-3 shadow-soft ring-1 ring-ink/5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-cream">{idx + 1} / {plan.blocks.length}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cur.open ? 'bg-olive text-white' : 'bg-saffron text-ink'}`} data-testid="stage-status">{cur.open ? `${name} can see this` : `Only you can see this`}</span>
                    {!cur.open && <button type="button" className="btn-primary !py-2" onClick={() => go(cur, true)} data-testid="show-to-student"><Icon name="eye" size={16} /> Show it to {name}</button>}
                    {(cur.type === 'gap' || cur.type === 'choice') && <button type="button" className="ctrl" onClick={() => setBlock(cur.id, { reveal: !cur.reveal }, true)} aria-pressed={!!cur.reveal} data-testid="reveal">{cur.reveal ? 'Hide the answer' : 'Show the answer'}</button>}
                    <button type="button" className="ctrl ml-auto" onClick={toggleFull} data-testid="stage-full"><Icon name="video" size={14} /> {full ? 'Leave full screen' : 'Full screen to share'}</button>
                  </div>
                  <div className="mt-3"><LessonTrail blocks={plan.blocks} answers={work?.answers} current={cur.id} onGo={(bid) => { const b = plan.blocks.find((x) => x.id === bid); if (b) go(b); }} /></div>
                </div>
                <div className={full ? 'mx-auto w-full max-w-5xl flex-1' : ''}><BlockView key={cur.id} block={cur} mode="present" answer={work?.answers[cur.id]} current /></div>
                <div className={`mt-4 flex items-center gap-2 ${full ? 'mx-auto w-full max-w-5xl' : ''}`}>
                  <button type="button" className="btn-ghost" disabled={idx <= 0} onClick={() => go(plan.blocks[idx - 1])}><Icon name="arrowLeft" size={16} /> Back</button>
                  <button type="button" className="btn-dark" disabled={idx >= plan.blocks.length - 1} onClick={() => go(plan.blocks[idx + 1], cur.open && autoOpen)} data-testid="next-part">Next <Icon name="arrowRight" size={16} /></button>
                  <label className="ml-2 flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={autoOpen} onChange={(e) => setAutoOpen(e.target.checked)} data-testid="auto-open" /> Show each part to {name} as I go</label>
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
