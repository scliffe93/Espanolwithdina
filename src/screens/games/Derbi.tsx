import { motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { FOOTBALL, footballWords } from '../../data/football';
import { VOCAB, vocabForm, type VocabItem } from '../../data/vocab';
import { shuffle } from '../../lib/exercises';
import { useSay } from '../../hooks/useSpeech';
import { useStore } from '../../lib/store';
import { GameShell, type GameApi } from './GameShell';

// Derby quiz: football words in the Spanish of your region, plus the clubs,
// grounds and nicknames of the city you live in. Vocabulary answers feed the
// memory deck; club questions are just for the bragging rights.

interface Q { id: number; prompt: string; sub?: string; options: string[]; answer: string; sayText?: string; vocab?: VocabItem; dir?: 'es-en' | 'en-es' }

function Quiz({ api }: { api: GameApi }) {
  const { state } = useStore();
  const say = useSay();
  const region = state.profile?.region ?? 'spain';
  const cityId = state.profile?.city ?? 'madrid';
  const city = FOOTBALL[cityId];
  const w = footballWords(region);
  const words = useMemo(() => VOCAB.filter((v) => v.theme === 'football'), []);
  const idRef = useRef(0);

  const clubQuestions = useMemo(() => {
    const [a, b] = city.clubs;
    const stadiums = shuffle(Object.values(FOOTBALL).flatMap((c) => c.clubs.map((k) => k.stadium)).filter((s, i, arr) => arr.indexOf(s) === i));
    const nicks = shuffle(Object.values(FOOTBALL).flatMap((c) => c.clubs.map((k) => k.nickname)));
    const derbies = shuffle(Object.values(FOOTBALL).map((c) => c.derby));
    const pick = (right: string, all: string[]) => shuffle([right, ...all.filter((x) => x !== right).slice(0, 3)]);
    return [
      { prompt: `¿Dónde juega ${a.name}?`, sub: `Where do ${a.name} play?`, answer: a.stadium, options: pick(a.stadium, stadiums) },
      { prompt: `¿Dónde juega ${b.name}?`, sub: `Where do ${b.name} play?`, answer: b.stadium, options: pick(b.stadium, stadiums) },
      { prompt: `¿Cómo llaman a ${a.name}?`, sub: `What is ${a.name}'s nickname?`, answer: a.nickname, options: pick(a.nickname, nicks) },
      { prompt: `¿Cómo llaman a ${b.name}?`, sub: `What is ${b.name}'s nickname?`, answer: b.nickname, options: pick(b.nickname, nicks) },
      { prompt: `¿Cómo se llama el partido ${a.short} – ${b.short}?`, sub: 'What is the local derby called?', answer: city.derby, options: pick(city.derby, derbies) },
      { prompt: `¿Qué club es más antiguo?`, sub: 'Which club is older?', answer: a.founded < b.founded ? a.name : b.name, options: [a.name, b.name] },
      { prompt: `En ${region === 'spain' ? 'España' : region === 'mexico' ? 'México' : region === 'argentina' ? 'Argentina' : 'Colombia'}, ¿cómo se dice "the fans"?`, sub: 'Regional word', answer: w.fans, options: shuffle([w.fans, w.fans === 'la afición' ? 'la hinchada' : 'la afición', 'los jugadores', 'la cancha']) },
      { prompt: `Y ¿cómo se dice "the penalty"?`, sub: 'Regional word', answer: w.penalty, options: shuffle([w.penalty, w.penalty === 'el penal' ? 'el penalti' : 'el penal', 'la falta', 'el saque']) },
    ];
  }, [city, region, w]);

  const make = (): Q => {
    const id = ++idRef.current;
    if (id % 3 === 0) { const c = clubQuestions[Math.floor(Math.random() * clubQuestions.length)]; return { id, ...c }; }
    const item = words[Math.floor(Math.random() * words.length)];
    const dir: Q['dir'] = Math.random() < 0.5 ? 'es-en' : 'en-es';
    const others = shuffle(words.filter((v) => v.id !== item.id)).slice(0, 3);
    if (dir === 'es-en') return { id, prompt: vocabForm(item, region), sub: 'What does it mean?', answer: item.en, options: shuffle([item.en, ...others.map((o) => o.en)]), sayText: vocabForm(item, region), vocab: item, dir };
    return { id, prompt: item.en, sub: 'How do you say it here?', answer: vocabForm(item, region), options: shuffle([vocabForm(item, region), ...others.map((o) => vocabForm(o, region))]), sayText: vocabForm(item, region), vocab: item, dir };
  };
  const [q, setQ] = useState<Q>(make);
  const [picked, setPicked] = useState<string | null>(null);
  const next = () => { setPicked(null); setQ(make()); };

  const answer = (opt: string, e?: React.MouseEvent) => {
    if (picked || !api.playing) return;
    setPicked(opt);
    const ok = opt === q.answer;
    const attempt = q.vocab ? { key: `vocab:${q.vocab.id}`, exerciseType: 'game-derbi' } : null;
    if (ok) {
      api.hit(q.vocab ? 90 : 60, attempt, { label: `${q.prompt} → ${q.answer}`, correct: true }, e ? { x: e.clientX, y: e.clientY } : undefined);
      if (q.sayText) say(q.sayText);
      setTimeout(next, 600);
    } else {
      api.miss(attempt ? { ...attempt, mistake: { expected: q.answer, given: opt, category: 'vocabulary', context: 'Derby quiz' } } : null, { label: `${q.prompt} → ${q.answer}`, correct: false, detail: `you picked “${opt}”`, category: q.vocab ? 'vocabulary' : undefined });
      setTimeout(next, 1300);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="rounded-4xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${city.clubs[0].colors[1]} 0%, ${city.clubs[1].colors[0]} 100%)` }}>
        <p className="text-xs uppercase tracking-[0.2em] text-white/80">{city.derby} · {q.vocab ? (q.dir === 'es-en' ? 'Palabra' : 'Word') : 'Club'}</p>
        <motion.p key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-1 font-display text-3xl font-semibold drop-shadow sm:text-4xl">{q.prompt}</motion.p>
        {q.sub && <p className="mt-1 text-sm text-white/80">{q.sub}</p>}
        {q.sayText && q.dir === 'es-en' && <button type="button" className="mt-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold" onClick={() => say(q.sayText!)}>Listen</button>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          const isPick = picked === opt;
          const cls = !picked ? 'bg-white text-ink hover:bg-cream-100' : opt === q.answer ? 'bg-olive text-white' : isPick ? 'bg-terracotta text-white' : 'bg-white text-ink-mute';
          return <motion.button key={q.id + ':' + i} type="button" whileTap={{ scale: 0.97 }} disabled={!!picked} onClick={(e) => answer(opt, e)} className={`rounded-2xl px-4 py-4 text-left text-lg font-semibold shadow-soft transition ${cls}`} data-testid={`derbi-${i}`}>{opt}</motion.button>;
        })}
      </div>
      {picked && picked !== q.answer && q.vocab?.regionNote && <p className="text-sm text-ink-soft" role="status">{q.vocab.regionNote}</p>}
    </div>
  );
}

export function Derbi() {
  return <GameShell id="derbi" duration={75} lives={3}>{(api) => <Quiz api={api} />}</GameShell>;
}
