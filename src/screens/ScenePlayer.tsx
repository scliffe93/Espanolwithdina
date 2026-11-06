import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Character, type Mood } from '../components/Character';
import { Icon } from '../components/Icon';
import { SceneBackdrop } from '../components/SceneBackdrop';
import { SpeakControls } from '../components/SpeakControls';
import { Empty } from '../components/ui';
import { CHARACTERS, INTEREST_YOU, SCENES, SCENE_BY_ID, type Choice, type SceneNode } from '../data/story';
import { VOCAB_BY_ID, vocabForm, vocabKey } from '../data/vocab';
import { useTtsSpeaking } from '../hooks/useSpeech';
import { normalize, stripAccents, CATEGORY_LABEL } from '../lib/answer';
import { navigate } from '../lib/router';
import { recognitionSupported, recognize, speak, speakable, stopSpeaking, regionLang } from '../lib/speech';
import { addToDeck, completeScene, recordMistake, updateDay } from '../lib/state';
import { useStore } from '../lib/store';
import { CITY_THEMES } from '../data/cityThemes';
import { useAccount } from '../lib/account';
import { useHomeworkCompletion } from '../lib/platform/homework';
import { confetti, haptic, sfx } from '../lib/fx';
import { render, type TemplateCtx } from '../lib/template';
import type { Interest } from '../types';

interface Line {
  speaker: string;
  es: string;
  en: string;
  quality?: Choice['quality'];
}

function overlap(a: string, b: string): number {
  const A = new Set(stripAccents(normalize(a)).split(' '));
  const B = stripAccents(normalize(b)).split(' ');
  if (!B.length) return 0;
  return B.filter((w) => A.has(w)).length / Math.max(A.size, B.length);
}

