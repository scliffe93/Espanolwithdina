import { motion } from 'motion/react';
import { CITY_ORDER, CITY_THEMES, applyCityTheme } from '../data/cityThemes';
import type { CityId } from '../data/storyTypes';
import { CitySkyline, Flag } from './CitySkyline';
import { Icon } from './Icon';
import { sfx } from '../lib/fx';

/** Rich, themed city cards. Hovering/focusing previews the city's palette across the app. */
export function CityPicker({ value, onChange, progress }: { value: CityId; onChange: (c: CityId) => void; progress?: Partial<Record<CityId, number>> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Choose your city">
      {CITY_ORDER.filter((id) => CITY_THEMES[id].available).map((id, i) => {
        const t = CITY_THEMES[id];
        const selected = value === id;
        return (
          <motion.button
            key={id}
            role="radio"
            aria-checked={selected}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -4, rotate: -0.4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { sfx.tap(); applyCityTheme(id); onChange(id); }}
            className={`group relative overflow-hidden rounded-3xl text-left shadow-soft ring-2 transition ${selected ? 'ring-ink' : 'ring-transparent hover:ring-ink/20'}`}
            style={{ background: t.palette.bg }}
          >
            <div className="relative h-28 overflow-hidden">
              <CitySkyline city={id} height={112} compact />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink shadow-soft">
                <Flag city={id} size={11} /> {t.country}
              </span>
              {selected && <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-ink text-white"><Icon name="check" size={16} /></span>}
            </div>
            <div className="p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-2xl font-semibold" style={{ color: t.palette.deep }}>{t.name}</h3>
                <span className="flex gap-1" aria-hidden>
                  {[t.palette.primary, t.palette.secondary, t.palette.tertiary, t.palette.rose].map((c) => <span key={c} className="h-3 w-3 rounded-full ring-1 ring-black/5" style={{ background: c }} />)}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">{t.tagline}</p>
              <p className="mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: t.palette.primary50, color: t.palette.primaryDark }}>{t.varietyLabel}</p>
              {progress?.[id] !== undefined && progress[id]! > 0 && <p className="mt-2 text-xs font-medium text-ink-mute">{progress[id]} / 3 chapters lived</p>}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
