import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Character } from '../components/Character';
import { Icon, type IconName } from '../components/Icon';
import { Bar, ProgressRing, Sheet } from '../components/ui';
import { CHARACTERS, FUTURE_LOCATIONS, SCENES, SCENE_BY_ID, type Scene } from '../data/story';
import { currentStreak, dueCards, todaySeconds } from '../lib/analytics';
import { rulesCoach, type Route } from '../lib/coach';
import { navigate } from '../lib/router';
import { useStore } from '../lib/store';

export function routeHref(r: Route): string {
  switch (r.name) {
    case 'scene': return `scene/${r.id}`;
    case 'verbs': {
      const q = new URLSearchParams();
      if (r.focus?.length) q.set('focus', r.focus.join(','));
      if (r.mode) q.set('mode', r.mode);
      const s = q.toString();
      return `verbs${s ? `?${s}` : ''}`;
    }
    case 'review': return 'review';
    case 'world': return 'world';
  }
}

type Sky = { top: string; bottom: string; label: string; sun: string; night: boolean };
function skyFor(hour: number): Sky {
  if (hour >= 6 && hour < 9) return { top: '#F6C7A1', bottom: '#FBE7CF', label: 'Buenos días', sun: '#F2A65A', night: false };
  if (hour >= 9 && hour < 18) return { top: '#9CC5E3', bottom: '#F4E7D3', label: hour < 14 ? 'Buenos días' : 'Buenas tardes', sun: '#F7C65B', night: false };
  if (hour >= 18 && hour < 21) return { top: '#E58B6B', bottom: '#F6D4B0', label: 'Buenas tardes', sun: '#F07A4A', night: false };
  return { top: '#1B2A44', bottom: '#3D4A66', label: 'Buenas noches', sun: '#F2EAD3', night: true };
}

const PLACES: Record<string, { x: number; y: number; icon: IconName; color: string }> = {
  llegada: { x: 84, y: 22, icon: 'plane', color: '#1F3A5F' },
  piso: { x: 44, y: 66, icon: 'key', color: '#5E7149' },
  cafe: { x: 55, y: 58, icon: 'cup', color: '#C2593A' },
  mercado: { x: 36, y: 38, icon: 'lock', color: '#7A7067' },
  gimnasio: { x: 66, y: 46, icon: 'lock', color: '#7A7067' },
  oficina: { x: 52, y: 30, icon: 'lock', color: '#7A7067' },
  'centro-salud': { x: 26, y: 56, icon: 'lock', color: '#7A7067' },
  'bar-tapas': { x: 47, y: 47, icon: 'lock', color: '#7A7067' },
};

