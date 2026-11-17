import { useEffect, useRef, useState } from 'react';
import { DinaArt } from '../../components/Dina';
import { Icon } from '../../components/Icon';
import { usePlatformQuery } from '../../lib/platform/context';
import { navigate } from '../../lib/router';
import { detectWording, wordingFor } from '../../lib/platform/lessonAdapt';
import { useLevelAccess } from '../../lib/platform/useLevelAccess';
import { reportFailure } from '../../lib/diagnostics';
import { BlockView, LessonClock, LessonTrail } from './Blocks';
import { Whiteboard } from './Whiteboard';
import { SYS, bankOf, boardOf, partsOf } from '../../lib/platform/lessonExtras';
import { useLesson } from './useLesson';

/** The student's side of a lesson: what the teacher has opened, following the part she is on, with their answers. */
export function StudentRoom({ id }: { id: string }) {
  const { plan, work, error, loaded, answer, fails, sync } = useLesson(id);
  // If the lesson will not open, the app keeps trying by itself. After several tries it tells the team what it tried.
  const told = useRef(false);
  const [notes, setNotes] = useState<string | null>(null);
  const noteTimer = useRef<number>();
  useEffect(() => {
    if (plan || fails < 4 || told.current) return;
    told.current = true;
    reportFailure('A lesson would not open', ['Asked for the lesson three times in a row, each time it was requested', `Kept asking every few seconds (${fails} rounds so far)`], error ?? 'no answer from the server');
  }, [plan, fails, error]);
  const current = plan?.live.current ?? null;
  // The small words on screen follow the wording the teacher chose for this lesson.
  const mine = wordingFor(useLevelAccess().level);
  const last = useRef<string | null>(null);
  // When the teacher moves on, the student's screen moves with her.
  useEffect(() => {
    if (!current || current === last.current) return;
    last.current = current;
    document.querySelector(`[data-testid="block-${current}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [current]);

  if (!loaded) return <p className="text-sm text-ink-mute">Opening your lesson…</p>;
  const wording = plan && plan.blocks.length ? detectWording(plan.blocks) : mine;
  // The student's own notes: kept with the lesson, saved a moment after they stop typing.
  const savedNotes = work?.answers[SYS.notes]?.value ?? '';
  const writeNotes = (v: string) => { setNotes(v); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => void answer(SYS.notes, v.slice(0, 2000)), 900); };
  if (!plan) return (
    <div className="card p-6" data-testid="room-trouble">
      {fails < 4 ? (
        <><p className="font-semibold">Opening your lesson…</p><p className="mt-1 text-sm text-ink-soft">It did not open first time, so the app is trying again by itself{fails > 1 ? ` (try ${fails + 1})` : ''}. You do not need to do anything.</p></>
      ) : (
        <><p className="font-semibold">Your lesson will not open yet.</p>
          <p className="mt-1 text-sm text-ink-soft">The app has tried {fails} times and is still trying every few seconds. The team has been told what happened and what was tried, so you do not need to report it. Tell Dina you are waiting; the lesson will appear here by itself as soon as it can.</p>
          <p className="mt-2 text-xs text-ink-mute">What came back: {error ?? 'no answer'}</p></>
      )}
      <div className="mt-4 flex flex-wrap gap-2"><button className="btn-primary" onClick={() => void sync()} data-testid="room-retry">Try now</button><button className="btn-ghost" onClick={() => navigate('student')}>Back to my lessons</button></div>
    </div>
  );
  const parts = partsOf(plan.blocks);
  const board = boardOf(plan.blocks);
  const bank = bankOf(plan.blocks);
  const canNote = plan.blocks.some((b) => b.id === SYS.notes);
  return (
    <div className="mx-auto max-w-3xl" data-testid="student-room">
      <button type="button" className="ctrl mb-4" onClick={() => navigate('student')}><Icon name="arrowLeft" size={14} /> My lessons</button>
      <div className="flex items-center gap-4">
        <DinaArt size={72} expression="beam" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Clase con Dina · Lesson with Dina</p>
          <h1 className="font-display text-3xl font-semibold leading-tight">{plan.title}</h1>
          <p className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${plan.live.on ? 'text-olive' : 'text-ink-mute'}`} data-testid="room-status"><span className={`h-2 w-2 rounded-full ${plan.live.on ? 'bg-olive' : 'bg-ink/25'}`} /> {plan.live.on ? 'The lesson is on. Your screen follows Dina.' : parts.length ? 'The lesson is over. These are your notes from it.' : 'Dina has not started yet. Keep this page open.'}</p>
        </div>
      </div>
      {error && <p className="mt-3 rounded-xl bg-saffron-50 px-3 py-2 text-sm" role="status">Reconnecting… ({error})</p>}
      {parts.length > 0 && <div className="sticky top-2 z-10 mt-4 rounded-3xl bg-white/95 p-3 shadow-soft ring-1 ring-ink/5 backdrop-blur"><LessonTrail blocks={parts} answers={work?.answers} current={plan.live.on ? current : null} />{plan.live.on && plan.live.startedAt && <div className="mt-2"><LessonClock startedAt={plan.live.startedAt} blocks={parts} current={current} compact /></div>}</div>}
      <div className="mt-5 grid gap-4">
        {parts.length === 0 ? (
          <div className="card p-8 text-center text-ink-soft" data-testid="room-waiting">{plan.live.on ? 'Dina will put the first part on your screen in a moment.' : 'When Dina starts the lesson, it appears here by itself.'}</div>
        ) : parts.map((b) => <BlockView key={b.id} block={b} mode="student" answer={work?.answers[b.id]} onAnswer={plan.live.on || true ? (v) => void answer(b.id, v) : undefined} current={plan.live.on && b.id === current} wording={wording} />)}
      </div>
      {(board.open && (board.text || board.strokes.length > 0)) && (
        <section className="mt-5" data-testid="student-board">
          <p className="eyebrow mb-2">Pizarra · The whiteboard from this lesson</p>
          <Whiteboard board={board} />
        </section>
      )}
      {(bank.words.length > 0 || bank.verbs.length > 0) && (
        <section className="card mt-5 p-5" data-testid="student-lesson-bank">
          <p className="eyebrow">Para recordar · To keep from this lesson</p>
          {bank.words.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{bank.words.map((w) => <span key={w.es} className="rounded-full bg-rosa-50 px-3 py-1.5 text-sm"><b lang="es">{w.es}</b>{w.en && <span className="text-ink-soft"> · {w.en}</span>}</span>)}</div>}
          {bank.verbs.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-1.5">{bank.verbs.map((v) => <span key={v.es} className="rounded-full bg-azul-50 px-3 py-1.5 text-sm"><b lang="es">{v.es}</b>{v.en && <span className="text-ink-soft"> · {v.en}</span>}</span>)}<button type="button" className="ctrl" onClick={() => navigate(`verbs?focus=${bank.verbs.map((v) => v.es).join(',')}&start=1`)}>Practise these verbs</button></div>}
        </section>
      )}
      {canNote && (
        <section className="card mt-5 p-5" data-testid="student-notes">
          <label className="eyebrow" htmlFor="my-notes">Mis apuntes · My notes</label>
          <p className="mt-0.5 text-sm text-ink-soft">Write down anything you want to remember. Your notes stay with this lesson, so you can read them again afterwards.</p>
          <textarea id="my-notes" className="input mt-2 min-h-[120px] w-full" value={notes ?? savedNotes} onChange={(e) => writeNotes(e.target.value)} maxLength={2000} placeholder="Una palabra nueva, una regla, una frase que te gusta…" data-testid="student-notes-text" />
          <p className="mt-1 text-xs text-ink-mute" data-testid="student-notes-state">{notes === null || notes === savedNotes ? (savedNotes ? 'Saved' : '') : 'Saving…'}</p>
        </section>
      )}
    </div>
  );
}

/** On the student's home page: a lesson that is running now (join it), and notes from earlier ones. */
export function RoomCard() {
  const q = usePlatformQuery((b) => (b.actor.role === 'student' ? b.lessons() : Promise.resolve([])), []);
  // Look again every few seconds, so "the lesson is open" appears without reloading the page.
  // (The timer is set once: the page redraws every second for the study clock, and a timer reset on each redraw would never fire.)
  const reload = useRef(q.reload); reload.current = q.reload;
  useEffect(() => { const iv = setInterval(() => { if (document.visibilityState === 'visible') reload.current(); }, 5000); return () => clearInterval(iv); }, []);
  const lessons = q.data ?? [];
  const live = lessons.find((l) => l.live.on);
  const all = lessons.filter((l) => !l.live.on && partsOf(l.blocks).length > 0);
  // Everything the teacher has banked for this student, across their lessons.
  const [showBank, setShowBank] = useState(false);
  const banked = lessons.map((l) => bankOf(l.blocks));
  const uniq = (list: { es: string; en: string }[]) => list.filter((x, i, a) => a.findIndex((y) => y.es.toLowerCase() === x.es.toLowerCase()) === i);
  const bankWords = uniq(banked.flatMap((b) => b.words)), bankVerbs = uniq(banked.flatMap((b) => b.verbs));
  const [showAll, setShowAll] = useState(false);
  const past = showAll ? all : all.slice(0, 3);
  const dayOf = (l: (typeof all)[number]) => new Date(`${l.date || l.createdAt.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const wordsOf = (l: (typeof all)[number]) => partsOf(l.blocks).filter((b) => b.type === 'vocab').reduce((n, b) => n + (b.pairs?.length ?? 0), 0);
  if (!live && past.length === 0 && !bankWords.length && !bankVerbs.length) return null;
  return (
    <section className="mb-4" data-testid="room-card">
      {live && (
        <button type="button" onClick={() => navigate(`student/room/${live.id}`)} className="flex w-full items-center gap-4 rounded-3xl bg-olive p-5 text-left text-white shadow-lift" data-testid="join-lesson">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20"><Icon name="video" size={24} /></span>
          <span className="min-w-0 flex-1"><span className="eyebrow !text-white/80">Tu clase está abierta · Your lesson is open</span><b className="block truncate font-display text-2xl">{live.title}</b><span className="text-sm text-white/85">Follow along and answer on this device.</span></span>
          <span className="rounded-full bg-white px-4 py-2 font-bold text-ink">Join</span>
        </button>
      )}
      {past.length > 0 && (
        <div className={`card p-4 ${live ? 'mt-3' : ''}`}>
          <p className="eyebrow">Apuntes de clase · Notes from your lessons</p>
          <p className="mb-3 mt-0.5 text-sm text-ink-soft">Go back over any lesson: the words, the questions, your answers and the right ones.</p>
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="lesson-notes">
            {past.map((l) => { const tasks = partsOf(l.blocks).filter((b) => b.type === 'gap' || b.type === 'choice' || b.type === 'question').length; const words = wordsOf(l); return (
              <li key={l.id}>
                <button type="button" className="flex w-full items-center gap-3 rounded-2xl bg-cream-100 px-3 py-3 text-left transition hover:bg-cream-200" onClick={() => navigate(`student/room/${l.id}`)} data-testid="lesson-note">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-azul"><Icon name="book" size={18} /></span>
                  <span className="min-w-0 flex-1"><b className="block truncate">{l.title}</b><span className="block text-sm text-ink-mute">{dayOf(l)}{words ? ` · ${words} words` : ''}{tasks ? ` · ${tasks} tasks` : ''}</span></span>
                  <Icon name="arrowRight" size={14} className="shrink-0 text-ink-mute" />
                </button>
              </li>
            ); })}
          </ul>
          {all.length > 3 && <button type="button" className="ctrl mt-3" onClick={() => setShowAll(!showAll)} data-testid="lesson-notes-all">{showAll ? 'Show fewer' : `Show all ${all.length} lessons`}</button>}
        </div>
      )}
      {(bankWords.length > 0 || bankVerbs.length > 0) && (
        <div className="card mt-3 p-4" data-testid="my-bank">
          <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setShowBank(!showBank)} aria-expanded={showBank} data-testid="my-bank-open">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rosa-50"><Icon name="translate" size={18} /></span>
            <span className="min-w-0 flex-1"><span className="eyebrow">Mi banco · My word and verb bank</span><b className="block">{bankWords.length} word{bankWords.length === 1 ? '' : 's'} and {bankVerbs.length} verb{bankVerbs.length === 1 ? '' : 's'} from your lessons</b></span>
            <Icon name="arrowRight" size={14} className={`shrink-0 text-ink-mute transition ${showBank ? 'rotate-90' : ''}`} />
          </button>
          {showBank && (
            <div className="mt-3 border-t border-ink/5 pt-3">
              {bankWords.length > 0 && <><p className="eyebrow mb-1.5">Palabras · Words</p><ul className="grid gap-1.5 sm:grid-cols-2" data-testid="my-bank-words">{bankWords.map((w) => <li key={w.es} className="flex items-baseline justify-between gap-3 rounded-xl bg-rosa-50 px-3 py-2"><b lang="es" className="font-display text-lg">{w.es}</b><span className="text-sm text-ink-soft">{w.en}</span></li>)}</ul></>}
              {bankVerbs.length > 0 && <><p className="eyebrow mb-1.5 mt-3">Verbos · Verbs</p><div className="flex flex-wrap items-center gap-1.5" data-testid="my-bank-verbs">{bankVerbs.map((v) => <span key={v.es} className="rounded-full bg-azul-50 px-3 py-1.5 text-sm"><b lang="es">{v.es}</b>{v.en && <span className="text-ink-soft"> · {v.en}</span>}</span>)}</div><button type="button" className="btn-primary mt-3" onClick={() => navigate(`verbs?focus=${bankVerbs.slice(0, 8).map((v) => v.es).join(',')}&start=1`)} data-testid="my-bank-practise"><Icon name="play" size={16} filled /> Practise these verbs</button></>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