export function ScenePlayer({ id }: { id: string }) {
  const scene = SCENE_BY_ID[id];
  const { state, update } = useStore();
  const account = useAccount();
  const hw = useHomeworkCompletion();
  const p = state.profile!;
  const [nodeId, setNodeId] = useState(scene?.start ?? '');
  const [history, setHistory] = useState<Line[]>([]);
  const [feedback, setFeedback] = useState<{ choice: Choice; retry: boolean } | null>(null);
  const [flags, setFlags] = useState<Record<string, string>>({});
  const [rel, setRel] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ great: 0, ok: 0, off: 0 });
  const [finished, setFinished] = useState(false);
  const [showEn, setShowEn] = useState<Record<number, boolean>>({});
  const [inputText, setInputText] = useState('');
  const [inputMsg, setInputMsg] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const speaking = useTtsSpeaking();
  const bottomRef = useRef<HTMLDivElement>(null);

  const ctx: TemplateCtx = { name: p.name, gender: p.gender, homeTown: flags.homeTown ?? (state.story.flags.homeTown as string | undefined) };
  const r = useCallback((t: string, mode: 'display' | 'speech' = 'display') => render(t, ctx, mode), [ctx.name, ctx.gender, ctx.homeTown]); // eslint-disable-line react-hooks/exhaustive-deps

  const node: SceneNode | undefined = scene?.nodes[nodeId];
  const lineText = useMemo(() => {
    if (!node) return { es: '', en: '' };
    if (node.variantFlag && node.variants) {
      const v = node.variants[flags[node.variantFlag]];
      if (v) return v;
    }
    return { es: node.es, en: node.en };
  }, [node, flags]);

  const choices: Choice[] = useMemo(() => {
    if (!node) return [];
    if (node.choicesFrom === 'interests') {
      const picks = (p.interests.length ? p.interests.slice(0, 3) : []) as (Interest | 'default')[];
      const list = [...picks, 'default' as const].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
      return [
        ...list.map<Choice>((k) => ({ es: INTEREST_YOU[k].es, en: INTEREST_YOU[k].en, next: node.interestNext!, quality: 'great', rel: 6, setFlag: ['interest', k] })),
        { es: 'Yo gusto el fútbol.', en: '(I please football.)', next: node.id, quality: 'off', category: 'person-agreement', feedback: 'With gustar, the thing you like is the subject: "Me gusta el fútbol" — literally "football pleases me".' },
      ];
    }
    return node.choices ?? [];
  }, [node, p.interests]);

  // Speak each new line
  useEffect(() => {
    if (!node || finished) return;
    setInputText('');
    setInputMsg(null);
    setHeard(null);
    if (state.settings.guideVoice && node.speaker !== 'narrator') speak(r(lineText.es, 'speech'), { region: p.region, rate: state.settings.speechRate });
    window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 80);
    return () => stopSpeaking();
  }, [nodeId, finished]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!scene) return <Empty icon="map" title="Place not found" body="That location doesn't exist." action={<button className="btn-primary" onClick={() => navigate('world')}>Back to Madrid</button>} />;
  if (scene.requires && !state.story.completedScenes.includes(scene.requires)) {
    return <Empty icon="lock" title="Not unlocked yet" body={`Complete “${SCENE_BY_ID[scene.requires].title}” first.`} action={<button className="btn-primary" onClick={() => navigate(`scene/${scene.requires}`)}>Go there</button>} />;
  }

  const speaker = node ? (node.speaker === 'narrator' ? null : CHARACTERS[node.speaker]) : null;
  const learnerTranslations = state.settings.showTranslations === 'always';
  const advanceTo = (next?: string) => {
    if (!next) return;
    setHistory((h) => [...h, { speaker: node!.speaker, es: r(lineText.es), en: r(lineText.en) }]);
    setNodeId(next);
  };

  const resolveNext = (c: Choice) => {
    if (c.next === '__branch' && node?.branchIf) return p.socialGoals.includes('dating') ? node.branchIf.then : node.branchIf.else;
    return c.next;
  };

  const choose = (c: Choice) => {
    if (feedback) return;
    stopSpeaking();
    const retry = resolveNext(c) === nodeId;
    setStats((s) => ({ ...s, [c.quality]: s[c.quality] + 1 }));
    const who = node!.speaker === 'narrator' ? scene.cast[0] : node!.speaker;
    if (c.rel) setRel((x) => ({ ...x, [who]: (x[who] ?? 0) + c.rel! }));
    if (c.setFlag) setFlags((f) => ({ ...f, [c.setFlag![0]]: c.setFlag![1] }));
    update((s) => {
      let n = updateDay(s, (d) => ({ ...d, exercisesAttempted: d.exercisesAttempted + 1, exercisesCorrect: d.exercisesCorrect + (c.quality === 'off' ? 0 : 1) }));
      n = { ...n, exerciseStats: { ...n.exerciseStats, dialogue: { attempts: (n.exerciseStats.dialogue?.attempts ?? 0) + 1, correct: (n.exerciseStats.dialogue?.correct ?? 0) + (c.quality === 'off' ? 0 : 1) } } };
      if (c.category && c.quality !== 'great') {
        const right = choices.find((x) => x.quality === 'great');
        n = recordMistake(n, { key: `scene:${scene.id}|${nodeId}`, expected: right ? r(right.es) : '', given: r(c.es), category: c.category, context: `${scene.title}: ${r(lineText.es)}` });
      }
      return n;
    });
    if (c.quality === 'off') { sfx.wrong(); haptic([30, 30, 30]); } else { if (c.quality === 'great') sfx.correct(); speak(r(c.es, 'speech'), { region: p.region, rate: state.settings.speechRate }); };
    setFeedback({ choice: c, retry });
  };

  const continueAfterChoice = () => {
    if (!feedback) return;
    const c = feedback.choice;
    setFeedback(null);
    if (feedback.retry) return; // stay on same node and try again
    setHistory((h) => [...h, { speaker: node!.speaker, es: r(lineText.es), en: r(lineText.en) }, { speaker: 'you', es: r(c.es), en: r(c.en), quality: c.quality }]);
    setNodeId(resolveNext(c));
  };

  const submitInput = (text: string) => {
    if (!node?.input) return;
    const spec = node.input;
    const plain = stripAccents(text.trim().toLowerCase());
    for (const w of spec.wrong ?? []) {
      if (new RegExp(w.pattern, 'i').test(plain)) {
        setInputMsg(w.feedback);
        setStats((s) => ({ ...s, off: s.off + 1 }));
        update((s) => recordMistake(updateDay(s, (d) => ({ ...d, exercisesAttempted: d.exercisesAttempted + 1 })), { key: `scene:${scene.id}|${nodeId}`, expected: spec.example, given: text, category: w.category, context: scene.title }));
        return;
      }
    }
    if (!new RegExp(spec.pattern, 'i').test(plain)) {
      setInputMsg(spec.hint);
      return;
    }
    let value = '';
    if (spec.capture) {
      const m = text.trim().match(new RegExp(spec.capture, 'i'));
      value = m?.[1]?.trim() ?? '';
      value = value.charAt(0).toUpperCase() + value.slice(1);
    }
    if (spec.saveAs && value) setFlags((f) => ({ ...f, [spec.saveAs!]: value }));
    setStats((s) => ({ ...s, great: s.great + 1 }));
    update((s) => updateDay(s, (d) => ({ ...d, exercisesAttempted: d.exercisesAttempted + 1, exercisesCorrect: d.exercisesCorrect + 1 })));
    setHistory((h) => [...h, { speaker: node.speaker, es: r(lineText.es), en: r(lineText.en) }, { speaker: 'you', es: text.trim(), en: '', quality: 'great' }]);
    setNodeId(spec.next);
  };

  const listen = () => {
    if (!recognitionSupported || listening) return;
    setListening(true);
    setHeard(null);
    const h = recognize(regionLang(p.region), (alts, final) => {
      setHeard(alts[0]);
      if (!final) return;
      if (node?.input) {
        setInputText(alts[0]);
        return;
      }
      // Match the spoken utterance to the closest choice.
      let best: Choice | null = null, bestScore = 0;
      for (const alt of alts) for (const c of choices) {
        const s = overlap(r(c.es), alt);
        if (s > bestScore) { bestScore = s; best = c; }
      }
      if (best && bestScore >= 0.5) {
        update((s) => updateDay(s, (d) => ({ ...d, speakingAttempts: d.speakingAttempts + 1 })));
        choose(best);
      }
    }, (err) => {
      setListening(false);
      if (err && err !== 'no-speech' && err !== 'aborted') setHeard(`(${err === 'not-allowed' ? 'Microphone blocked' : 'Could not recognise speech'})`);
    });
    if (!h) setListening(false);
  };

  const finish = () => {
    const total = stats.great + stats.ok + stats.off;
    const score = total ? (stats.great + stats.ok * 0.5) / total : 1;
    update((s) => {
      let n = completeScene(s, scene.id, score, rel, flags);
      n = addToDeck(n, scene.vocab.map(vocabKey));
      return n;
    });
    setFinished(true);
    if (hw.isHomework) hw.submit({ score, attempts: total, correct: stats.great + stats.ok, summary: `${stats.great} natural, ${stats.ok} OK, ${stats.off} learning moments` });
    sfx.win();
    confetti({ count: 150 });
  };

  // ─── Completion ───
  if (finished) {
    const nextScene = SCENES.find((s) => s.requires === scene.id);
    return (
      <div className="mx-auto max-w-2xl">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card overflow-hidden">
          <div className="relative h-40 overflow-hidden"><SceneBackdrop id={scene.backdrop} label={scene.place.split(',')[0]} /><div className="absolute inset-0 bg-gradient-to-t from-white via-white/30" /></div>
          <div className="-mt-12 p-6 pt-0 text-center">
            <div className="relative mx-auto w-fit"><Character look={CHARACTERS[scene.cast[0]].look} mood="happy" size={110} /></div>
            <p className="eyebrow mt-2">Chapter complete</p>
            <h1 className="text-3xl font-semibold">{scene.titleEs}</h1>
            <p className="mx-auto mt-2 max-w-md text-ink-soft">{scene.outro}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-olive-50 p-3"><b className="block text-2xl text-olive">{stats.great}</b><span className="text-xs">natural replies</span></div>
              <div className="rounded-2xl bg-saffron-50 p-3"><b className="block text-2xl text-ink-soft">{stats.ok}</b><span className="text-xs">OK replies</span></div>
              <div className="rounded-2xl bg-terracotta-50 p-3"><b className="block text-2xl text-terracotta">{stats.off}</b><span className="text-xs">learning moments</span></div>
            </div>
            {Object.keys(rel).length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {Object.entries(rel).map(([c, d]) => (
                  <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-rosa-50 px-3 py-1 text-sm"><Icon name="heart" size={14} filled className="text-rosa" /> {CHARACTERS[c].name} {d >= 0 ? '+' : ''}{d}</span>
                ))}
              </div>
            )}
            <div className="mt-5 rounded-2xl bg-cream-100 p-4 text-left">
              <p className="eyebrow mb-2">Added to your memory deck</p>
              <div className="flex flex-wrap gap-1.5">
                {scene.vocab.map((v) => <span key={v} className="rounded-full bg-white px-3 py-1 text-sm ring-1 ring-ink/5">{vocabForm(VOCAB_BY_ID[v], p.region)}</span>)}
              </div>
            </div>
            {account.configured && !account.session && (
              <button onClick={() => navigate('account')} className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-olive-50 p-3 text-left text-sm ring-1 ring-olive/20">
                <Icon name="user" size={20} className="shrink-0 text-olive" />
                <span><b>Keep this progress safe.</b> Create a free account (just a username and password) to continue on any device.</span>
              </button>
            )}
            {hw.isHomework && <button className="btn-dark mt-5 w-full" onClick={hw.backToHomework}><Icon name="check" size={18} /> Homework done — back to my homework</button>}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button className="btn-primary" onClick={() => navigate(`verbs?focus=${scene.verbs.slice(0, 4).join(',')}`)}><Icon name="dumbbell" size={18} /> Practise this chapter’s verbs</button>
              {nextScene ? (
                <button className="btn-ghost" onClick={() => navigate('world')}><Icon name="map" size={18} /> {nextScene.title} unlocked</button>
              ) : (
                <button className="btn-ghost" onClick={() => navigate('world')}><Icon name="map" size={18} /> Back to {CITY_THEMES[scene.city].name}</button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!node) return null;
  const memory = node.vocab?.length
    ? (() => {
        const v = VOCAB_BY_ID[node.vocab[0]];
        return { key: vocabKey(v.id), answer: vocabForm(v, p.region), en: v.en, origin: v.origin, trick: v.trick, visual: v.visual, story: v.story };
      })()
    : undefined;
  const mood: Mood = feedback ? (feedback.choice.quality === 'off' ? 'thinking' : 'happy') : speaking ? 'idle' : 'listening';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button className="ctrl" onClick={() => navigate('world')}><Icon name="arrowLeft" size={16} /> {CITY_THEMES[scene.city].name}</button>
        <div className="text-right"><p className="eyebrow">{scene.place}</p><p className="font-display text-lg font-semibold">{scene.titleEs}</p></div>
      </div>

      {/* Stage */}
      <div className="relative h-56 overflow-hidden rounded-4xl shadow-lift sm:h-72">
        <SceneBackdrop id={scene.backdrop} label={scene.place.split(',')[0]} />
        <AnimatePresence mode="wait">
          {speaker ? (
            <motion.div key={speaker.id} className="absolute bottom-0 left-1/2 -translate-x-1/2" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
              <Character look={speaker.look} speaking={speaking} mood={mood} size={200} framed={false} label={`${speaker.name}, ${speaker.role}`} />
            </motion.div>
          ) : (
            <motion.div key="narr" className="absolute inset-0 grid place-items-center bg-ink/20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          )}
        </AnimatePresence>
        {speaker && <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold shadow-soft">{speaker.name} <span className="font-normal text-ink-mute">· {speaker.role}</span></span>}
      </div>

      {/* Transcript */}
      {history.length > 0 && (
        <div className="mt-4 grid gap-2">
          {history.slice(-6).map((l, i) => {
            const idx = history.length - Math.min(6, history.length) + i;
            const mine = l.speaker === 'you';
            return (
              <button key={idx} onClick={() => setShowEn((s) => ({ ...s, [idx]: !s[idx] }))} className={`max-w-[85%] rounded-2xl px-4 py-2 text-left text-[15px] ${mine ? `self-end justify-self-end ${l.quality === 'off' ? 'bg-terracotta-50' : 'bg-azul text-cream'}` : 'bg-white/80 ring-1 ring-ink/5'}`}>
                <span className={`mr-1 text-xs font-semibold ${mine ? 'opacity-70' : 'text-ink-mute'}`}>{mine ? 'Tú' : l.speaker === 'narrator' ? '' : CHARACTERS[l.speaker]?.name}</span>
                {l.es}
                {(showEn[idx] || learnerTranslations) && l.en && <span className={`block text-sm ${mine ? 'opacity-75' : 'text-ink-mute'}`}>{l.en}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Current line */}
      <motion.div key={nodeId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 rounded-4xl p-5 ${node.speaker === 'narrator' ? 'bg-ink text-cream' : 'card'}`}>
        {node.speaker === 'narrator' ? (
          <>
            <p className="font-display text-xl italic">{r(lineText.es)}</p>
            <p className="mt-1 text-cream/70">{r(lineText.en)}</p>
          </>
        ) : (
          <>
            <p className="font-display text-2xl font-medium leading-snug">{r(lineText.es)}</p>
            {learnerTranslations && <p className="mt-1 text-ink-mute">{r(lineText.en)}</p>}
            <SpeakControls es={r(lineText.es)} en={r(lineText.en)} grammar={node.grammar} memory={memory} recordId={`scene-${scene.id}-${nodeId}`} />
          </>
        )}
      </motion.div>

      {/* Responses */}
      <div className="mt-4">
        <AnimatePresence mode="wait">
          {feedback ? (
            <motion.div key="fb" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`rounded-3xl p-5 ring-1 ${feedback.choice.quality === 'great' ? 'bg-olive-50 ring-olive/30' : feedback.choice.quality === 'ok' ? 'bg-saffron-50 ring-saffron/40' : 'bg-terracotta-50 ring-terracotta/30'}`}>
              <p className="flex items-center gap-2 font-semibold">
                <Icon name={feedback.choice.quality === 'off' ? 'info' : 'check'} size={18} />
                {feedback.choice.quality === 'great' ? '¡Muy natural!' : feedback.choice.quality === 'ok' ? 'That works — with a nuance' : 'Not quite — let’s learn from it'}
                {feedback.choice.category && feedback.choice.quality !== 'great' && <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium">{CATEGORY_LABEL[feedback.choice.category]}</span>}
              </p>
              <p className="mt-1">“{r(feedback.choice.es)}”</p>
              {feedback.choice.feedback && <p className="mt-2 text-ink-soft">{r(feedback.choice.feedback)}</p>}
              <button className="btn-dark mt-4" onClick={continueAfterChoice}>{feedback.retry ? 'Try again' : 'Continue'} <Icon name="arrowRight" size={18} /></button>
            </motion.div>
          ) : node.input ? (
            <motion.form key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={(e) => { e.preventDefault(); submitInput(inputText); }} className="card p-5">
              <label htmlFor="scene-input" className="eyebrow">Your answer — type or say it</label>
              <div className="mt-2 flex gap-2">
                <input id="scene-input" className="input" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={node.input.hint} autoComplete="off" lang="es" />
                {recognitionSupported && <button type="button" className={`btn-ghost !px-3 ${listening ? '!bg-terracotta !text-white' : ''}`} onClick={listen} aria-label="Say your answer"><Icon name="mic" size={20} /></button>}
              </div>
              {heard && <p className="mt-2 text-sm italic text-ink-mute">Heard: “{heard}”</p>}
              {inputMsg && <p className="mt-2 text-sm text-terracotta-dark">{inputMsg}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="submit" className="btn-primary" disabled={!inputText.trim()}>Reply</button>
                <button type="button" className="btn-soft" onClick={() => setInputText(node.input!.example)}>Show me an example</button>
              </div>
            </motion.form>
          ) : choices.length ? (
            <motion.div key={`ch-${nodeId}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-2.5">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Your reply</p>
                {recognitionSupported && (
                  <button className={`ctrl ${listening ? '!bg-terracotta !text-white' : ''}`} onClick={listen}><Icon name="mic" size={16} /> {listening ? 'Listening…' : 'Say your reply'}</button>
                )}
              </div>
              {heard && <p className="text-sm italic text-ink-mute">Heard: “{heard}”{!listening && ' — tap a reply if it didn’t match.'}</p>}
              {choices.map((c, i) => (
                <ChoiceCard key={i} text={r(c.es)} en={r(c.en)} onChoose={() => choose(c)} onListen={() => speak(speakable(r(c.es, 'speech')), { region: p.region, rate: state.settings.speechRate })} forceEn={learnerTranslations} />
              ))}
            </motion.div>
          ) : node.end ? (
            <motion.button key="end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="btn-primary w-full py-4" onClick={finish}>Finish chapter <Icon name="check" size={18} /></motion.button>
          ) : (
            <motion.button key="next" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="btn-dark w-full py-4" onClick={() => advanceTo(node.next)}>Continue <Icon name="arrowRight" size={18} /></motion.button>
          )}
        </AnimatePresence>
      </div>
      <div ref={bottomRef} className="h-4" />
    </div>
  );
}

function ChoiceCard({ text, en, onChoose, onListen, forceEn }: { text: string; en: string; onChoose: () => void; onListen: () => void; forceEn: boolean }) {
  const [showEn, setShowEn] = useState(false);
  return (
    <div className="group flex items-stretch gap-1 rounded-2xl bg-white ring-1 ring-ink/10 transition hover:ring-terracotta/50 hover:shadow-soft">
      <button className="flex-1 px-4 py-3.5 text-left" onClick={onChoose}>
        <span className="block text-[17px] font-medium">{text}</span>
        {(showEn || forceEn) && <span className="block text-sm text-ink-mute">{en}</span>}
      </button>
      <div className="flex shrink-0 items-center gap-1 pr-2">
        <button className="rounded-full p-2 text-ink-mute hover:bg-cream-100 hover:text-ink" onClick={onListen} aria-label={`Listen: ${text}`}><Icon name="volume" size={18} /></button>
        {!forceEn && <button className="rounded-full p-2 text-ink-mute hover:bg-cream-100 hover:text-ink" onClick={() => setShowEn((s) => !s)} aria-label={`Translate: ${text}`} aria-pressed={showEn}><Icon name="translate" size={18} /></button>}
      </div>
    </div>
  );
}
