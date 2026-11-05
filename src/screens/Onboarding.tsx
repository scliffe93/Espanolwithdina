import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Character, type Mood } from '../components/Character';
import { Icon } from '../components/Icon';
import { Bar } from '../components/ui';
import { CHARACTERS } from '../data/story';
import {
  ACTIVITIES, DIFFICULTIES, GENDER, INTERESTS, MINUTES, PROFICIENCY, REASONS, RELOCATION, SOCIAL, blankProfile,
} from '../data/profileOptions';
import { useTtsSpeaking } from '../hooks/useSpeech';
import { CityPicker } from '../components/CityPicker';
import { CitySkyline } from '../components/CitySkyline';
import { CITY_ORDER, CITY_THEMES } from '../data/cityThemes';
import { playUrl, useRecorder } from '../hooks/useRecorder';
import { navigate } from '../lib/router';
import { recognitionSupported, recognize, speak, stopSpeaking, ttsSupported } from '../lib/speech';
import { useStore } from '../lib/store';
import type { LearnerProfile } from '../types';

type Opt = { value: string; label: string; hint?: string };

interface Step {
  id: string;
  es: string;
  en: string;
  kind: 'text' | 'single' | 'multi' | 'city' | 'teacher';
  field?: keyof LearnerProfile;
  options?: Opt[];
  placeholder?: string;
  optional?: boolean;
  mood?: Mood;
}

const STEPS: Step[] = [
  { id: 'name', es: '¡Hola! Soy Lucía, tu guía en VIVA. ¿Cómo te llamas?', en: 'Hi! I\'m Lucía, your VIVA guide. What\'s your name?', kind: 'text', field: 'name', placeholder: 'Your first name', mood: 'wave' },
  { id: 'gender', es: 'En español, algunas palabras cambian: cansado o cansada. ¿Cómo te hablo?', en: 'In Spanish, some words change form: cansado or cansada. Which should I use for you?', kind: 'single', field: 'gender', options: GENDER },
  { id: 'proficiency', es: '¿Cuánto español hablas ahora mismo?', en: 'How much Spanish do you speak right now?', kind: 'single', field: 'proficiencySelf', options: PROFICIENCY },
  { id: 'city', es: '¿Dónde quieres vivir tu nueva vida?', en: 'Where do you want to live your new life? Each city has its own story, people, colours — and its own Spanish.', kind: 'city', mood: 'happy' },
  { id: 'relocation', es: '¿Y cuándo es la mudanza?', en: 'And when\'s the move?', kind: 'single', field: 'relocation', options: RELOCATION },
  { id: 'reasons', es: '¿Por qué aprendes español?', en: 'Why are you learning Spanish? Pick all that apply.', kind: 'multi', field: 'reasons', options: REASONS },
  { id: 'interests', es: 'Cuéntame, ¿qué te gusta hacer?', en: 'Tell me — what do you love doing? Your story in Madrid will follow your interests.', kind: 'multi', field: 'interests', options: INTERESTS, mood: 'happy' },
  { id: 'career', es: '¿A qué te dedicas?', en: 'What do you do for work?', kind: 'text', field: 'career', placeholder: 'e.g. UX designer, nurse, student', optional: true },
  { id: 'social', es: '¿Y tu vida social allí? ¿Qué te importa?', en: 'What matters for your social life there?', kind: 'multi', field: 'socialGoals', options: SOCIAL, optional: true },
  { id: 'minutes', es: '¿Cuánto tiempo tienes al día?', en: 'How much time can you give each day? Little and often wins.', kind: 'single', field: 'dailyMinutes', options: MINUTES.map((m) => ({ value: String(m), label: `${m} min`, hint: m <= 5 ? 'Casual' : m <= 10 ? 'Steady' : m <= 20 ? 'Serious' : 'Intense' })) },
  { id: 'activities', es: '¿Qué tipo de práctica disfrutas?', en: 'Which activities do you enjoy? I\'ll also track what actually helps you remember.', kind: 'multi', field: 'activities', options: ACTIVITIES },
  { id: 'difficulties', es: '¿Qué te cuesta más?', en: 'What do you find hardest?', kind: 'multi', field: 'difficulties', options: DIFFICULTIES, optional: true, mood: 'thinking' },
  { id: 'teacher', es: 'Última pregunta: ¿tienes profe de español?', en: 'Last one: do you have a Spanish teacher? VIVA can prepare weekly reports for them.', kind: 'teacher' },
];

