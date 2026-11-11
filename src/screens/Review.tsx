import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HelpMeRemember, type MemorySource } from '../components/HelpMeRemember';
import { Icon } from '../components/Icon';
import { Bar, Empty, PageHeader } from '../components/ui';
import { personLabel, VERB_BY_INF, conjugate, groupLabel, type Tense } from '../data/verbs';
import { VOCAB_BY_ID, acceptedAnswers, vocabForm, vocabKey } from '../data/vocab';
import { PACK_BY_ID, VOCAB_PACKS } from '../data/vocabPacks';
import { withinLevel } from '../lib/platform/level';
import { useLevelAccess } from '../lib/platform/useLevelAccess';
import { useRoute } from '../lib/router';
import { useSay } from '../hooks/useSpeech';
import { checkAnswer, classifyVerbError, CATEGORY_TIP } from '../lib/answer';
import { DAY_MS } from '../lib/dates';
import { navigate } from '../lib/router';
import { mastery, type Grade } from '../lib/srs';
import { addToDeck, completeLesson, recordAttempt } from '../lib/state';
import { useStore } from '../lib/store';
import { sfx } from '../lib/fx';
import { useHomeworkCompletion } from '../lib/platform/homework';
import type { ResultItem } from '../lib/platform/types';
import { TECHNIQUE_LABEL } from '../lib/report';
import type { ErrorCategory, MemoryTechnique, SrsCard } from '../types';

interface Item {
  key: string;
  prompt: string;
  sub: string;
  answers: string[];
  display: string;
  memory: MemorySource;
  isNew: boolean;
  verb?: { inf: string; tense: Tense; person: number };
  regionNote?: string;
}

function toItem(card: SrsCard, region: import('../types').Region): Item | null {
  if (card.key.startsWith('vocab:')) {
    const v = VOCAB_BY_ID[card.key.slice(6)];
    if (!v) return null;
    const form = vocabForm(v, region);
    return {
      key: card.key, prompt: v.en, sub: 'Say it in Spanish', answers: acceptedAnswers(form), display: form, isNew: card.attempts === 0, regionNote: v.regionNote,
      memory: { key: card.key, answer: form.replace(/^(el|la|los|las|un|una)\s+/, ''), en: v.en, origin: v.origin, trick: v.trick, visual: v.visual, story: v.story },
    };
  }
  const m = card.key.match(/^verb:(.+)\|(\w+)\|(\d)$/);
  if (!m) return null;
  const verb = VERB_BY_INF[m[1]];
  if (!verb) return null;
  const tense = m[2] as Tense, person = Number(m[3]);
  if (region !== 'spain' && person === 4) return null;
  const form = conjugate(verb, tense, person);
  return {
    key: card.key, prompt: `${verb.pronominal ? '' : personLabel(person).split(' ')[0] + ' · '}${verb.inf}`, sub: `${verb.en} — ${tense === 'present' ? 'present' : tense === 'progressive' ? 'present progressive' : 'present perfect'}${verb.pronominal ? ` · ${['a mí', 'a ti', 'a él/ella', 'a nosotros', 'a vosotros', 'a ellos'][person]}` : ''}`,
    answers: [form], display: form, isNew: false, verb: { inf: verb.inf, tense, person },
    memory: { key: card.key, answer: form, en: verb.en, origin: verb.origin, trick: verb.trick, pattern: `${groupLabel(verb.group)}. ${verb.note ?? ''}` },
  };
}

