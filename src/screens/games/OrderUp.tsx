import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Character } from '../../components/Character';
import { Icon } from '../../components/Icon';
import { CITY_THEMES, type FoodItem } from '../../data/cityThemes';
import { CHARACTERS, scenesForCity } from '../../data/story';
import { useSay, useTtsSpeaking } from '../../hooks/useSpeech';
import { sfx } from '../../lib/fx';
import { useStore } from '../../lib/store';
import type { Region } from '../../types';
import { GameShell, type GameApi } from './GameShell';

const NUM = ['', '', 'dos', 'tres'];

/** How people actually ask for things at the counter in each variety. */
const REQUEST: Record<Region, (list: string) => string> = {
  spain: (l) => `¿Me pones ${l}, por favor?`,
  mexico: (l) => `Me da ${l}, por favor.`,
  argentina: (l) => `¿Me traés ${l}, por favor?`,
  colombia: (l) => `¿Me regala ${l}, por favor?`,
};
const REQUEST_NOTE: Record<Region, string> = {
  spain: '“¿Me pones…?” is how you order at a Spanish bar.',
  mexico: '“Me da…, por favor” is the everyday way to order in Mexico.',
  argentina: '“¿Me traés…?” — vos form of traer, very porteño.',
  colombia: '“¿Me regala…?” is a polite request in Colombia — it doesn’t mean free!',
};