function VoiceNote({ stepId, onTranscript }: { stepId: string; onTranscript: (t: string) => void }) {
  const { update, state } = useStore();
  const id = `voice-${stepId}`;
  const recRef = useRef<{ stop(): void } | null>(null);
  const [live, setLive] = useState('');
  const rec = useRecorder(id, {
    maxMs: 60_000,
    onSaved: () =>
      update((s) => {
        if (!s.profile) return s;
        const notes = s.profile.voiceNotes.filter((v) => v.questionId !== stepId);
        return { ...s, profile: { ...s.profile, voiceNotes: [...notes, { id, questionId: stepId, transcript: live || undefined, createdAt: Date.now() }] } };
      }),
  });
  const lang = state.profile?.region === 'mexico' ? 'es-MX' : 'en-GB';

  const start = async () => {
    setLive('');
    await rec.start();
    if (recognitionSupported) {
      // Onboarding answers may be in English or Spanish; English recognition is more forgiving for beginners.
      recRef.current = recognize(stepId === 'name' ? 'es-ES' : lang === 'es-MX' ? 'en-US' : 'en-GB', (alts, final) => {
        setLive(alts[0] ?? '');
        if (final && alts[0]) onTranscript(alts[0]);
      }, () => (recRef.current = null));
    }
  };
  const stop = () => {
    rec.stop();
    recRef.current?.stop();
  };
  const remove = async () => {
    await rec.remove();
    setLive('');
    update((s) => (s.profile ? { ...s, profile: { ...s.profile, voiceNotes: s.profile.voiceNotes.filter((v) => v.questionId !== stepId) } } : s));
  };

  if (!rec.supported) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {rec.state === 'recording' ? (
        <button className="ctrl !bg-terracotta !text-white" onClick={stop}><Icon name="stop" size={16} /> Stop voice note ({Math.ceil(rec.elapsed / 1000)}s)</button>
      ) : (
        <button className="ctrl" onClick={start}><Icon name="mic" size={16} /> {rec.url ? 'Re-record voice note' : 'Answer with a voice note'}</button>
      )}
      {rec.url && rec.state !== 'recording' && (
        <>
          <button className="ctrl" onClick={() => playUrl(rec.url!)}><Icon name="play" size={16} /> Play</button>
          <button className="ctrl" onClick={remove}><Icon name="trash" size={16} /> Delete</button>
        </>
      )}
      {live && <span className="text-sm italic text-ink-soft">“{live}”</span>}
      {rec.state === 'denied' && <span className="text-sm text-terracotta-dark">Microphone blocked — you can type or tap instead.</span>}
    </div>
  );
}

export function Welcome() {
  const { state } = useStore();
  const resumed = !!state.profile?.name;
  const [ci, setCi] = useState(0);
  useEffect(() => {
    const iv = window.setInterval(() => setCi((n) => (n + 1) % CITY_ORDER.length), 3800);
    return () => window.clearInterval(iv);
  }, []);
  const showCity = CITY_ORDER[ci];
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-cream-warm transition-colors duration-700" style={{ background: CITY_THEMES[showCity].palette.bgWarm }}>
      <div className="grain pointer-events-none absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0">
        <AnimatePresence mode="wait">
          <motion.div key={showCity} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
            <CitySkyline city={showCity} height={260} />
          </motion.div>
        </AnimatePresence>
      </div>
      <motion.div className="absolute right-[-60px] top-[-60px] h-72 w-72 rounded-full bg-saffron/60 blur-2xl" animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 8, repeat: Infinity }} />
      <main className="relative mx-auto flex min-h-[100dvh] max-w-5xl flex-col items-center justify-center gap-10 px-6 pb-72 pt-16 md:flex-row md:justify-between md:pb-56">
        <div className="max-w-lg text-center md:text-left">
          <p className="eyebrow !text-ink-soft">Tu nueva vida en <AnimatePresence mode="wait"><motion.span key={showCity} className="inline-block font-bold" style={{ color: CITY_THEMES[showCity].palette.primary }} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }}>{CITY_THEMES[showCity].name}</motion.span></AnimatePresence></p>
          <motion.h1 className="mt-3 font-display text-[64px] font-semibold leading-[0.95] sm:text-[88px]" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            VIVA
          </motion.h1>
          <motion.p className="mt-3 font-display text-2xl italic text-ink-soft" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            Learn Spanish. Live Spanish.
          </motion.p>
          <motion.p className="mt-5 text-lg text-ink-soft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
            Choose your city — Madrid, Barcelona, Sevilla, Ciudad de México, Buenos Aires or Medellín. Land, find your flat, order like a local, make real friends, and master the verbs that make Spanish work.
          </motion.p>
          <motion.div className="mt-8 flex flex-col items-center gap-3 sm:flex-row md:items-start" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <button className="btn-primary px-7 py-4 text-base" onClick={() => navigate('onboarding')}>
              {resumed ? `Continue, ${state.profile!.name}` : 'Start my Spanish life'} <Icon name="arrowRight" size={18} />
            </button>
            <button className="btn-ghost" onClick={() => navigate('privacy')}><Icon name="shield" size={18} /> Private by design</button>
          </motion.div>
          <p className="mt-4 text-sm text-ink-mute">Free. No account. Everything stays on this device.</p>
        </div>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="shrink-0">
          <Character look={CHARACTERS.lucia.look} mood="wave" size={260} label="Lucía, your guide, waving hello" />
        </motion.div>
      </main>
    </div>
  );
}