function MadridMap({ sky }: { sky: Sky }) {
  const reduced = useReducedMotion();
  const ground = sky.night ? '#2E3346' : '#F1E2CA';
  const block = sky.night ? '#454B63' : '#E6C9A8';
  const block2 = sky.night ? '#3D4258' : '#DDB792';
  return (
    <svg viewBox="0 0 1000 640" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={sky.top} /><stop offset="1" stopColor={sky.bottom} /></linearGradient>
        <pattern id="tiles" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M0 11h22M11 0v22" stroke={sky.night ? '#ffffff08' : '#00000008'} /></pattern>
      </defs>
      <rect width="1000" height="640" fill="url(#sky)" />
      {/* sun / moon */}
      <motion.circle cx="140" cy="70" r={sky.night ? 26 : 38} fill={sky.sun} opacity={0.9} animate={reduced ? undefined : { y: [0, 4, 0] }} transition={{ duration: 9, repeat: Infinity }} />
      {sky.night && Array.from({ length: 24 }).map((_, i) => <circle key={i} cx={(i * 137) % 1000} cy={(i * 53) % 120 + 10} r={1.4} fill="#fff" opacity={0.7} />)}
      {/* sierra */}
      <path d="M0 150 L80 100 L150 130 L240 70 L330 125 L420 85 L520 130 L600 90 L700 135 L790 80 L880 120 L1000 95 L1000 190 L0 190 Z" fill={sky.night ? '#28324A' : '#B9C4CF'} opacity=".8" />
      <path d="M220 82 L240 70 L262 84 Z M405 95 L420 85 L438 96 Z M775 92 L790 80 L806 92 Z" fill="#fff" opacity=".85" />
      {/* clouds */}
      {!sky.night && [0, 1, 2].map((i) => (
        <motion.g key={i} initial={{ x: -200 + i * 380 }} animate={reduced ? undefined : { x: [-200 + i * 380, 1100] }} transition={{ duration: 90 + i * 25, repeat: Infinity, ease: 'linear', delay: -i * 30 }}>
          <ellipse cx="0" cy={60 + i * 22} rx="60" ry="16" fill="#fff" opacity=".75" />
          <ellipse cx="30" cy={52 + i * 22} rx="36" ry="16" fill="#fff" opacity=".75" />
        </motion.g>
      ))}
      {/* ground */}
      <path d="M0 175 C200 160 400 185 600 170 C780 158 900 175 1000 168 L1000 640 L0 640 Z" fill={ground} />
      <rect y="170" width="1000" height="470" fill="url(#tiles)" />
      {/* Manzanares river */}
      <path d="M150 640 C170 560 120 500 160 430 C200 360 140 300 190 220 C210 190 200 180 210 170" stroke={sky.night ? '#3E5C86' : '#8FB8D8'} strokeWidth="22" fill="none" strokeLinecap="round" />
      {/* Retiro park */}
      <path d="M640 330 C700 300 780 320 790 380 C800 440 740 470 680 460 C620 450 590 370 640 330 Z" fill={sky.night ? '#2F4A3B' : '#A9C08A'} />
      {[[660, 360], [700, 345], [740, 370], [700, 410], [750, 420], [670, 420], [720, 440]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="14" fill={sky.night ? '#264034' : '#7F9A5E'} />
      ))}
      <ellipse cx="712" cy="392" rx="22" ry="10" fill={sky.night ? '#3E5C86' : '#9DC3DD'} />
      {/* airport runway */}
      <g transform="translate(780 150) rotate(-12)">
        <rect width="190" height="26" rx="4" fill={sky.night ? '#3A3F52' : '#CDBFAE'} />
        {Array.from({ length: 8 }).map((_, i) => <rect key={i} x={12 + i * 22} y="12" width="12" height="2.5" fill="#fff" opacity=".8" />)}
      </g>
      <rect x="800" y="180" width="120" height="34" rx="8" fill={block2} />
      {/* flying plane */}
      {!reduced && (
        <motion.g animate={{ x: [0, -900], y: [0, -120], opacity: [0, 1, 1, 0] }} transition={{ duration: 16, repeat: Infinity, repeatDelay: 10, ease: 'easeIn' }}>
          <path d="M900 170 l26 -6 l6 -12 l5 0 l-2 12 l14 -3 l3 -6 l4 0 l-2 8 l-2 8 l-4 0 l-3 -5 l-14 2 l2 12 l-5 0 l-6 -12 l-26 -4 z" fill={sky.night ? '#E8DCC6' : '#1F3A5F'} transform="rotate(-8 920 165)" />
        </motion.g>
      )}
      {/* city blocks */}
      {Array.from({ length: 64 }).map((_, i) => {
        const col = i % 11, row = Math.floor(i / 11);
        const x = 240 + col * 46 + (row % 2) * 18;
        const y = 220 + row * 58;
        if (x > 610 && x < 810 && y > 300 && y < 480) return null;
        const h = 18 + ((i * 7) % 16);
        return <rect key={i} x={x} y={y} width="34" height={h} rx="5" fill={i % 3 ? block : block2} />;
      })}
      {/* main avenues */}
      <path d="M200 300 C380 280 560 300 820 260" stroke={sky.night ? '#565C76' : '#FFF6E8'} strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M480 190 C470 320 500 450 470 640" stroke={sky.night ? '#565C76' : '#FFF6E8'} strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M230 470 C400 430 560 470 840 430" stroke={sky.night ? '#565C76' : '#FFF6E8'} strokeWidth="7" fill="none" strokeLinecap="round" />
      {/* Lavapiés plaza */}
      <circle cx="510" cy="390" r="30" fill={sky.night ? '#5A5F78' : '#F6E3C4'} stroke={sky.night ? '#6A7090' : '#E3A33B'} strokeDasharray="4 6" strokeWidth="2" />
      {/* window lights at night */}
      {sky.night && Array.from({ length: 40 }).map((_, i) => <rect key={i} x={250 + ((i * 97) % 520)} y={230 + ((i * 61) % 280)} width="5" height="5" fill="#F2C66E" opacity=".75" />)}
    </svg>
  );
}

