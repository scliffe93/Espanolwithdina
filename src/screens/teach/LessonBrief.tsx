import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { lessonBrief } from '../../../supabase/functions/_shared/brief';
import type { AppState } from '../../lib/platform/context';
import type { Booking, Homework } from '../../lib/platform/types';

const WEEK = 7 * 86_400_000;

/** When the student's previous lesson was: the start of the window the brief covers. A week back if there was none. */
export function lastLessonBefore(bookings: Booking[], studentId: string, before: number): number {
  const past = bookings.filter((b) => b.studentId === studentId && b.status !== 'cancelled' && Date.parse(b.startsAt) < before).map((b) => Date.parse(b.startsAt)).sort((a, b) => b - a)[0];
  return past ?? before - WEEK;
}

/**
 * The brief before a lesson: what the student did since the last one, what keeps going wrong, the state of their
 * homework and what to do about it. The same summary is sent to the teacher's phone an hour before the lesson.
 */
export function LessonBrief({ name, state, homework, since, now = Date.now(), startOpen = false, title = 'Before this lesson' }: { name: string; state: AppState | null; homework: Homework[]; since: number; now?: number; startOpen?: boolean; title?: string }) {
  const [open, setOpen] = useState(startOpen);
  const b = lessonBrief(state?.days as never, homework as never, since, now);
  const quiet = b.daysPractised === 0 && b.attempts === 0;
  return (
    <div className="mt-3 rounded-2xl bg-cream-100 p-3 text-sm" data-testid="lesson-brief">
      <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="bulb" size={16} className={`mt-0.5 shrink-0 ${quiet ? 'text-ink-mute' : 'text-terracotta'}`} />
        <span className="min-w-0 flex-1"><b>{title}.</b> <span className="text-ink-soft">{b.line}</span></span>
        <Icon name={open ? 'x' : 'arrowRight'} size={14} className="mt-1 shrink-0 text-ink-mute" />
      </button>
      {open && (
        <div className="mt-3 grid gap-3 border-t border-ink/10 pt-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white p-2"><p className="font-display text-xl font-semibold">{b.daysPractised}<span className="text-sm font-normal text-ink-mute">/{b.daysInWindow}</span></p><p className="text-[10px] uppercase tracking-wider text-ink-mute">days practised</p></div>
            <div className="rounded-xl bg-white p-2"><p className="font-display text-xl font-semibold">{b.minutes}</p><p className="text-[10px] uppercase tracking-wider text-ink-mute">minutes</p></div>
            <div className="rounded-xl bg-white p-2"><p className="font-display text-xl font-semibold">{b.accuracy === null ? '–' : `${Math.round(b.accuracy * 100)}%`}</p><p className="text-[10px] uppercase tracking-wider text-ink-mute">correct{b.attempts ? ` of ${b.attempts}` : ''}</p></div>
          </div>
          {b.mistakes.length > 0 && (
            <div>
              <p className="font-semibold">Keeps going wrong</p>
              <ul className="mt-1 grid gap-1 text-ink-soft">
                {b.mistakes.map((m) => <li key={m.category}><span className="font-medium capitalize text-ink">{m.label}</span> ×{m.count}{m.examples.length ? <span className="text-ink-mute"> · should have been {m.examples.join(', ')}</span> : null}</li>)}
              </ul>
            </div>
          )}
          <p className="text-ink-soft"><b className="text-ink">Homework.</b> {b.homework.done} done, {b.homework.pending} to do{b.homework.overdue ? <>, <b className="text-terracotta-dark">{b.homework.overdue} overdue</b> ({b.homework.overdueTitles.join('; ')})</> : ''}{b.homework.lastScore !== null ? `. Last score ${Math.round(b.homework.lastScore * 100)}%` : ''}.</p>
          {b.suggestions.length > 0 && (
            <div>
              <p className="font-semibold">For this lesson with {name}</p>
              <ul className="mt-1 grid gap-1 text-ink-soft">{b.suggestions.map((s) => <li key={s} className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 shrink-0 text-olive" /> {s}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
