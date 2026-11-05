import { motion } from 'motion/react';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/ui';
import { CITY_THEMES } from '../../data/cityThemes';
import { sfx } from '../../lib/fx';
import { navigate } from '../../lib/router';
import { useStore } from '../../lib/store';
import { GAMES } from './registry';

export function Arcade() {
  const { state, update } = useStore();
  const city = CITY_THEMES[state.profile?.city ?? 'madrid'];
  return (
    <div>
      <PageHeader
        eyebrow={`Juegos · ${city.name}`}
        title="The arcade"
        subtitle="Fast, replayable games — every answer feeds your verb mastery, mistakes and memory deck. Short bursts, real learning."
        right={
          <button className="ctrl" onClick={() => update((s) => ({ ...s, settings: { ...s.settings, sound: !s.settings.sound } }))} aria-pressed={state.settings.sound}>
            <Icon name={state.settings.sound ? 'volume' : 'volumeOff'} size={16} /> Sound {state.settings.sound ? 'on' : 'off'}
          </button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {GAMES.map((g, i) => {
          const rec = state.games[g.id];
          return (
            <motion.button
              key={g.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -6, rotate: i % 2 ? 0.6 : -0.6 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { sfx.tap(); navigate(`game/${g.id}`); }}
              className={`group relative min-h-[210px] overflow-hidden rounded-4xl ${g.bg} p-6 text-left ${g.bg === 'bg-saffron' ? 'text-ink' : 'text-white'} shadow-lift`}
            >
              <motion.span className="absolute -bottom-6 -right-4 text-[120px] leading-none opacity-30 transition group-hover:scale-110" aria-hidden animate={{ rotate: [0, 6, 0] }} transition={{ duration: 5, repeat: Infinity, delay: i }}>{g.emoji}</motion.span>
              <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">{g.es}</p>
              <h2 className="mt-1 font-display text-4xl font-semibold">{g.title}</h2>
              <p className="mt-2 max-w-xs text-sm opacity-90">{g.trains}</p>
              <div className="mt-5 flex items-center gap-3">
                <span className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-bold shadow-soft ${g.bg === 'bg-saffron' ? 'bg-ink text-cream' : 'bg-white text-ink'}`}><Icon name="play" size={16} filled /> Play</span>
                {rec ? <span className="text-sm font-semibold opacity-90">🏆 {rec.best} · {rec.plays} play{rec.plays === 1 ? '' : 's'}</span> : <span className="text-sm opacity-80">New!</span>}
              </div>
            </motion.button>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-ink-mute">Games use the {city.varietyLabel} you’re learning — {city.variety === 'argentina' ? 'including vos forms' : city.variety === 'spain' ? 'including vosotros' : 'with ustedes for “you all”'} — and local food in Order Up!</p>
    </div>
  );
}