function LocationSheet({ scene, onClose }: { scene: Scene | null; onClose: () => void }) {
  const { state } = useStore();
  if (!scene) return null;
  const done = state.story.completedScenes.includes(scene.id);
  const score = state.story.sceneScores[scene.id];
  return (
    <Sheet open={!!scene} onClose={onClose} title={scene.title}>
      <p className="eyebrow -mt-2 mb-3">{scene.place}</p>
      <p className="text-ink-soft">{scene.blurb}</p>
      <ul className="mt-4 grid gap-1.5">
        {scene.goals.map((g) => <li key={g} className="flex items-center gap-2 text-sm"><Icon name="check" size={16} className="text-olive" /> {g}</li>)}
      </ul>
      <div className="mt-5 flex gap-3">
        {scene.cast.map((c) => (
          <div key={c} className="flex items-center gap-2 rounded-2xl bg-cream-100 p-2 pr-3">
            <Character look={CHARACTERS[c].look} size={40} />
            <div className="text-sm"><b>{CHARACTERS[c].name}</b><br /><span className="text-ink-mute">{CHARACTERS[c].role}</span></div>
          </div>
        ))}
      </div>
      {done && score !== undefined && <p className="mt-4 text-sm text-ink-soft">Best performance: {Math.round(score * 100)}% natural choices.</p>}
      <button className="btn-primary mt-6 w-full" onClick={() => navigate(`scene/${scene.id}`)}>
        {done ? 'Replay this chapter' : 'Go there'} <Icon name="arrowRight" size={18} />
      </button>
    </Sheet>
  );
}

