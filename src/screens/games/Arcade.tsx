import { useT } from '../../lib/i18n';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/ui';
import { CITY_THEMES } from '../../data/cityThemes';
import { sfx } from '../../lib/fx';
import { navigate } from '../../lib/router';
import { recognitionSupported } from '../../lib/speech';
import { useStore } from '../../lib/store';
import { levelIdx } from '../../lib/platform/level';
import { useLevelAccess } from '../../lib/platform/useLevelAccess';
import { AREA_LABEL, GAMES, gameFit, type GameArea, type GameInfo } from './registry';

/** One game on the arcade page. `why` is shown on the games picked for this learner. */
function GameCard({ g, i, why, big, locked }: { g: GameInfo; i: number; why?: string; big?: boolean; locked?: boolean }) {
  const { state } = useStore();
  const rec = state.games[g.id];
  const { t, stage } = useT();
  const dark = g.bg !== 'bg-saffron';
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.04, duration: 0.25 }} whileTap={{ scale: 0.97 }}
      onClick={() => { if (locked) return; sfx.tap(); navigate(`game/${g.id}`); }} data-testid={`game-${g.id}`} aria-disabled={locked} data-locked={locked || undefined}
      className={`group relative overflow-hidden rounded-4xl ${g.bg} text-left ${dark ? 'text-white' : 'text-ink'} shadow-lift transition-transform duration-200 ${locked ? 'cursor-default opacity-60 saturate-50' : 'hover:-translate-y-1'} ${big ? 'min-h-[190px] p-6' : 'min-h-[132px] p-5'}`}
    >
      <span className={`pointer-events-none absolute -bottom-5 -right-3 leading-none opacity-25 transition-transform duration-300 group-hover:scale-110 ${big ? 'text-[110px]' : 'text-[84px]'}`} aria-hidden>{g.emoji}</span>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold uppercase tracking-[0.14em] opacity-85"><span className={`rounded-full px-2 py-0.5 ${dark ? 'bg-white/20' : 'bg-ink/10'}`}>{t(AREA_LABEL[g.area])}</span>{stage >= 2 ? g.title : g.es}</p>
      <h2 className={`mt-1 font-display font-semibold ${big ? 'text-4xl' : 'text-2xl'}`} data-title={g.title}>{stage >= 2 ? g.es : g.title}</h2>
      {big ? <p className="mt-2 max-w-xs text-sm opacity-90">{g.trains}</p> : <p className="mt-1 line-clamp-2 max-w-[16rem] text-sm opacity-90">{g.trains.split(' — ')[0]}</p>}
      {why && <p className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${dark ? 'bg-black/20' : 'bg-white/50'}`} data-testid="game-why">{why}</p>}
      <div className={`flex items-center gap-3 ${big ? 'mt-4' : 'mt-3'}`}>
        {locked
          ? <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${dark ? 'bg-black/25 text-white' : 'bg-ink/15 text-ink'}`}>🔒 {t('Unlocks at')} {g.minLevel}</span>
          : <span className={`inline-flex items-center gap-2 rounded-full font-bold shadow-soft ${big ? 'px-5 py-2.5' : 'px-4 py-2 text-sm'} ${dark ? 'bg-white text-ink' : 'bg-ink text-cream'}`}><Icon name="play" size={big ? 16 : 14} filled /> {t('Play')}</span>}
        {locked ? null : rec ? <span className="text-sm font-semibold opacity-90">🏆 {rec.best} · {rec.plays} play{rec.plays === 1 ? '' : 's'}</span> : <span className="text-sm opacity-80">{t('New!')}</span>}
      </div>
    </motion.button>
  );
}

export function Arcade() {
  const { state, update } = useStore();
  const city = CITY_THEMES[state.profile?.city ?? 'madrid'];
  const { t } = useT();
  const [area, setArea] = useState<GameArea | 'all'>('all');
  const { level } = useLevelAccess();
  const open = (g: GameInfo) => levelIdx(g.minLevel) <= levelIdx(level);
  // Games the device cannot run (speaking without speech recognition) are left out, not shown broken.
  const ranked = useMemo(() => GAMES.filter((g) => !g.needsMic || recognitionSupported).map((g) => ({ g, ...gameFit(g, state) })).sort((a, b) => b.score - a.score), [state.profile, state.games]); // eslint-disable-line react-hooks/exhaustive-deps
  // Up to three, each for a different reason, so the picks cover different ways of practising.
  const picks = ranked.filter((r) => open(r.g) && r.score >= 2.5 && r.why).filter((r, i, all) => all.findIndex((x) => x.why === r.why) === i).slice(0, 3);
  const areas = [...new Set(ranked.map((r) => r.g.area))];
  // Games you can play first, in the order that suits you; then the ones still to unlock, nearest level first.
  const shown = ranked.filter((r) => area === 'all' || r.g.area === area).sort((a, b) => Number(!open(a.g)) - Number(!open(b.g)) || (open(a.g) ? 0 : levelIdx(a.g.minLevel) - levelIdx(b.g.minLevel)));
  const lockedCount = ranked.filter((r) => !open(r.g)).length;
  return (
    <div>
      <PageHeader
        eyebrow={`Juegos · ${city.name}`}
        title={t('The arcade')}
        subtitle="Short games that feed your verb mastery, your mistakes and your memory deck. Pick by what you want to practise."
        right={
          <button className="ctrl" onClick={() => update((s) => ({ ...s, settings: { ...s.settings, sound: !s.settings.sound } }))} aria-pressed={state.settings.sound}>
            <Icon name={state.settings.sound ? 'volume' : 'volumeOff'} size={16} /> Sound {state.settings.sound ? 'on' : 'off'}
          </button>
        }
      />
      {picks.length > 0 && (
        <section className="mb-7" data-testid="arcade-picks">
          <p className="eyebrow mb-2">Para ti · Picked for you</p>
          <div className={`grid gap-4 ${picks.length > 1 ? 'sm:grid-cols-2' : ''} ${picks.length > 2 ? 'lg:grid-cols-3' : ''}`}>
            {picks.map((r, i) => <GameCard key={r.g.id} g={r.g} i={i} why={r.why} big />)}
          </div>
          <p className="mt-2 text-xs text-ink-mute">Chosen from what you said you enjoy and find hard. Change those in Settings and these change with them.</p>
        </section>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-xl font-semibold">{t('All games')}</h2>
        <button className="chip !py-1.5" aria-pressed={area === 'all'} onClick={() => setArea('all')}>{t('All')}</button>
        {areas.map((a) => <button key={a} className="chip !py-1.5" aria-pressed={area === a} onClick={() => setArea(a)} data-testid={`area-${a}`}>{t(AREA_LABEL[a])}</button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="arcade-all">
        {shown.map((r, i) => <GameCard key={r.g.id} g={r.g} i={i} locked={!open(r.g)} />)}
      </div>
      {lockedCount > 0 && <p className="mt-3 text-sm text-ink-soft" data-testid="arcade-level">You are working at <b>{level}</b>. {lockedCount} more game{lockedCount === 1 ? '' : 's'} open{lockedCount === 1 ? 's' : ''} as you move up, and the verb games bring in each level’s new tenses.</p>}
      <p className="mt-6 text-sm text-ink-mute">Games use the {city.varietyLabel} you’re learning — {city.variety === 'argentina' ? 'including vos forms' : city.variety === 'spain' ? 'including vosotros' : 'with ustedes for “you all”'} — and local food in Order Up!</p>
    </div>
  );
}
