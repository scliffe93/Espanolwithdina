import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Character } from '../components/Character';
import { Icon } from '../components/Icon';
import { Bar } from '../components/ui';
import { ASSESSMENT } from '../data/assessment';
import { CHARACTERS } from '../data/story';
import { blankProfile } from '../data/profileOptions';
import { scoreAssessment, uniformLevels } from '../lib/assessmentScore';
import { navigate } from '../lib/router';
import { speak, ttsSupported } from '../lib/speech';
import { useStore } from '../lib/store';
import { CEFR_LEVELS, SKILLS, type Cefr } from '../types';
import { useTtsSpeaking } from '../hooks/useSpeech';

const CEFR_DESC: Record<Cefr, string> = {
  A1: 'Beginner — basic phrases, introductions',
  A2: 'Elementary — everyday tasks, simple chats',
  B1: 'Intermediate — handle most situations, tell stories',
  B2: 'Upper-intermediate — fluent conversation, opinions',
  C1: 'Advanced — nuance, humour, professional Spanish',
};

export function LevelChoice() {
  const { update, state } = useStore();
  const [pick, setPick] = useState<Cefr | null>(null);

  const setLevel = (level: Cefr, source: 'zero' | 'self-selected') => {
    update((s) => ({ ...s, profile: { ...(s.profile ?? blankProfile()), levels: uniformLevels(level), levelSource: source, levelOverridden: false } }));
    navigate('dna');
  };

  return (
    <div className="min-h-[100dvh] bg-[#F4E7D3] px-5 py-8">
      <div className="mx-auto max-w-4xl">
        <button className="ctrl mb-6" onClick={() => navigate('onboarding')}><Icon name="arrowLeft" size={16} /> Back</button>
        <p className="eyebrow">Your starting point</p>
        <h1 className="mt-1 text-4xl font-semibold">Where should we begin, {state.profile?.name || 'amigo'}?</h1>
        <p className="mt-2 max-w-xl text-ink-soft">You can change this any time. VIVA tracks each skill separately, so being stronger at reading than speaking is completely normal.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <button className="card group flex flex-col items-start gap-3 p-6 text-left transition hover:-translate-y-0.5 hover:shadow-lift" onClick={() => setLevel('A1', 'zero')}>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-olive-50 text-olive"><Icon name="sparkle" /></span>
            <span className="text-xl font-semibold">Start from zero</span>
            <span className="text-ink-soft">Begin at A1 with greetings, ser & estar and your first 30 verbs.</span>
            <span className="mt-auto inline-flex items-center gap-1 font-semibold text-terracotta">Empezar <Icon name="arrowRight" size={16} /></span>
          </button>

          <div className="card flex flex-col gap-3 p-6">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-azul-50 text-azul"><Icon name="chart" /></span>
            <span className="text-xl font-semibold">I know my level</span>
            <div className="grid gap-1.5" role="radiogroup" aria-label="CEFR level">
              {CEFR_LEVELS.map((l) => (
                <button key={l} role="radio" aria-checked={pick === l} onClick={() => setPick(l)} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ring-1 transition ${pick === l ? 'bg-ink text-cream ring-ink' : 'ring-ink/10 hover:ring-ink/25'}`}>
                  <span className="w-7 font-bold">{l}</span>
                  <span className={pick === l ? 'text-cream/80' : 'text-ink-soft'}>{CEFR_DESC[l]}</span>
                </button>
              ))}
            </div>
            <button className="btn-dark mt-2" disabled={!pick} onClick={() => pick && setLevel(pick, 'self-selected')}>Use {pick ?? 'this level'}</button>
          </div>

          <button className="card group flex flex-col items-start gap-3 p-6 text-left transition hover:-translate-y-0.5 hover:shadow-lift" onClick={() => navigate('assessment')}>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-saffron-50 text-[#a66d12]"><Icon name="brain" /></span>
            <span className="text-xl font-semibold">Find my level</span>
            <span className="text-ink-soft">{ASSESSMENT.length} quick questions on vocabulary, grammar, reading, listening and verbs. About 5 minutes.</span>
            <span className="mt-auto inline-flex items-center gap-1 font-semibold text-terracotta">Take the placement <Icon name="arrowRight" size={16} /></span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function Assessment() {
  const { update, state } = useStore();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [chosen, setChosen] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const speaking = useTtsSpeaking();
  const q = ASSESSMENT[i];
  const region = state.profile?.region ?? 'spain';
  const result = useMemo(() => (done ? scoreAssessment(answers) : null), [done, answers]);

  const choose = (idx: number) => {
    if (chosen !== null) return;
    setChosen(idx);
    setAnswers((a) => ({ ...a, [q.id]: idx }));
  };
  const next = () => {
    setChosen(null);
    if (i < ASSESSMENT.length - 1) setI(i + 1);
    else setDone(true);
  };
  const dontKnow = () => {
    setAnswers((a) => ({ ...a, [q.id]: -1 }));
    setChosen(-1);
  };
  const accept = () => {
    if (!result) return;
    update((s) => ({ ...s, profile: { ...(s.profile ?? blankProfile()), levels: result.levels, levelSource: 'assessment', levelOverridden: false } }));
    navigate(state.onboardingDone ? 'settings' : 'dna');
  };

  if (done && result) {
    return (
      <div className="min-h-[100dvh] bg-[#F4E7D3] px-5 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-4">
            <Character look={CHARACTERS.lucia.look} mood="happy" size={110} />
            <div>
              <p className="eyebrow">Placement result</p>
              <h1 className="text-4xl font-semibold">Overall: {result.overall}</h1>
              <p className="text-ink-soft">{result.correct} of {result.total} correct · {CEFR_DESC[result.overall]}</p>
            </div>
          </div>
          <div className="card mt-6 divide-y divide-ink/5">
            {SKILLS.map((sk) => (
              <div key={sk} className="flex items-center justify-between gap-4 p-4">
                <span className="capitalize font-medium">{sk}</span>
                <span className="flex items-center gap-3">
                  {sk === 'speaking' && <span className="text-xs text-ink-mute">estimated — not tested</span>}
                  <span className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-cream">{result.levels[sk]}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-mute">This short placement gives a starting estimate, not a certified CEFR result. You can override any skill in My Spanish DNA.</p>
          <button className="btn-primary mt-6 w-full sm:w-auto" onClick={accept}>Use these levels <Icon name="arrowRight" size={18} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F4E7D3] px-5 py-6">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <button className="ctrl !px-2" onClick={() => navigate(state.onboardingDone ? 'settings' : 'level')} aria-label="Exit assessment"><Icon name="x" size={18} /></button>
          <Bar value={(i + (chosen !== null ? 1 : 0)) / ASSESSMENT.length} />
          <span className="text-sm tabular-nums text-ink-mute">{i + 1}/{ASSESSMENT.length}</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="mt-8">
            <p className="eyebrow">{q.skill} · {q.level}</p>
            {q.listen ? (
              <div className="mt-3 flex items-center gap-4">
                <Character look={CHARACTERS.lucia.look} speaking={speaking} mood="idle" size={90} />
                <div className="flex flex-wrap gap-2">
                  <button className="btn-dark" onClick={() => speak(q.text!, { region, rate: 0.95 })} disabled={!ttsSupported}><Icon name="play" size={18} /> Listen</button>
                  <button className="ctrl" onClick={() => speak(q.text!, { region, rate: 0.65 })} disabled={!ttsSupported}><Icon name="slow" size={16} /> Slower</button>
                </div>
              </div>
            ) : q.text ? (
              <blockquote className="mt-3 rounded-2xl bg-white p-5 font-display text-xl leading-relaxed shadow-soft">{q.text}</blockquote>
            ) : null}
            {q.listen && !ttsSupported && <p className="mt-2 text-sm text-terracotta-dark">Speech isn’t available in this browser. Text: “{q.text}”</p>}
            <h2 className="mt-5 text-2xl font-semibold">{q.prompt}</h2>
            <div className="mt-5 grid gap-2.5">
              {q.options.map((o, idx) => {
                const state = chosen === null ? 'idle' : idx === q.answer ? 'right' : idx === chosen ? 'wrong' : 'dim';
                return (
                  <button
                    key={idx}
                    onClick={() => choose(idx)}
                    disabled={chosen !== null}
                    className={`rounded-2xl px-5 py-4 text-left text-[17px] font-medium ring-1 transition ${
                      state === 'right' ? 'bg-olive text-white ring-olive' : state === 'wrong' ? 'bg-terracotta-50 ring-terracotta text-terracotta-dark' : state === 'dim' ? 'bg-white/50 ring-ink/5 text-ink-mute' : 'bg-white ring-ink/10 hover:ring-ink/30'
                    }`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
            {chosen === null ? (
              <button className="btn-soft mt-4" onClick={dontKnow}>I don’t know</button>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-ink-soft">{q.explain}</p>
                <button className="btn-primary shrink-0" onClick={next}>{i === ASSESSMENT.length - 1 ? 'See my levels' : 'Next'} <Icon name="arrowRight" size={18} /></button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