export function Onboarding() {
  const { state, update } = useStore();
  const profile = state.profile ?? blankProfile();
  const [i, setI] = useState(() => {
    const done = Object.keys(profile.notes).length;
    return profile.name ? Math.min(done, STEPS.length - 1) : 0;
  });
  const step = STEPS[i];
  const speaking = useTtsSpeaking();
  const [muted, setMuted] = useState(!state.settings.guideVoice);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!state.profile) update((s) => ({ ...s, profile: blankProfile() }));
  }, [state.profile, update]);

  useEffect(() => {
    if (step.kind === 'text' && step.field) setText(String(profile[step.field] ?? ''));
    if (!muted && ttsSupported) speak(step.es, { region: profile.region, rate: 0.95 });
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const set = (patch: Partial<LearnerProfile>) => update((s) => ({ ...s, profile: { ...(s.profile ?? blankProfile()), ...patch } }));

  const value = step.field ? profile[step.field] : undefined;
  const canContinue =
    step.optional ||
    (step.kind === 'text' ? text.trim().length > 0 : step.kind === 'multi' ? (value as string[]).length > 0 : true);

  const next = () => {
    const notes = { ...profile.notes, [step.id]: step.kind === 'text' ? text.trim() : 'answered' };
    const patch: Partial<LearnerProfile> = { notes };
    if (step.kind === 'text' && step.field) (patch as Record<string, unknown>)[step.field] = text.trim();
    set(patch);
    if (i < STEPS.length - 1) setI(i + 1);
    else navigate('level');
  };

  const toggleMulti = (v: string) => {
    const arr = (value as string[]) ?? [];
    set({ [step.field!]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] } as Partial<LearnerProfile>);
  };

  const guideMood: Mood = speaking ? 'happy' : step.mood ?? 'listening';

  return (
    <div className="min-h-[100dvh] bg-cream-warm">
      <div className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-5 pb-10 pt-5">
        <div className="flex items-center gap-3">
          <button className="ctrl !px-2" onClick={() => (i ? setI(i - 1) : navigate('welcome'))} aria-label="Back"><Icon name="arrowLeft" size={18} /></button>
          <Bar value={(i + 1) / STEPS.length} />
          <span className="text-sm tabular-nums text-ink-mute">{i + 1}/{STEPS.length}</span>
          <button className="ctrl !px-2" onClick={() => { setMuted(!muted); stopSpeaking(); update((s) => ({ ...s, settings: { ...s.settings, guideVoice: muted } })); }} aria-label={muted ? 'Turn guide voice on' : 'Mute guide voice'}>
            <Icon name={muted ? 'volumeOff' : 'volume'} size={18} />
          </button>
        </div>
        <p className="eyebrow mt-4 text-center">VIVA Discover</p>

        <div className={`mt-4 grid flex-1 items-start gap-6 md:gap-10 md:pt-6 ${step.kind === 'city' ? 'md:grid-cols-[180px_1fr]' : 'md:grid-cols-[300px_1fr]'}`}>
          <div className="flex flex-col items-center">
            <Character look={CHARACTERS.lucia.look} speaking={speaking} mood={guideMood} size={190} label="Lucía, your guide" />
          </div>

          <AnimatePresence mode="wait">
            <motion.section key={step.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <div className="relative rounded-4xl rounded-tl-lg bg-white p-6 shadow-soft">
                <p className="font-display text-2xl font-medium leading-snug sm:text-[28px]">{step.es.replace('{name}', profile.name)}</p>
                <p className="mt-2 text-ink-soft">{step.en}</p>
                {ttsSupported && (
                  <button className="ctrl mt-3" onClick={() => speak(step.es, { region: profile.region, rate: 0.85 })}><Icon name="replay" size={16} /> Hear Lucía</button>
                )}
              </div>

              <div className="mt-6">
                {step.kind === 'text' && (
                  <form onSubmit={(e) => { e.preventDefault(); if (canContinue) next(); }}>
                    <label className="sr-only" htmlFor={`q-${step.id}`}>{step.en}</label>
                    <input id={`q-${step.id}`} autoFocus className="input text-lg" value={text} onChange={(e) => setText(e.target.value)} placeholder={step.placeholder} autoComplete={step.id === 'name' ? 'given-name' : 'off'} />
                  </form>
                )}

                {(step.kind === 'single' || step.kind === 'multi') && (
                  <div className="grid gap-2.5 sm:grid-cols-2" role={step.kind === 'single' ? 'radiogroup' : 'group'} aria-label={step.en}>
                    {step.options!.map((o) => {
                      const selected = step.kind === 'single' ? String(value) === o.value : (value as string[]).includes(o.value);
                      return (
                        <motion.button
                          key={o.value}
                          whileTap={{ scale: 0.98 }}
                          role={step.kind === 'single' ? 'radio' : 'checkbox'}
                          aria-checked={selected}
                          onClick={() => {
                            if (step.kind === 'multi') toggleMulti(o.value);
                            else set({ [step.field!]: step.field === 'dailyMinutes' ? Number(o.value) : o.value } as Partial<LearnerProfile>);
                          }}
                          className={`flex items-center justify-between rounded-2xl px-4 py-3.5 text-left ring-1 transition ${selected ? 'bg-ink text-cream ring-ink' : 'bg-white/80 ring-ink/10 hover:ring-ink/25'}`}
                        >
                          <span>
                            <span className="block font-semibold">{o.label}</span>
                            {o.hint && <span className={`block text-sm ${selected ? 'text-cream/70' : 'text-ink-mute'}`}>{o.hint}</span>}
                          </span>
                          {selected && <Icon name="check" size={18} />}
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {step.kind === 'city' && (
                  <div>
                    <CityPicker value={profile.city} onChange={(c) => {
                      const t = CITY_THEMES[c];
                      set({ city: c, region: t.variety, destinationCity: t.name, destinationCountry: t.country, citiesVisited: [c] });
                    }} />
                    <p className="mt-3 text-sm text-ink-mute">You can move to another city at any time — your verbs and vocabulary come with you.</p>
                  </div>
                )}

                {step.kind === 'teacher' && (
                  <div className="grid gap-3">
                    <div className="flex gap-2" role="radiogroup" aria-label="Do you have a Spanish teacher?">
                      <button className="chip" role="radio" aria-checked={profile.hasTeacher} onClick={() => set({ hasTeacher: true })}>Sí, tengo profe</button>
                      <button className="chip" role="radio" aria-checked={!profile.hasTeacher} onClick={() => set({ hasTeacher: false })}>Not at the moment</button>
                    </div>
                    {profile.hasTeacher && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm font-medium">Teacher’s name<input className="input mt-1" value={state.teacher.name} onChange={(e) => update((s) => ({ ...s, teacher: { ...s.teacher, name: e.target.value } }))} /></label>
                        <label className="text-sm font-medium">Teacher’s email<input type="email" className="input mt-1" value={state.teacher.email} onChange={(e) => update((s) => ({ ...s, teacher: { ...s.teacher, email: e.target.value } }))} /></label>
                      </div>
                    )}
                  </div>
                )}

                <VoiceNote key={step.id} stepId={step.id} onTranscript={(t) => step.kind === 'text' && setText(t.replace(/[.!?]$/, ''))} />

                <div className="mt-8 flex items-center justify-between gap-3">
                  {step.optional ? <button className="btn-soft" onClick={next}>Skip</button> : <span />}
                  <button className="btn-primary px-7" disabled={!canContinue} onClick={next}>
                    {i === STEPS.length - 1 ? 'Choose my level' : 'Continue'} <Icon name="arrowRight" size={18} />
                  </button>
                </div>
              </div>
            </motion.section>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
