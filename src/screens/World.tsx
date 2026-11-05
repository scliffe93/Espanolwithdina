import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Character } from '../components/Character';
import { CityPicker } from '../components/CityPicker';
import { CitySkyline, Flag, skyModeFor, type SkyMode } from '../components/CitySkyline';
import { Icon, type IconName } from '../components/Icon';
import { SceneBackdrop } from '../components/SceneBackdrop';
import { Bar, ProgressRing, Sheet } from '../components/ui';
import { CITY_THEMES, type CityTheme } from '../data/cityThemes';
import { CHARACTERS, FUTURE_LOCATIONS, SCENE_BY_ID, scenesForCity, type CityId, type Scene } from '../data/story';
import { currentStreak, dueCards, todaySeconds } from '../lib/analytics';
import { rulesCoach, type Route } from '../lib/coach';
import { sfx } from '../lib/fx';
import { navigate } from '../lib/router';
import { useStore } from '../lib/store';
import { GAMES } from './games/registry';

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

const CHAPTER_ICON: Record<number, IconName> = { 1: 'plane', 2: 'key', 3: 'cup' };

function greetingFor(hour: number): string {
  if (hour < 6 || hour >= 21) return 'Buenas noches';
  if (hour < 14) return 'Buenos días';
  return 'Buenas tardes';
}