export function World() {
  const { state } = useStore();
  const [open, setOpen] = useState<Scene | null>(null);
  const [lockedInfo, setLockedInfo] = useState<string | null>(null);
  const now = Date.now();
  const sky = skyFor(new Date().getHours());
  const p = state.profile!;
  const recs = useMemo(() => rulesCoach.recommend(state, now), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const top = recs[0];
  const goal = p.dailyMinutes * 60;
  const today = todaySeconds(state);
  const streak = currentStreak(state);
  const due = dueCards(state).length;
  const completed = state.story.completedScenes;
  const isUnlocked = (s: Scene) => !s.requires || completed.includes(s.requires);
  const met = Object.keys(CHARACTERS).filter((c) => SCENES.some((s) => completed.includes(s.id) && s.cast.includes(c)));

  return (
    <div>
      {/* Greeting + coach */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">{p.destinationCity && p.destinationCity !== 'Madrid' ? `Practising for ${p.destinationCity} · ` : ''}Madrid · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-1 text-[34px] font-semibold leading-tight sm:text-[44px]">{sky.label}, {p.name}.</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="card flex items-center gap-3 px-4 py-3">
            <ProgressRing value={today / goal} size={48} stroke={6} label={`${Math.round(today / 60)} of ${p.dailyMinutes} minutes today`}>
              <span className="text-[11px] font-bold tabular-nums">{Math.floor(today / 60)}′</span>
            </ProgressRing>
            <div className="text-sm leading-tight"><b>{Math.min(100, Math.round((today / goal) * 100))}%</b> of today’s<br />{p.dailyMinutes}-min goal</div>
          </div>
          {state.settings.streaksEnabled && (
            <div className="card flex items-center gap-2 px-4 py-3" title="Consecutive days with at least 1 minute of active study">
              <Icon name="flame" className={streak ? 'text-terracotta' : 'text-ink-mute'} />
              <div className="text-sm leading-tight"><b>{streak}</b> day{streak === 1 ? '' : 's'}<br /><span className="text-ink-mute">streak</span></div>
            </div>
          )}
        </div>
      </div>

      {/* The world */}
      <div className="relative overflow-hidden rounded-4xl shadow-lift ring-1 ring-ink/5" style={{ aspectRatio: '1000 / 640', minHeight: 300 }}>
        <MadridMap sky={sky} />
        {SCENES.map((s) => {
          const pos = PLACES[s.id];
          const unlocked = isUnlocked(s);
          const done = completed.includes(s.id);
          const next = unlocked && !done;
          return (
            <motion.button
              key={s.id}
              className="absolute -translate-x-1/2 -translate-y-full"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={() => (unlocked ? setOpen(s) : setLockedInfo(`Complete “${SCENE_BY_ID[s.requires!].title}” to unlock ${s.title}.`))}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.96 }}
              aria-label={`${s.title}${done ? ', completed' : unlocked ? ', available' : ', locked'}`}
            >
              <motion.span
                className="flex flex-col items-center"
                animate={next ? { y: [0, -6, 0] } : undefined}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span className={`mb-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-soft sm:text-xs ${unlocked ? 'bg-white text-ink' : 'bg-white/70 text-ink-mute'}`}>
                  {s.titleEs}{done ? ' ✓' : ''}
                </span>
                <span className="relative grid h-11 w-11 place-items-center rounded-full text-white shadow-lift ring-4 ring-white sm:h-12 sm:w-12" style={{ background: unlocked ? pos.color : '#9C928A' }}>
                  <Icon name={unlocked ? pos.icon : 'lock'} size={20} />
                  {next && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-saffron ring-2 ring-white" />}
                </span>
              </motion.span>
            </motion.button>
          );
        })}
        {FUTURE_LOCATIONS.map((f) => {
          const pos = PLACES[f.id];
          return (
            <button
              key={f.id}
              className="absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/60 text-ink-mute ring-2 ring-white/80 backdrop-blur transition hover:bg-white"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={() => setLockedInfo(`${f.title} — ${f.theme}. This chapter is coming in a future version of VIVA.`)}
              aria-label={`${f.title}: future chapter`}
            >
              <Icon name="lock" size={15} />
            </button>
          );
        })}
        <AnimatePresence>
          {lockedInfo && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-2xl bg-ink/90 p-3 text-sm text-cream backdrop-blur sm:inset-x-auto sm:left-3 sm:max-w-md">
              <span>{lockedInfo}</span>
              <button className="shrink-0 rounded-full p-1 hover:bg-white/10" onClick={() => setLockedInfo(null)} aria-label="Dismiss"><Icon name="x" size={16} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Coach */}
      {top && (
        <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <Character look={CHARACTERS.lucia.look} mood="happy" size={96} className="shrink-0 self-center" label="Lucía, your coach" />
            <div className="flex-1">
              <p className="eyebrow">Lucía suggests</p>
              <h2 className="mt-1 text-xl font-semibold">{top.title}</h2>
              <p className="mt-1 text-ink-soft">{top.body}</p>
              <p className="mt-1 text-xs text-ink-mute">Why: {top.why}</p>
              <button className="btn-primary mt-3" onClick={() => navigate(routeHref(top.route))}>{top.cta} <Icon name="arrowRight" size={18} /></button>
            </div>
          </div>
          <div className="card p-5">
            <p className="eyebrow mb-3">Also worth doing</p>
            <ul className="grid gap-2">
              {recs.slice(1, 4).map((r) => (
                <li key={r.id}>
                  <button className="flex w-full items-center justify-between gap-3 rounded-2xl bg-cream-100 px-4 py-3 text-left transition hover:bg-cream-200" onClick={() => navigate(routeHref(r.route))}>
                    <span><span className="block font-medium">{r.title}</span><span className="block text-xs text-ink-mute">{r.why}</span></span>
                    <Icon name="arrowRight" size={16} className="shrink-0" />
                  </button>
                </li>
              ))}
              {due > 0 && !recs.slice(0, 4).some((r) => r.id === 'review') && (
                <li><button className="flex w-full items-center justify-between rounded-2xl bg-cream-100 px-4 py-3 text-left hover:bg-cream-200" onClick={() => navigate('review')}><span className="font-medium">{due} items due for review</span><Icon name="arrowRight" size={16} /></button></li>
              )}
            </ul>
          </div>
        </section>
      )}

      {/* People */}
      <section className="mt-6">
        <h2 className="mb-3 text-2xl font-semibold">Tu gente en Madrid</h2>
        <div className="flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-none">
          {Object.values(CHARACTERS).map((c) => {
            const known = met.includes(c.id) || c.id === 'lucia';
            const rel = state.story.relationships[c.id] ?? (known ? 10 : 0);
            return (
              <div key={c.id} className={`card w-60 shrink-0 snap-start p-4 ${known ? '' : 'opacity-60'}`}>
                <div className="flex items-center gap-3">
                  <Character look={c.look} size={56} label={c.name} />
                  <div>
                    <p className="font-semibold">{known ? c.name : '¿?'}</p>
                    <p className="text-xs text-ink-mute">{known ? c.role : 'Not met yet'}</p>
                  </div>
                </div>
                {known && (
                  <>
                    <p className="mt-3 line-clamp-3 text-sm text-ink-soft">{c.bio}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Icon name="heart" size={14} className="text-rosa" filled />
                      <Bar value={rel / 100} color="bg-rosa" />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <LocationSheet scene={open} onClose={() => setOpen(null)} />
    </div>
  );
}
