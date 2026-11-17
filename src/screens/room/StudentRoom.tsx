import { useEffect, useRef } from 'react';
import { DinaArt } from '../../components/Dina';
import { Icon } from '../../components/Icon';
import { usePlatformQuery } from '../../lib/platform/context';
import { navigate } from '../../lib/router';
import { wordingFor } from '../../lib/platform/lessonAdapt';
import { useLevelAccess } from '../../lib/platform/useLevelAccess';
import { BlockView, LessonClock, LessonTrail } from './Blocks';
import { useLesson } from './useLesson';

/** The student's side of a lesson: what the teacher has opened, following the part she is on, with their answers. */
export function StudentRoom({ id }: { id: string }) {
  const { plan, work, error, loaded, answer } = useLesson(id);
  const current = plan?.live.current ?? null;
  const wording = wordingFor(useLevelAccess().level);
  const last = useRef<string | null>(null);
  // When the teacher moves on, the student's screen moves with her.
  useEffect(() => {
    if (!current || current === last.current) return;
    last.current = current;
    document.querySelector(`[data-testid="block-${current}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [current]);

  if (!loaded) return <p className="text-sm text-ink-mute">Opening your lesson…</p>;
  if (!plan) return <div className="card p-6"><p>{error ?? 'This lesson is not available.'}</p><button className="btn-primary mt-3" onClick={() => navigate('student')}>Back to my lessons</button></div>;
  return (
    <div className="mx-auto max-w-3xl" data-testid="student-room">
      <button type="button" className="ctrl mb-4" onClick={() => navigate('student')}><Icon name="arrowLeft" size={14} /> My lessons</button>
      <div className="flex items-center gap-4">
        <DinaArt size={72} expression="beam" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Clase con Dina · Lesson with Dina</p>
          <h1 className="font-display text-3xl font-semibold leading-tight">{plan.title}</h1>
          <p className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${plan.live.on ? 'text-olive' : 'text-ink-mute'}`} data-testid="room-status"><span className={`h-2 w-2 rounded-full ${plan.live.on ? 'bg-olive' : 'bg-ink/25'}`} /> {plan.live.on ? 'The lesson is on. Your screen follows Dina.' : plan.blocks.length ? 'The lesson is over. These are your notes from it.' : 'Dina has not started yet. Keep this page open.'}</p>
        </div>
      </div>
      {error && <p className="mt-3 rounded-xl bg-saffron-50 px-3 py-2 text-sm" role="status">Reconnecting… ({error})</p>}
      {plan.blocks.length > 0 && <div className="sticky top-2 z-10 mt-4 rounded-3xl bg-white/95 p-3 shadow-soft ring-1 ring-ink/5 backdrop-blur"><LessonTrail blocks={plan.blocks} answers={work?.answers} current={plan.live.on ? current : null} />{plan.live.on && plan.live.startedAt && <div className="mt-2"><LessonClock startedAt={plan.live.startedAt} blocks={plan.blocks} current={current} compact /></div>}</div>}
      <div className="mt-5 grid gap-4">
        {plan.blocks.length === 0 ? (
          <div className="card p-8 text-center text-ink-soft" data-testid="room-waiting">{plan.live.on ? 'Dina will put the first part on your screen in a moment.' : 'When Dina starts the lesson, it appears here by itself.'}</div>
        ) : plan.blocks.map((b) => <BlockView key={b.id} block={b} mode="student" answer={work?.answers[b.id]} onAnswer={plan.live.on || true ? (v) => void answer(b.id, v) : undefined} current={plan.live.on && b.id === current} wording={wording} />)}
      </div>
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
  const past = lessons.filter((l) => !l.live.on && l.blocks.length > 0).slice(0, 3);
  if (!live && past.length === 0) return null;
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
          <p className="eyebrow mb-2">Apuntes de clase · Notes from your lessons</p>
          <ul className="grid gap-1.5">{past.map((l) => <li key={l.id}><button type="button" className="flex w-full items-center justify-between gap-3 rounded-xl bg-cream-100 px-3 py-2.5 text-left hover:bg-cream-200" onClick={() => navigate(`student/room/${l.id}`)}><span className="min-w-0 truncate font-semibold">{l.title}</span><span className="shrink-0 text-sm text-ink-mute">{l.date || l.createdAt.slice(0, 10)} <Icon name="arrowRight" size={14} className="inline" /></span></button></li>)}</ul>
        </div>
      )}
    </section>
  );
}