function listText(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

export function orderPhrase(items: [FoodItem, number][], region: Region): string {
  const parts = items.map(([f, q]) => (q === 1 ? f.one ?? f.es : `${NUM[q]} ${f.pl ?? f.es}`));
  return REQUEST[region](listText(parts));
}

interface Order { id: number; items: [FoodItem, number][]; text: string; customer: string }

function Counter({ api }: { api: GameApi }) {
  const { state } = useStore();
  const say = useSay();
  const speaking = useTtsSpeaking();
  const region = state.profile?.region ?? 'spain';
  const city = CITY_THEMES[state.profile?.city ?? 'madrid'];
  const foods = city.foods;
  const customers = useMemo(() => [...new Set(scenesForCity(city.id).flatMap((s) => s.cast))], [city.id]);
  const idRef = useRef(0);

  const make = (level: number): Order => {
    const n = Math.min(3, 1 + Math.floor(Math.random() * Math.min(3, level + 1)));
    const pick = [...foods].sort(() => Math.random() - 0.5).slice(0, n);
    const items = pick.map<[FoodItem, number]>((f) => [f, level >= 2 && Math.random() < 0.45 ? 2 + (Math.random() < 0.3 ? 1 : 0) : 1]);
    return { id: ++idRef.current, items, text: orderPhrase(items, region), customer: customers[Math.floor(Math.random() * customers.length)] };
  };

  const [order, setOrder] = useState<Order>(() => make(1));
  const [tray, setTray] = useState<Record<string, number>>({});
  const [showText, setShowText] = useState(false);
  const [verdict, setVerdict] = useState<'ok' | 'bad' | null>(null);
  const patienceMax = Math.max(10, 20 - api.hud.level * 2);
  const [patience, setPatience] = useState(patienceMax);

  // speak the order when a customer arrives
  useEffect(() => {
    const t = setTimeout(() => say(order.text), 450);
    setPatience(patienceMax);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  // patience countdown
  useEffect(() => {
    if (!api.playing || verdict) return;
    const iv = setInterval(() => setPatience((p) => p - 0.25), 250);
    return () => clearInterval(iv);
  }, [api.playing, verdict, order.id]);

  useEffect(() => {
    if (patience <= 0 && !verdict) serve(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patience]);

  const add = (f: FoodItem) => { sfx.tap(); setTray((t) => ({ ...t, [f.id]: Math.min(3, (t[f.id] ?? 0) + 1) })); };
  const remove = (id: string) => setTray((t) => { const n = { ...t }; if (n[id] > 1) n[id]--; else delete n[id]; return n; });

  const serve = (timeout = false) => {
    if (verdict) return;
    const want = Object.fromEntries(order.items.map(([f, q]) => [f.id, q]));
    const ok = !timeout && Object.keys(want).length === Object.keys(tray).length && Object.entries(want).every(([k, q]) => tray[k] === q);
    const givenText = Object.entries(tray).map(([k, q]) => `${q}× ${foods.find((f) => f.id === k)?.es}`).join(', ') || '(nothing)';
    setVerdict(ok ? 'ok' : 'bad');
    setShowText(true);
    if (ok) {
      const tip = Math.round(patience) * 10;
      api.hit(showText ? 60 : 100, null, { label: order.text, correct: true });
      if (tip > 0) { api.bonus(tip); sfx.coin(); }
    } else {
      api.miss(null, { label: order.text, correct: false, detail: timeout ? 'the customer got tired of waiting' : `you served ${givenText}`, category: 'vocabulary' });
    }
    setTimeout(() => { setTray({}); setVerdict(null); setShowText(false); setOrder(make(api.hud.level)); }, ok ? 1400 : 2600);
  };

  const c = CHARACTERS[order.customer];
  const trayItems = Object.entries(tray);

  return (
    <div className="overflow-hidden rounded-4xl bg-terracotta-50 shadow-lift ring-1 ring-ink/5">
      {/* Customer + bubble */}
      <div className="relative bg-gradient-to-b from-saffron-50 to-terracotta-50 p-4 sm:p-5">
        <div className="flex items-end gap-3">
          <AnimatePresence mode="wait">
            <motion.div key={order.id} initial={{ x: -80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} className="shrink-0">
              <Character look={c.look} speaking={speaking} mood={verdict === 'ok' ? 'happy' : verdict === 'bad' ? 'surprised' : 'idle'} size={110} label={c.name} />
            </motion.div>
          </AnimatePresence>
          <div className="relative mb-4 flex-1 rounded-3xl rounded-bl-md bg-white p-4 shadow-soft">
            <p className="text-xs font-semibold text-ink-mute">{c.name}</p>
            {showText ? (
              <p className="font-display text-lg font-medium leading-snug sm:text-xl">{order.text}</p>
            ) : (
              <p className="flex items-center gap-2 font-display text-lg italic text-ink-mute"><Icon name="volume" size={18} /> Listen to the order…</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button className="ctrl !py-1.5" onClick={() => say(order.text)}><Icon name="replay" size={14} /> Repeat</button>
              <button className="ctrl !py-1.5" onClick={() => say(order.text, { slow: true })}><Icon name="slow" size={14} /> Slower</button>
              {!showText && <button className="ctrl !py-1.5" onClick={() => setShowText(true)} title="Fewer points"><Icon name="eye" size={14} /> Show text (−40%)</button>}
            </div>
          </div>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/70" aria-label="Customer patience">
          <motion.div className={`h-full ${patience / patienceMax < 0.3 ? 'bg-terracotta' : 'bg-olive'}`} animate={{ width: `${Math.max(0, patience / patienceMax) * 100}%` }} transition={{ duration: 0.25, ease: 'linear' }} />
        </div>
        <p className="mt-1.5 text-xs text-ink-mute">{REQUEST_NOTE[region]}</p>
      </div>

      {/* Tray */}
      <div className="border-y border-ink/5 bg-white/70 p-4">
        <div className="flex min-h-[52px] flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">Tray</span>
          <AnimatePresence>
            {trayItems.length === 0 && <motion.span className="text-sm text-ink-mute" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Tap items below</motion.span>}
            {trayItems.map(([id, q]) => {
              const f = foods.find((x) => x.id === id)!;
              return (
                <motion.button layout key={id} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={() => remove(id)} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-sm font-semibold text-cream" aria-label={`Remove one ${f.es}`}>
                  <span>{f.icon}</span> {q > 1 && <b>{q}×</b>} {f.es} <Icon name="x" size={12} />
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {verdict && (
            <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mt-2 text-sm font-semibold ${verdict === 'ok' ? 'text-olive' : 'text-terracotta-dark'}`}>
              {verdict === 'ok' ? '¡Perfecto! Gracias 😊' : `Not quite — they wanted: ${order.items.map(([f, q]) => `${q}× ${f.es}`).join(', ')}`}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Menu */}
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
        {foods.map((f) => (
          <motion.button key={f.id} whileTap={{ scale: 0.92 }} disabled={!!verdict} onClick={() => add(f)} className="flex flex-col items-center gap-1 rounded-2xl bg-white p-3 text-center shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5 hover:ring-terracotta/40 disabled:opacity-50">
            <span className="text-3xl" aria-hidden>{f.icon}</span>
            <span className="text-sm font-semibold leading-tight">{f.es}</span>
            {tray[f.id] ? <span className="rounded-full bg-terracotta px-2 text-xs font-bold text-white">{tray[f.id]}</span> : null}
          </motion.button>
        ))}
      </div>
      <div className="p-4 pt-0">
        <button className="btn-primary w-full py-4 text-lg" disabled={!trayItems.length || !!verdict} onClick={() => serve()}><Icon name="check" size={20} /> ¡Marchando! Serve</button>
      </div>
    </div>
  );
}

export function OrderUp() {
  return <GameShell id="order" duration={90}>{(api) => <Counter api={api} />}</GameShell>;
}
