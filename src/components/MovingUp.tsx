import { levelReadiness } from '../lib/levelUp';
import { useLevelAccess } from '../lib/platform/useLevelAccess';
import { useStore } from '../lib/store';
import { Icon } from './Icon';

const DAY = 86_400_000;

/**
 * The learner's view of moving up: the signs the app looks for, which ones they have, and a clear statement that
 * their teacher makes the decision. After she has moved them up, it says so for two weeks.
 */
export function MovingUp({ className = '' }: { className?: string }) {
  const { state } = useStore();
  const { level, settings } = useLevelAccess();
  const r = levelReadiness(state, level);
  const justMoved = settings?.verified && settings.verified.level === level && Date.now() - Date.parse(settings.verified.at) < 14 * DAY;
  if (!r.next) return null;
  const anyPractice = Object.values(state.days).some((d) => d.exercisesAttempted > 0);
  if (!anyPractice && !justMoved) return null;
  return (
    <section className={`card p-5 ${className}`} data-testid="moving-up">
      <p className="eyebrow">Tu nivel · Your level</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink font-display text-xl font-semibold text-saffron-light">{level}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold leading-tight">{justMoved ? `Dina has moved you up to ${level}` : r.ready ? `You are at ${level} and look ready for ${r.next}` : `You are at ${level}. The next level is ${r.next}`}</h2>
          <p className="text-sm text-ink-soft">{justMoved ? `New tenses and games are open. Here is what leads on to ${r.next}.` : r.ready ? 'Dina can see this too. She decides when you move up, so mention it in your next lesson.' : `${r.met} of ${r.checks.length} signs in place. Dina confirms the move when you get there.`}</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-olive transition-[width] duration-500" style={{ width: `${(r.met / r.checks.length) * 100}%` }} /></div>
      <ul className="mt-3 grid gap-1.5">
        {r.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5 text-sm" data-met={c.met}>
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${c.met ? 'bg-olive text-white' : 'bg-white text-ink-mute ring-1 ring-ink/15'}`}>{c.met && <Icon name="check" size={12} />}</span>
            <span><b className={c.met ? 'text-ink' : 'text-ink-soft'}>{c.label}</b> <span className="text-ink-mute">· {c.detail}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