/** Stylised, themed map of the current city. */
function CityMap({ t, mode }: { t: CityTheme; mode: SkyMode }) {
  const reduced = useReducedMotion();
  const night = mode === 'night';
  const P = t.palette;
  const ground = night ? '#2A3044' : P.bg200;
  const block = night ? '#41485F' : P.bg100;
  const block2 = night ? '#394057' : P.secondaryLight;
  const road = night ? '#555C77' : '#FFFFFF';
  const water = night ? '#2D4C78' : P.deepLight;
  const [skyTop, skyBottom] = t.sky[mode];
  return (
    <svg viewBox="0 0 1000 640" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`msky-${t.id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={skyTop} /><stop offset="1" stopColor={skyBottom} /></linearGradient>
        <pattern id={`tiles-${t.id}`} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M0 12h24M12 0v24" stroke={night ? '#ffffff08' : '#0000000a'} /></pattern>
      </defs>
      <rect width="1000" height="640" fill={`url(#msky-${t.id})`} />
      {night && Array.from({ length: 30 }).map((_, i) => <circle key={i} cx={(i * 137) % 1000} cy={(i * 41) % 130 + 8} r={1.3} fill="#fff" opacity={0.7} />)}
      {t.map.mountains === 'sierra' && <path d="M0 150 L80 100 L150 130 L240 70 L330 125 L420 85 L520 130 L600 90 L700 135 L790 80 L880 120 L1000 95 L1000 200 L0 200 Z" fill={night ? '#28324A' : '#B9C4CF'} />}
      {t.map.mountains === 'volcanoes' && <>
        <path d="M560 200 L700 70 Q720 60 740 70 L880 200 Z" fill={night ? '#2B2442' : '#A69CC2'} />
        <path d="M700 70 Q720 60 740 70 L760 90 Q730 84 720 96 Q705 84 682 90 Z" fill="#fff" />
        <path d="M760 200 L870 110 Q890 100 910 112 L1000 180 L1000 200 Z" fill={night ? '#2B2442' : '#B6ADCF'} />
        <path d="M870 110 Q890 100 910 112 L925 125 Q900 118 890 128 Q878 118 858 122 Z" fill="#fff" />
      </>}
      {t.map.mountains === 'coastal-hills' && <path d="M0 170 Q160 90 330 140 Q520 70 720 140 Q880 100 1000 150 L1000 210 L0 210 Z" fill={night ? '#203A34' : P.tertiaryLight} opacity=".8" />}
      {t.map.mountains === 'valley' && <>
        <path d="M0 80 Q140 90 260 260 Q300 400 220 640 L0 640 Z" fill={night ? '#1A3329' : P.tertiary} opacity=".9" />
        <path d="M1000 70 Q860 90 760 250 Q700 400 800 640 L1000 640 Z" fill={night ? '#1A3329' : P.tertiary} opacity=".9" />
      </>}
      <path d={t.map.mountains === 'valley' ? 'M230 640 Q300 400 260 260 Q400 180 500 170 Q620 175 760 250 Q700 400 800 640 Z' : 'M0 180 C200 165 400 190 600 175 C780 163 900 180 1000 173 L1000 640 L0 640 Z'} fill={ground} />
      <rect y="170" width="1000" height="470" fill={`url(#tiles-${t.id})`} />
      {t.map.water?.kind === 'sea' && <path d={t.map.water.path} fill={water} />}
      {t.map.water?.kind === 'sea' && !reduced && [0, 1, 2].map((i) => (
        <motion.path key={i} d={`M${640 + i * 110} ${560 - i * 70} q12 -6 24 0 t24 0`} stroke="#fff" strokeWidth="3" fill="none" opacity=".5" animate={{ x: [0, 20, 0] }} transition={{ duration: 3 + i, repeat: Infinity }} />
      ))}
      {t.map.water?.kind === 'river' && <path d={t.map.water.path} stroke={water} strokeWidth={t.map.water.width ?? 22} fill="none" strokeLinecap="round" />}
      <ellipse cx={t.map.park.cx} cy={t.map.park.cy} rx={t.map.park.rx} ry={t.map.park.ry} fill={night ? '#2F4A3B' : P.tertiaryLight} />
      {Array.from({ length: 8 }).map((_, i) => (
        <circle key={i} cx={t.map.park.cx + Math.cos(i * 0.8) * t.map.park.rx * 0.6} cy={t.map.park.cy + Math.sin(i * 0.8) * t.map.park.ry * 0.55} r="13" fill={night ? '#264034' : P.tertiary} />
      ))}
      <text x={t.map.park.cx} y={t.map.park.cy + t.map.park.ry + 18} textAnchor="middle" fontSize="15" fontStyle="italic" fill={night ? '#9AA3B8' : P.deep} opacity=".75" fontFamily="Georgia, serif">{t.map.park.name}</text>
      {Array.from({ length: 70 }).map((_, i) => {
        const col = i % 12, row = Math.floor(i / 12);
        const x = 220 + col * 50 + (row % 2) * 20;
        const y = 220 + row * 62;
        const pk = t.map.park;
        if (Math.abs(x - pk.cx) < pk.rx + 20 && Math.abs(y - pk.cy) < pk.ry + 20) return null;
        if (t.map.mountains === 'valley' && (x < 290 || x > 730)) return null;
        if (t.map.water?.kind === 'sea' && t.id === 'buenosaires' && x > 620 && y < 600 - (x - 620) * 0.2) return null;
        if (t.map.water?.kind === 'sea' && t.id === 'barcelona' && y > 600 - (x * 0.24)) return null;
        const h = 18 + ((i * 7) % 18);
        return <rect key={i} x={x} y={y} width="36" height={h} rx="6" fill={i % 3 ? block : block2} opacity={i % 3 ? 1 : 0.85} />;
      })}
      <path d="M180 300 C380 280 560 300 840 260" stroke={road} strokeWidth="11" fill="none" strokeLinecap="round" opacity=".9" />
      <path d="M480 190 C470 320 500 450 470 640" stroke={road} strokeWidth="10" fill="none" strokeLinecap="round" opacity=".9" />
      <path d="M220 470 C400 430 560 470 840 430" stroke={road} strokeWidth="8" fill="none" strokeLinecap="round" opacity=".9" />
      <path d="M200 520 C350 380 560 360 860 200" stroke={t.transit.colors[0]} strokeWidth="5" fill="none" strokeDasharray={t.transit.style === 'cable' ? '2 10' : undefined} strokeLinecap="round" opacity=".85" />
      {night && Array.from({ length: 50 }).map((_, i) => <rect key={i} x={250 + ((i * 97) % 520)} y={230 + ((i * 61) % 300)} width="5" height="5" fill={P.secondaryLight} opacity=".8" />)}
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
      <div className="relative -mx-6 -mt-2 mb-4 h-32 overflow-hidden"><SceneBackdrop id={scene.backdrop} label={scene.place.split(',')[0]} /></div>
      <p className="eyebrow mb-2">{scene.place} · Chapter {scene.chapter}</p>
      <p className="text-ink-soft">{scene.blurb}</p>
      <ul className="mt-4 grid gap-1.5">
        {scene.goals.map((g) => <li key={g} className="flex items-center gap-2 text-sm"><Icon name="check" size={16} className="text-olive" /> {g}</li>)}
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        {scene.cast.map((c) => (
          <div key={c} className="flex items-center gap-2 rounded-2xl bg-cream-100 p-2 pr-3">
            <Character look={CHARACTERS[c].look} size={40} />
            <div className="text-sm"><b>{CHARACTERS[c].name}</b><br /><span className="text-ink-mute">{CHARACTERS[c].role}</span></div>
          </div>
        ))}
      </div>
      {done && score !== undefined && <p className="mt-4 text-sm text-ink-soft">Best performance: {Math.round(score * 100)}% natural replies.</p>}
      <button className="btn-primary mt-6 w-full" onClick={() => navigate(`scene/${scene.id}`)}>
        {done ? 'Replay this chapter' : 'Go there'} <Icon name="arrowRight" size={18} />
      </button>
    </Sheet>
  );
}

export function World() {
  const { state, update } = useStore();
  const [open, setOpen] = useState<Scene | null>(null);
  const [lockedInfo, setLockedInfo] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const p = state.profile!;
  const t = CITY_THEMES[p.city];
  const mode = skyModeFor();
  const hour = new Date().getHours();
  const recs = useMemo(() => rulesCoach.recommend(state, Date.now()), [state]);
  const top = recs[0];
  const goal = p.dailyMinutes * 60;
  const today = todaySeconds(state);
  const streak = currentStreak(state);
  const due = dueCards(state).length;
  const completed = state.story.completedScenes;
  const scenes = scenesForCity(p.city);
  const isUnlocked = (s: Scene) => !s.requires || completed.includes(s.requires);
  const nextScene = scenes.find((s) => isUnlocked(s) && !completed.includes(s.id));
  const cast = [...new Set(scenes.flatMap((s) => s.cast))];
  const met = cast.filter((c) => scenes.some((s) => completed.includes(s.id) && s.cast.includes(c)));
  const guide = CHARACTERS[scenes[0]?.cast[0] ?? 'lucia'];
  const progressByCity = Object.fromEntries((Object.keys(CITY_THEMES) as CityId[]).map((c) => [c, scenesForCity(c).filter((s) => completed.includes(s.id)).length]));

  const moveTo = (c: CityId) => {
    update((s) => s.profile ? { ...s, profile: { ...s.profile, city: c, region: CITY_THEMES[c].variety, destinationCity: CITY_THEMES[c].name, destinationCountry: CITY_THEMES[c].country, citiesVisited: s.profile.citiesVisited.includes(c) ? s.profile.citiesVisited : [...s.profile.citiesVisited, c] } } : s);
    sfx.whoosh();
    setMoving(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      {/* ───── City hero ───── */}
      <motion.section key={p.city} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative -mx-4 -mt-5 overflow-hidden sm:mx-0 sm:mt-0 sm:rounded-4xl sm:shadow-lift">
        <CitySkyline city={p.city} mode={mode} height={340} className="h-[300px] sm:h-[340px]" />
        <div className={`absolute inset-0 bg-gradient-to-b ${mode === 'night' ? 'from-black/10 via-transparent to-black/55' : 'from-white/0 via-transparent to-black/45'}`} />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
          <button onClick={() => setMoving(true)} className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-ink shadow-soft backdrop-blur transition hover:bg-white">
            <Flag city={p.city} size={12} /> {t.country} <Icon name="refresh" size={14} /> <span>Move city</span>
          </button>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-2.5 py-1.5 shadow-soft backdrop-blur">
              <ProgressRing value={today / goal} size={34} stroke={5} label={`${Math.round(today / 60)} of ${p.dailyMinutes} minutes today`}>
                <span className="text-[10px] font-bold tabular-nums">{Math.floor(today / 60)}′</span>
              </ProgressRing>
              <span className="hidden text-xs leading-tight sm:block"><b>{Math.min(100, Math.round((today / goal) * 100))}%</b><br />daily goal</span>
            </div>
            {state.settings.streaksEnabled && (
              <div className="flex items-center gap-1.5 rounded-2xl bg-white/90 px-3 py-1.5 shadow-soft backdrop-blur" title="Consecutive study days">
                <motion.span animate={streak ? { scale: [1, 1.2, 1] } : undefined} transition={{ duration: 1.4, repeat: Infinity }}><Icon name="flame" className={streak ? 'text-terracotta' : 'text-ink-mute'} filled={streak > 0} /></motion.span>
                <b className="text-sm">{streak}</b>
              </div>
            )}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-95 drop-shadow sm:text-sm">{greetingFor(hour)}, {p.name}</p>
          <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="font-display text-[48px] font-semibold leading-none drop-shadow-[0_2px_12px_rgba(0,0,0,.35)] sm:text-[80px]">{t.name}</motion.h1>
          <p className="mt-1 max-w-lg text-sm opacity-95 drop-shadow sm:text-[15px]">{t.tagline}</p>
        </div>
      </motion.section>

      {/* ───── Quests ───── */}
      <section className="mt-5 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
        {nextScene ? (
          <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} onClick={() => { sfx.tap(); navigate(`scene/${nextScene.id}`); }} className="group relative min-h-[200px] overflow-hidden rounded-4xl bg-azul text-left text-white shadow-lift">
            <div className="absolute inset-0 opacity-60"><SceneBackdrop id={nextScene.backdrop} label={nextScene.place.split(',')[0]} /></div>
            <div className="absolute inset-0 bg-gradient-to-r from-azul via-azul/80 to-azul/20" />
            <div className="relative flex h-full flex-col justify-between gap-6 p-5">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur"><Icon name={CHAPTER_ICON[nextScene.chapter]} size={14} /> Chapter {nextScene.chapter} of 3</span>
              <div>
                <p className="font-display text-3xl font-semibold leading-tight">{nextScene.titleEs}</p>
                <p className="mt-1 max-w-sm text-sm opacity-90">{nextScene.blurb}</p>
                <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-azul shadow-soft transition-all group-hover:gap-3">Play chapter <Icon name="play" size={14} filled /></span>
              </div>
            </div>
          </motion.button>
        ) : (
          <div className="flex flex-col justify-between gap-4 rounded-4xl bg-azul p-5 text-white shadow-lift">
            <p className="font-display text-2xl font-semibold">You’ve lived every chapter in {t.name}. ¡Enhorabuena!</p>
            <button className="w-fit rounded-full bg-white px-4 py-2 text-sm font-bold text-azul" onClick={() => setMoving(true)}>Try another city</button>
          </div>
        )}
        <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} onClick={() => { sfx.tap(); navigate('games'); }} className="relative overflow-hidden rounded-4xl bg-terracotta p-5 text-left text-white shadow-glow">
          <div className="absolute -right-10 -top-10 grid grid-cols-2 gap-2 opacity-20" aria-hidden>
            {GAMES.map((g) => <span key={g.id} className="grid h-14 w-14 rotate-6 place-items-center rounded-2xl bg-white text-2xl">{g.emoji}</span>)}
          </div>
          <p className="eyebrow !text-white/80">Arcade</p>
          <p className="mt-1 font-display text-2xl font-semibold leading-tight">Play &amp; learn</p>
          <p className="mt-1 text-sm opacity-90">{GAMES.length} fast games built on your verbs, listening and vocabulary.</p>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-terracotta">Let’s play <Icon name="arrowRight" size={14} /></span>
        </motion.button>
        <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} onClick={() => { sfx.tap(); navigate('review'); }} className="relative overflow-hidden rounded-4xl bg-saffron p-5 text-left text-ink shadow-soft">
          <p className="eyebrow !text-ink/70">Memory</p>
          <p className="mt-1 font-display text-5xl font-semibold">{due}</p>
          <p className="text-sm font-medium">{due === 1 ? 'item' : 'items'} ready to review</p>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-bold text-cream">{due ? 'Review now' : 'Open deck'} <Icon name="arrowRight" size={14} /></span>
        </motion.button>
      </section>

      {/* ───── Map ───── */}
      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Your {t.name}</h2>
          <span className="text-sm text-ink-mute">{completed.filter((c) => scenes.some((s) => s.id === c)).length}/3 chapters</span>
        </div>
        <div ref={(el) => { if (el && el.dataset.centred !== p.city) { el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; el.dataset.centred = p.city; } }} className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0" aria-label={`Map of ${t.name} — scroll sideways to explore`}>
          <div className="relative min-w-[680px] overflow-hidden rounded-4xl shadow-lift ring-1 ring-ink/5" style={{ aspectRatio: '1000 / 640' }}>
            <CityMap t={t} mode={mode} />
            {scenes.map((s) => {
              const unlocked = isUnlocked(s);
              const done = completed.includes(s.id);
              const next = unlocked && !done;
              return (
                <motion.button
                  key={s.id}
                  className="absolute -translate-x-1/2 -translate-y-full"
                  style={{ left: `${s.map.x}%`, top: `${s.map.y}%` }}
                  onClick={() => { sfx.tap(); if (unlocked) setOpen(s); else setLockedInfo(`Complete “${SCENE_BY_ID[s.requires!].title}” to unlock ${s.title}.`); }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={`${s.title}${done ? ', completed' : unlocked ? ', available' : ', locked'}`}
                >
                  <motion.span className="flex flex-col items-center" animate={next ? { y: [0, -8, 0] } : undefined} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
                    <span className={`mb-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold shadow-soft ${unlocked ? 'bg-white text-ink' : 'bg-white/70 text-ink-mute'}`}>{s.titleEs}{done ? ' ✓' : ''}</span>
                    <span className={`relative grid h-12 w-12 place-items-center rounded-full text-white shadow-lift ring-4 ring-white ${unlocked ? (s.chapter === 1 ? 'bg-azul' : s.chapter === 2 ? 'bg-olive' : 'bg-terracotta') : 'bg-[#9C928A]'}`}>
                      <Icon name={unlocked ? CHAPTER_ICON[s.chapter] : 'lock'} size={20} />
                      {next && <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-saffron opacity-75" /><span className="relative inline-flex h-4 w-4 rounded-full bg-saffron ring-2 ring-white" /></span>}
                    </span>
                  </motion.span>
                </motion.button>
              );
            })}
            {FUTURE_LOCATIONS.map((f) => (
              <button key={f.id} className="absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/60 text-ink-mute ring-2 ring-white/80 backdrop-blur transition hover:bg-white" style={{ left: `${f.x}%`, top: `${f.y}%` }} onClick={() => setLockedInfo(`${f.title} — ${f.theme}. A future chapter.`)} aria-label={`${f.title}: future chapter`}>
                <Icon name="lock" size={15} />
              </button>
            ))}
            <AnimatePresence>
              {lockedInfo && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-2xl bg-ink/90 p-3 text-sm text-cream backdrop-blur sm:inset-x-auto sm:left-3 sm:max-w-md">
                  <span>{lockedInfo}</span>
                  <button className="shrink-0 rounded-full p-1 hover:bg-white/10" onClick={() => setLockedInfo(null)} aria-label="Dismiss"><Icon name="x" size={16} /></button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-ink-mute sm:hidden">Swipe the map to explore</p>
      </section>

      {/* ───── Coach ───── */}
      {top && (
        <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <Character look={guide.look} mood="happy" size={96} className="shrink-0 self-center" label={guide.name} />
            <div className="flex-1">
              <p className="eyebrow">{guide.name} suggests</p>
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
            </ul>
          </div>
        </section>
      )}

      {/* ───── People ───── */}
      <section className="mt-6">
        <h2 className="mb-3 font-display text-2xl font-semibold sm:text-3xl">Tu gente en {t.name}</h2>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:px-0">
          {cast.map((cid, i) => {
            const c = CHARACTERS[cid];
            const known = met.includes(cid) || i === 0;
            const rel = state.story.relationships[cid] ?? (known ? 10 : 0);
            return (
              <motion.div key={cid} whileHover={{ y: -4 }} className={`card w-64 shrink-0 snap-start overflow-hidden ${known ? '' : 'opacity-60'}`}>
                <div className="flex items-end gap-3 bg-gradient-to-br from-terracotta-50 to-saffron-50 p-4 pb-3">
                  <Character look={c.look} size={64} label={c.name} />
                  <div className="pb-1">
                    <p className="font-semibold">{known ? c.name : '¿?'}</p>
                    <p className="text-xs text-ink-mute">{known ? c.role : 'Not met yet'}</p>
                  </div>
                </div>
                {known && (
                  <div className="p-4 pt-3">
                    <p className="line-clamp-3 text-sm text-ink-soft">{c.bio}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Icon name="heart" size={14} className="text-rosa" filled />
                      <Bar value={rel / 100} color="bg-rosa" />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>

      <LocationSheet scene={open} onClose={() => setOpen(null)} />
      <Sheet wide open={moving} onClose={() => setMoving(false)} title="Where do you want to live?">
        <p className="mb-4 text-sm text-ink-soft">Each city has its own story, people and Spanish. Your verbs, vocabulary and progress come with you.</p>
        <CityPicker value={p.city} progress={progressByCity} onChange={moveTo} />
      </Sheet>
    </div>
  );
}