function ReviewSession({ items, onDone }: { items: Item[]; onDone: () => void }) {
  const { update } = useStore();
  const say = useSay();
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'learn' | 'ask' | 'result'>(items[0]?.isNew ? 'learn' : 'ask');
  const [value, setValue] = useState('');
  const [res, setRes] = useState<{ ok: boolean; accent: boolean; category?: ErrorCategory } | null>(null);
  const [hint, setHint] = useState(false);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const hw = useHomeworkCompletion();
  const answers = useRef<ResultItem[]>([]);
  const it = items[i];

  const check = (given: string) => {
    const r = checkAnswer(given, it.answers);
    const ok = r !== 'wrong';
    const accent = r === 'accent';
    let category: ErrorCategory | undefined = ok ? (accent ? 'accents' : undefined) : 'vocabulary';
    if (!ok && it.verb && given) category = classifyVerbError(VERB_BY_INF[it.verb.inf], it.verb.tense, it.verb.person, given);
    const grade: Grade = !ok ? 0 : accent || hint ? 1 : 2;
    update((s) => recordAttempt(s, {
      key: it.key, grade, exerciseType: it.verb ? 'review-verb' : 'review-vocab', verb: it.verb?.inf, tense: it.verb?.tense,
      mistake: !ok || accent ? { expected: it.display, given, category: category ?? 'other', context: 'Memory review' } : undefined,
    }));
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }));
    if (answers.current.length < 60) answers.current.push({ prompt: it.prompt, expected: it.display, given, correct: ok, ...(category && !ok ? { category } : {}) });
    setRes({ ok, accent, category });
    if (ok) sfx.correct(); else sfx.wrong();
    setPhase('result');
    say(it.display);
  };

  const next = () => {
    setValue('');
    setRes(null);
    setHint(false);
    if (i + 1 >= items.length) {
      update((s) => completeLesson(s));
      if (hw.isHomework) hw.submit({ score: score.total ? (score.ok + 1) / (score.total + 1) : 0, attempts: score.total + 1, correct: score.ok + 1, summary: `${score.ok + 1}/${score.total + 1} recalled`, items: answers.current });
      else hw.log('review', `Memory review: ${score.ok + 1}/${score.total + 1} recalled`);
      setI(items.length);
      return;
    }
    setI(i + 1);
    setPhase(items[i + 1].isNew ? 'learn' : 'ask');
  };

  if (i >= items.length) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p className="eyebrow">Review complete</p>
        <h2 className="mt-1 text-3xl font-semibold">{score.ok} / {score.total} recalled</h2>
        <p className="mt-2 text-ink-soft">Each item is now scheduled for the moment it’s about to fade. Come back tomorrow for the next round.</p>
        <div className="mt-5 flex justify-center gap-2">{hw.isHomework && <button className="btn-dark" onClick={hw.backToHomework}><Icon name="check" size={18} /> Homework done</button>}<button className="btn-primary" onClick={onDone}>Done</button><button className="btn-ghost" onClick={() => navigate('world')}>Madrid</button></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <button className="ctrl !px-2" onClick={onDone} aria-label="End review"><Icon name="x" size={18} /></button>
        <Bar value={i / items.length} color="bg-azul" />
        <span className="text-sm tabular-nums text-ink-mute">{i + 1}/{items.length}</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={`${i}-${phase === 'learn'}`} initial={{ opacity: 0, rotateY: -8 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0 }} className="card p-6">
          {phase === 'learn' ? (
            <>
              <p className="eyebrow">New word</p>
              <h2 className="mt-2 font-display text-4xl font-semibold">{it.display}</h2>
              <p className="mt-1 text-lg text-ink-soft">{it.prompt}</p>
              <button className="ctrl mt-3" onClick={() => say(it.display)}><Icon name="volume" size={16} /> Listen</button>
              {it.regionNote && <p className="mt-3 rounded-2xl bg-azul-50 p-3 text-sm">{it.regionNote}</p>}
              <div className="mt-4 grid gap-2 text-sm">
                {it.memory.origin && <p className="rounded-2xl bg-olive-50 p-3"><b className="text-olive">Real word origin.</b> {it.memory.origin}</p>}
                {it.memory.trick && <p className="rounded-2xl bg-saffron-50 p-3"><b className="text-ink-soft">Memory trick (invented).</b> {it.memory.trick}</p>}
                {it.memory.visual && <p className="rounded-2xl bg-rosa-50 p-3"><b>Picture this (invented).</b> {it.memory.visual}</p>}
              </div>
              <button className="btn-dark mt-5" onClick={() => { setPhase('ask'); setTimeout(() => inputRef.current?.focus(), 50); }}>I’ve got it — test me</button>
            </>
          ) : (
            <>
              <p className="eyebrow">{it.sub}</p>
              <h2 className="mt-2 font-display text-3xl font-semibold">{it.prompt}</h2>
              <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (phase === 'ask' && value.trim()) check(value); }}>
                <input ref={inputRef} autoFocus className="input text-lg" disabled={phase === 'result'} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Type in Spanish" lang="es" autoCapitalize="off" autoComplete="off" aria-label="Your answer" />
                {phase === 'ask' && <button className="btn-primary shrink-0" disabled={!value.trim()}>Check</button>}
              </form>
              {phase === 'ask' && (
                <div className="mt-3">
                  <HelpMeRemember source={it.memory} onHintUsed={() => setHint(true)} onReveal={() => check('')} />
                </div>
              )}
              {phase === 'result' && res && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 rounded-2xl p-4 ${res.ok ? (res.accent ? 'bg-saffron-50' : 'bg-olive-50') : 'bg-terracotta-50'}`}>
                  <p className="font-semibold">{res.ok ? (res.accent ? 'Correct — check the accent' : hint ? 'Correct with a hint' : '¡Eso es!') : 'Answer'}: <span className="font-display text-xl">{it.display}</span></p>
                  {res.category && !res.ok && it.verb && <p className="mt-1 text-sm text-ink-soft">{CATEGORY_TIP[res.category]}</p>}
                  <div className="mt-3 flex gap-2"><button className="ctrl" onClick={() => say(it.display)}><Icon name="volume" size={16} /> Listen</button><button className="btn-dark" autoFocus onClick={next}>Next <Icon name="arrowRight" size={18} /></button></div>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function Review() {
  const { state, update, notify } = useStore();
  const region = state.profile?.region ?? 'spain';
  const [session, setSession] = useState<Item[] | null>(null);
  const now = Date.now();
  const route = useRoute();
  const access = useLevelAccess();
  const packParam = route.params.get('pack');
  const packIds = (id: string) => PACK_BY_ID[id]?.ids.map(vocabKey) ?? [];
  const inDeck = (id: string) => packIds(id).filter((k) => state.srs[k]).length;

  /** Adds a pack's words to the deck (new cards) and, when `go`, starts a session on them. */
  const addPack = (id: string, go = false) => {
    const pack = PACK_BY_ID[id];
    if (!pack) return;
    const keys = packIds(id);
    // Computed from the current state so the session can start at once; the store applies the same change.
    const next = keys.some((k) => !state.srs[k]) ? addToDeck(state, keys) : state;
    if (next !== state) {
      update((s) => addToDeck(s, keys));
      if (!go) notify('Added to your deck', `${pack.title}: ${pack.ids.length} words. They come up in your reviews from now on.`);
    }
    if (go) {
      const items = keys.map((k) => next.srs[k]).filter(Boolean).map((c) => toItem(c, region)).filter((x): x is Item => !!x);
      if (items.length) setSession(items);
    }
  };
  // Deep link (homework): ?pack=<id> adds the pack and starts straight away.
  useEffect(() => {
    if (packParam && PACK_BY_ID[packParam]) addPack(packParam, true);
    else setSession(null); // back on the plain Memory page: leave the pack session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packParam]);
  const cards = Object.values(state.srs);
  const due = useMemo(
    () => cards.filter((c) => c.due <= now && (c.attempts > 0 || c.key.startsWith('vocab:'))).sort((a, b) => (a.attempts === 0 ? 1 : 0) - (b.attempts === 0 ? 1 : 0) || a.due - b.due),
    [state.srs], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const tomorrow = cards.filter((c) => c.due > now && c.due <= now + DAY_MS).length;
  const levels = { new: 0, learning: 0, familiar: 0, mastered: 0 };
  for (const c of cards) levels[mastery(c)]++;

  const start = () => {
    // At most 5 brand-new words per session; reviews first.
    let newCount = 0;
    const items: Item[] = [];
    for (const c of due) {
      if (items.length >= 15) break;
      if (c.attempts === 0) { if (newCount >= 5) continue; newCount++; }
      const it = toItem(c, region);
      if (it) items.push(it);
    }
    setSession(items);
  };

  if (session) return <ReviewSession items={session} onDone={() => setSession(null)} />;

  const techs = (Object.entries(state.techniqueStats) as [MemoryTechnique, { used: number; delayedAttempts: number; delayedRecalled: number }][]).filter(([, s]) => s.used > 0);

  return (
    <div>
      <PageHeader eyebrow="Memoria" title="Remember for good" subtitle="Spaced repetition brings each word back just before you’d forget it — and the app learns which memory techniques work for you." />
      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <div className="card flex flex-col justify-between gap-4 bg-azul p-6 text-cream">
          <div>
            <p className="eyebrow !text-cream/60">Ready now</p>
            <p className="mt-1 font-display text-6xl font-semibold">{due.length}</p>
            <p className="text-cream/75">{due.length === 1 ? 'item' : 'items'} due · {tomorrow} more in the next 24 h</p>
          </div>
          {due.length > 0 ? (
            <button className="btn w-fit bg-cream text-azul hover:bg-white" onClick={start}><Icon name="play" size={18} filled /> Start review</button>
          ) : (
            <p className="text-cream/80">Nothing due. Play a chapter in Madrid or the verb gym to add more to your deck.</p>
          )}
        </div>
        <div className="card p-5">
          <p className="eyebrow mb-3">Your deck</p>
          {(['mastered', 'familiar', 'learning', 'new'] as const).map((l) => (
            <div key={l} className="mb-2.5">
              <div className="mb-1 flex justify-between text-sm"><span className="capitalize">{l}</span><b>{levels[l]}</b></div>
              <Bar value={cards.length ? levels[l] / cards.length : 0} color={l === 'mastered' ? 'bg-olive' : l === 'familiar' ? 'bg-azul-light' : l === 'learning' ? 'bg-saffron' : 'bg-ink/20'} />
            </div>
          ))}
        </div>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="text-xl font-semibold">What actually helps you remember</h2>
        <p className="mt-1 text-sm text-ink-soft">When you use a clue, the app checks whether you recall that item unaided at least 12 hours later. Techniques with better delayed recall are offered first.</p>
        {techs.length === 0 ? (
          <p className="mt-4 text-sm text-ink-mute">No data yet — tap “Help me remember” during practice and come back after a day.</p>
        ) : (
          <div className="mt-4 grid gap-2">
            {techs.sort((a, b) => b[1].used - a[1].used).map(([t, s]) => (
              <div key={t} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-2xl bg-cream-100 p-3">
                <span className="font-medium">{TECHNIQUE_LABEL[t]}</span>
                <span className="text-sm text-ink-mute">used {s.used}×</span>
                <Bar value={s.delayedAttempts ? s.delayedRecalled / s.delayedAttempts : 0} color="bg-olive" />
                <span className="text-sm">{s.delayedAttempts ? `${Math.round((s.delayedRecalled / s.delayedAttempts) * 100)}% recalled later (${s.delayedAttempts})` : 'awaiting delayed check'}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mt-6 p-5" data-testid="word-packs">
        <h2 className="text-xl font-semibold">Word packs by level</h2>
        <p className="mt-1 text-sm text-ink-soft">Ten words on one theme. Add a pack and the words join your deck; learn them in a session now or let the reviews bring them up.{access.maxLevel ? ` Packs above your level (${access.maxLevel}, set by your teacher) are hidden.` : ''}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {VOCAB_PACKS.filter((p) => withinLevel(p.level, access.maxLevel)).map((p) => {
            const have = inDeck(p.id);
            return (
              <div key={p.id} className="flex flex-col gap-2 rounded-2xl bg-cream-100 p-3" data-testid={`pack-${p.id}`}>
                <div className="flex items-start justify-between gap-2"><p className="font-semibold leading-tight">{p.title}<span className="block text-xs font-normal text-ink-mute" lang="es">{p.es}</span></p><span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-cream">{p.level}</span></div>
                <p className="text-xs text-ink-mute">{have === p.ids.length ? 'All in your deck' : have ? `${have} of ${p.ids.length} in your deck` : `${p.ids.length} words`}</p>
                <div className="mt-auto flex gap-2">
                  <button className="btn-dark !py-1.5 !text-xs" onClick={() => addPack(p.id, true)} data-testid={`pack-learn-${p.id}`}><Icon name="play" size={12} /> Learn now</button>
                  {have < p.ids.length && <button className="ctrl !py-1.5 !text-xs" onClick={() => addPack(p.id)} data-testid={`pack-add-${p.id}`}>Add to deck</button>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {cards.length === 0 && (
        <div className="mt-6"><Empty icon="brain" title="Your deck is empty" body="Words from each Madrid chapter join your deck automatically, or add a word pack above." action={<button className="btn-primary" onClick={() => navigate('world')}>Go to Madrid</button>} /></div>
      )}
    </div>
  );
}
