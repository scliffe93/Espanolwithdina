import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { conjugate, personsForRegion, verbKey, type Verb } from '../../data/verbs';
import { checkAnswer, classifyVerbError } from '../../lib/answer';
import { pronounFor } from '../../lib/exercises';
import { useSay, stopSpeaking } from '../../hooks/useSpeech';
import { recognitionSupported, recognize, regionLang, type RecognitionHandle } from '../../lib/speech';
import { addSpeakingAttempt } from '../../lib/state';
import { useStore } from '../../lib/store';
import { bestHeard } from '../Verbs';
import { GameShell, type GameApi } from './GameShell';
import { useVerbPool } from './MetroRush';

// Say It: a pronoun and a verb; say the form aloud and the phone checks what it heard.

interface Round { id: number; verb: Verb; person: number; pronoun: string; answer: string }

function Mic({ api }: { api: GameApi }) {
  const { state, update } = useStore();
  const say = useSay();
  const pool = useVerbPool();
  const persons = personsForRegion();
  const idRef = useRef(0);
  const make = (): Round => {
    for (let i = 0; i < 20; i++) {
      const verb = pool[Math.floor(Math.random() * pool.length)], person = persons[Math.floor(Math.random() * persons.length)];
      const answer = conjugate(verb, 'present', person);
      if (answer && !verb.pronominal) return { id: ++idRef.current, verb, person, pronoun: pronounFor(verb, person), answer };
    }
    const verb = pool[0]; return { id: ++idRef.current, verb, person: 0, pronoun: pronounFor(verb, 0), answer: conjugate(verb, 'present', 0) };
  };
  const [round, setRound] = useState<Round>(make);
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; heard: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const mic = useRef<RecognitionHandle | null>(null);
  const stopTimer = useRef<number>();
  useEffect(() => () => { window.clearTimeout(stopTimer.current); mic.current?.stop(); }, []);
  useEffect(() => { if (!api.playing) mic.current?.stop(); }, [api.playing]);
  const label = `${round.pronoun} ${round.answer}`;
  const attempt = { key: verbKey(round.verb.inf, 'present', round.person), exerciseType: 'game-say', verb: round.verb.inf, tense: 'present' };
  const next = () => { setResult(null); setNote(null); setRound(make()); };

  const judge = (heard: string) => {
    const ok = checkAnswer(heard, [round.answer]) !== 'wrong';
    setResult({ ok, heard });
    update((s) => addSpeakingAttempt(s));
    if (ok) { api.hit(130, attempt, { label, correct: true }); setTimeout(next, 900); }
    else {
      const category = classifyVerbError(round.verb, 'present', round.person, heard);
      api.miss({ ...attempt, mistake: { expected: round.answer, given: heard, category, context: `Say It · ${round.verb.inf}` } }, { label, correct: false, detail: `I heard “${heard}”`, category });
      void say(label);
      setTimeout(next, 2200);
    }
  };
  const listen = () => {
    if (!api.playing || result) return;
    if (listening) { mic.current?.stop(); return; }
    stopSpeaking(); setNote(null);
    let best = '';
    const h = recognize(regionLang(state.profile?.region ?? 'spain'), (alts, isFinal) => { best = bestHeard(alts, round.answer); if (isFinal) mic.current?.stop(); }, (err) => {
      setListening(false); mic.current = null; window.clearTimeout(stopTimer.current);
      if (best) judge(best);
      else setNote(err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture' ? 'The microphone is not available. Allow it for this site in your phone’s settings.' : 'I did not catch that. Tap and try again.');
    });
    if (!h) { setNote('Speaking is not available in this browser.'); return; }
    mic.current = h; setListening(true);
    stopTimer.current = window.setTimeout(() => mic.current?.stop(), 7000);
  };

  return (
    <div className="overflow-hidden rounded-4xl bg-olive text-white shadow-lift">
      <div className="p-5 text-center sm:p-7">
        <p className="eyebrow !text-white/75">Present · say it in Spanish</p>
        <motion.p key={round.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="mt-1 font-display text-4xl font-semibold sm:text-5xl" lang="es"><span className="text-saffron-light">{round.pronoun}</span> · {round.verb.inf}</motion.p>
        <p className="mt-1 text-sm text-white/80">{round.verb.en.split(' (')[0]}</p>
      </div>
      <div className="grid justify-items-center gap-3 bg-cream p-6 text-ink">
        <motion.button type="button" onClick={listen} disabled={!!result} whileTap={{ scale: 0.94 }} animate={listening ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={listening ? { duration: 1, repeat: Infinity } : { duration: 0.15 }}
          aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Tap and say the form'} data-testid="say-mic"
          className={`grid h-28 w-28 place-items-center rounded-full shadow-lift ring-8 transition-colors ${result ? (result.ok ? 'bg-olive text-white ring-olive/20' : 'bg-terracotta text-white ring-terracotta/20') : listening ? 'bg-terracotta text-white ring-terracotta/25' : 'bg-ink text-cream ring-ink/10'}`}>
          <Icon name={result ? (result.ok ? 'check' : 'x') : 'mic'} size={44} />
        </motion.button>
        <p className="min-h-[3.2rem] text-center" role="status">
          {result ? (result.ok ? <span className="font-display text-2xl font-semibold text-olive" lang="es">{label}</span> : <>I heard “{result.heard}”. It is <b lang="es">{label}</b></>) : listening ? <span className="font-semibold text-terracotta">Listening…</span> : note ? <span className="text-sm text-ink-soft">{note}</span> : <span className="text-sm text-ink-mute">Tap the microphone, then say the form</span>}
        </p>
        <button type="button" className="ctrl" disabled={!!result || listening} onClick={() => { api.miss({ ...attempt, mistake: { expected: round.answer, given: '(skipped)', category: 'other', context: `Say It · ${round.verb.inf}` } }, { label, correct: false, detail: 'skipped' }); setResult({ ok: false, heard: '…' }); void say(label); setTimeout(next, 1800); }}>I don’t know this one</button>
      </div>
    </div>
  );
}

export function SayIt() {
  if (!recognitionSupported) return <div className="card mx-auto max-w-xl p-6 text-center"><h2 className="text-2xl font-semibold">Say It needs a microphone the browser can use</h2><p className="mt-2 text-ink-soft">This browser cannot understand speech. Try Chrome or Safari, or play Quick Keys, which trains the same forms by typing.</p></div>;
  return <GameShell id="say" duration={90} lives={5}>{(api) => <Mic api={api} />}</GameShell>;
}
