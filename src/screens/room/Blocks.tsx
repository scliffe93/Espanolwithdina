import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { DinaArt } from '../../components/Dina';
import { Icon, type IconName } from '../../components/Icon';
import { useSay } from '../../hooks/useSpeech';
import { confetti, haptic, sfx } from '../../lib/fx';
import type { LessonAnswer, LessonBlock } from '../../lib/platform/types';

const ACCENTS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡'];

/** Each kind of part has its own colour, icon and name, so the lesson changes look as it moves on. */
export const BLOCK_THEME: Record<LessonBlock['type'], { icon: IconName; es: string; en: string; wash: string; badge: string; dot: string; ink: string }> = {
  text: { icon: 'book', es: 'Mira', en: 'Look', wash: 'from-azul-50 via-white to-white', badge: 'bg-azul text-white', dot: 'bg-azul', ink: 'text-azul' },
  vocab: { icon: 'translate', es: 'Palabras', en: 'Words', wash: 'from-rosa-50 via-white to-white', badge: 'bg-rosa text-ink', dot: 'bg-rosa', ink: 'text-terracotta-dark' },
  question: { icon: 'chat', es: 'Te toca', en: 'Your turn', wash: 'from-terracotta-50 via-white to-white', badge: 'bg-terracotta text-white', dot: 'bg-terracotta', ink: 'text-terracotta-dark' },
  gap: { icon: 'edit', es: 'Completa', en: 'Fill the gap', wash: 'from-saffron-50 via-white to-white', badge: 'bg-saffron text-ink', dot: 'bg-saffron', ink: 'text-ink' },
  choice: { icon: 'check', es: 'Elige', en: 'Choose', wash: 'from-olive-50 via-white to-white', badge: 'bg-olive text-white', dot: 'bg-olive', ink: 'text-olive' },
};
// Answer tiles in a quiz: each option has its own colour and letter.
const TILES = ['bg-terracotta text-white', 'bg-azul text-white', 'bg-olive text-white', 'bg-saffron text-ink', 'bg-rosa text-ink', 'bg-ink text-cream'];

/** The sentence of a gap block with the gap drawn (or filled, once there is something to show). */
function GapSentence({ body, fill, tone }: { body: string; fill?: string; tone?: 'right' | 'wrong' }) {
  const [before, ...rest] = body.split(/_{2,}/);
  const after = rest.join('___');
  return <>{before}<motion.span key={fill ?? 'empty'} initial={fill ? { scale: 0.6, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} className={`mx-1 inline-block min-w-[4ch] rounded-xl px-2 text-center font-semibold ${fill ? (tone === 'wrong' ? 'bg-terracotta-50 text-terracotta-dark ring-2 ring-terracotta' : 'bg-olive-50 text-olive ring-2 ring-olive') : 'border-b-[3px] border-dashed border-ink/40'}`}>{fill || ' '}</motion.span>{after}</>;
}

const speakerHue = ['bg-azul-50 ring-azul/25', 'bg-rosa-50 ring-rosa/40', 'bg-olive-50 ring-olive/25', 'bg-saffron-50 ring-saffron/40'];

/** Explanation text, drawn by what it is: a conversation as speech bubbles, a list as rows, the rest as large text. */
function RichText({ body }: { body: string }) {
  const say = useSay();
  const lines = body.split('\n').map((l) => l.trim());
  const talk = lines.filter((l) => /^[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]{1,14}:\s+\S/.test(l));
  const speakers = [...new Set(talk.map((l) => l.split(':')[0]))];
  const isTalk = talk.length >= 3 && speakers.length >= 2 && speakers.length <= 4;
  return (
    <div className="mt-2 grid gap-2.5">
      {lines.map((l, i) => {
        if (!l) return null;
        const who = isTalk && /^[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]{1,14}:\s+\S/.test(l) ? l.split(':')[0] : null;
        if (who) {
          const n = speakers.indexOf(who); const said = l.slice(who.length + 1).trim();
          return (
            <motion.button type="button" key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.06 }} onClick={() => void say(said)}
              className={`flex max-w-[88%] items-start gap-3 rounded-3xl px-4 py-3 text-left ring-1 transition hover:brightness-95 ${speakerHue[n % speakerHue.length]} ${n % 2 ? 'ml-auto flex-row-reverse rounded-tr-md' : 'rounded-tl-md'}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-sm font-bold shadow-soft">{who[0]}</span>
              <span className="min-w-0"><span className="block text-xs font-bold uppercase tracking-wide text-ink-mute">{who}</span><span className="block font-display text-xl leading-snug sm:text-2xl" lang="es">{said}</span></span>
            </motion.button>
          );
        }
        if (/^[•\-*]\s+/.test(l)) {
          return <motion.p key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 8) * 0.06 }} className="flex items-start gap-3 rounded-2xl bg-white/80 px-4 py-2.5 text-[18px] leading-snug ring-1 ring-ink/5 sm:text-[20px]"><span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-azul text-white"><Icon name="check" size={13} /></span><span>{l.replace(/^[•\-*]\s+/, '')}</span></motion.p>;
        }
        const role = l.match(/^(You are|Your teacher is|Eres|Tu profesora es):\s*(.+)$/i);
        if (role) return <p key={i} className="flex flex-wrap items-center gap-2 text-lg"><span className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-cream">{role[1]}</span><b className="font-display text-2xl" lang="es">{role[2]}</b></p>;
        return <p key={i} className="whitespace-pre-wrap text-[19px] leading-relaxed sm:text-[22px]">{l}</p>;
      })}
      {isTalk && <p className="text-sm text-ink-mute">Tap a line to hear it.</p>}
    </div>
  );
}

/**
 * One block of a lesson, drawn large and lively enough to share on a screen.
 *  • `student`: the learner's own device. They can answer.
 *  • `present`: the teacher's shared screen. It shows the student's answer as it arrives.
 */
export function BlockView({ block, mode, answer, onAnswer, current }: { block: LessonBlock; mode: 'student' | 'present'; answer?: LessonAnswer; onAnswer?: (value: string) => void; current?: boolean }) {
  const say = useSay();
  const [draft, setDraft] = useState(answer?.value ?? '');
  const [editing, setEditing] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(new Set()); // word cards turned over
  useEffect(() => { if (!editing) setDraft(answer?.value ?? ''); }, [answer?.value, editing]);
  const can = mode === 'student' && !!onAnswer;
  const showAnswer = block.answer !== undefined && (block.reveal || !!answer);
  const right = (block.answer ?? '').split('|')[0].trim();
  const send = () => { if (draft.trim() && onAnswer) { onAnswer(draft.trim()); setEditing(false); } };
  const th = BLOCK_THEME[block.type];

  // A right answer is celebrated once, on both screens, when it arrives.
  const was = useRef(answer?.correct);
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    if (answer?.correct === true && was.current !== true) {
      const r = box.current?.getBoundingClientRect();
      confetti(r ? { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 200) } : {});
      sfx.correct();
    } else if (answer?.correct === false && was.current !== false && mode === 'student') { sfx.wrong(); haptic([30, 30, 30]); }
    was.current = answer?.correct;
  }, [answer?.correct, answer?.at, mode]);

  const pairs = block.pairs ?? [];
  return (
    <motion.article ref={box} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br p-5 shadow-soft ring-2 transition sm:p-7 ${th.wash} ${current ? 'ring-terracotta' : 'ring-ink/5'}`} data-testid={`block-${block.id}`} data-current={current || undefined} data-type={block.type}>
      <span className={`pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-20 blur-2xl ${th.dot}`} aria-hidden />
      <header className="relative flex flex-wrap items-center gap-2.5">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl shadow-soft ${th.badge}`}><Icon name={th.icon} size={19} /></span>
        <span className="min-w-0"><span className={`block text-xs font-bold uppercase tracking-[0.14em] ${th.ink}`}>{th.es} · {th.en}</span>{block.title && <span className="block truncate font-semibold text-ink-soft">{block.title}</span>}</span>
        {answer?.correct === true && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-olive text-white" aria-label="Right"><Icon name="check" size={18} /></motion.span>}
      </header>

      <div className="relative">
        {block.type === 'text' && <RichText body={block.body} />}

        {block.type === 'vocab' && (
          <>
            {block.body && <p className="mt-2 whitespace-pre-wrap text-lg text-ink-soft">{block.body}</p>}
            <p className="mt-2 text-sm text-ink-mute">Tap a card to hear it and see what it means. <b className={th.ink}>{seen.size} of {pairs.length}</b> turned.</p>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {pairs.map((p, i) => {
                const on = seen.has(i);
                return (
                  <motion.li key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i, 12) * 0.04 }}>
                    <button type="button" onClick={() => { void say(p.es); setSeen((s) => new Set(s).add(i)); }} aria-label={`${p.es}: ${on ? p.en : 'tap to hear and see the meaning'}`}
                      className={`flex h-full min-h-[5.5rem] w-full flex-col justify-center rounded-3xl px-4 py-3 text-left ring-2 transition hover:-translate-y-0.5 hover:shadow-soft active:scale-[0.98] ${on ? 'bg-white ring-rosa' : 'bg-rosa-50 ring-transparent'}`}>
                      <span className="flex items-center justify-between gap-2"><span className="font-display text-2xl font-semibold leading-tight" lang="es">{p.es}</span><Icon name="volume" size={16} className="shrink-0 text-ink-mute" /></span>
                      <motion.span key={on ? 'en' : 'q'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`mt-1 block ${on ? 'text-ink-soft' : 'text-sm text-ink-mute'}`}>{on ? p.en : '¿Qué significa?'}</motion.span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </>
        )}

        {block.type === 'question' && (
          <>
            <div className="mt-3 flex items-start gap-3">
              <div className="hidden shrink-0 sm:block"><DinaArt size={64} expression={answer ? 'beam' : 'smile'} /></div>
              <button type="button" onClick={() => void say(block.body.split('\n').filter((l) => /[¿?]/.test(l)).join(' ') || block.body)} className="min-w-0 flex-1 rounded-3xl rounded-tl-md bg-white px-5 py-4 text-left shadow-soft ring-1 ring-terracotta/20 transition hover:ring-terracotta/50" aria-label="Hear the question">
                <span className="block whitespace-pre-wrap font-display text-2xl font-medium leading-snug sm:text-3xl" lang="es">{block.body}</span>
                <span className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-terracotta-dark"><Icon name="volume" size={14} /> Escucha · Listen</span>
              </button>
            </div>
            {can ? (
              <div className="mt-4">
                <textarea className="input min-h-[110px] w-full text-lg" value={draft} onChange={(e) => { setDraft(e.target.value); setEditing(true); }} placeholder="Escribe tu respuesta…" lang="es" spellCheck={false} data-testid={`answer-${block.id}`} />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {ACCENTS.map((c) => <button key={c} type="button" className="h-9 w-9 rounded-xl bg-white text-lg ring-1 ring-ink/10" onMouseDown={(e) => e.preventDefault()} onClick={() => { setDraft((d) => d + c); setEditing(true); }}>{c}</button>)}
                  <button type="button" className="btn-primary ml-auto !py-2.5" disabled={!draft.trim() || (!editing && !!answer)} onClick={send} data-testid={`send-${block.id}`}><Icon name="send" size={16} /> {answer && !editing ? 'Sent' : answer ? 'Send again' : 'Send'}</button>
                </div>
              </div>
            ) : (
              <motion.div key={answer?.at ?? 'wait'} initial={answer ? { scale: 0.96, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} className={`ml-auto mt-4 min-h-[4rem] max-w-[90%] rounded-3xl rounded-tr-md p-4 text-xl sm:text-2xl ${answer ? 'bg-ink text-cream' : 'bg-white/70 ring-1 ring-dashed ring-ink/15'}`} lang="es" data-testid={`shown-${block.id}`}>
                {answer ? answer.value : <span className="flex items-center gap-2 text-base text-ink-mute">{mode === 'present' && <><span className="flex gap-1">{[0, 1, 2].map((d) => <motion.span key={d} className="h-2 w-2 rounded-full bg-ink/30" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: d * 0.2 }} />)}</span> Waiting for an answer…</>}</span>}
              </motion.div>
            )}
          </>
        )}

        {block.type === 'gap' && (
          <>
            <p className="mt-4 font-display text-2xl font-medium leading-relaxed sm:text-4xl" lang="es"><GapSentence body={block.body} fill={answer ? answer.value : block.reveal ? right : undefined} tone={answer && answer.correct === false ? 'wrong' : 'right'} /></p>
            {can && !answer?.correct && (
              <form className="mt-5 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
                <input className="input min-w-0 flex-1 text-xl" value={draft} onChange={(e) => { setDraft(e.target.value); setEditing(true); }} placeholder="Tu respuesta" lang="es" autoCapitalize="off" autoCorrect="off" spellCheck={false} data-testid={`answer-${block.id}`} />
                <button className="btn-primary" disabled={!draft.trim()} data-testid={`send-${block.id}`}>Check</button>
                <div className="flex w-full flex-wrap gap-1.5">{ACCENTS.slice(0, 6).map((c) => <button key={c} type="button" className="h-9 w-9 rounded-xl bg-white text-lg ring-1 ring-ink/10" onMouseDown={(e) => e.preventDefault()} onClick={() => { setDraft((d) => d + c); setEditing(true); }}>{c}</button>)}</div>
              </form>
            )}
            {answer && <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 inline-block rounded-full px-4 py-2 text-lg font-semibold ${answer.correct ? 'bg-olive text-white' : 'bg-terracotta-50 text-terracotta-dark'}`} role="status" data-testid={`verdict-${block.id}`}>{answer.correct ? '¡Correcto!' : <>Not quite{showAnswer && right ? <>: it is <span lang="es">{right}</span></> : ''}.{can ? ' Try again.' : ''}</>}</motion.p>}
            {!answer && block.reveal && <p className="mt-3 text-lg font-semibold text-olive">{right}</p>}
          </>
        )}

        {block.type === 'choice' && (
          <>
            <p className="mt-4 whitespace-pre-wrap font-display text-2xl font-medium leading-snug sm:text-4xl" lang="es">{block.body.includes('___') ? <GapSentence body={block.body} fill={answer ? answer.value : block.reveal ? block.answer : undefined} tone={answer && answer.correct === false ? 'wrong' : 'right'} /> : block.body}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(block.options ?? []).map((o, i) => {
                const picked = answer?.value === o, isRight = showAnswer && o === block.answer;
                const done = !!answer || !!block.reveal;
                const cls = isRight ? 'bg-olive text-white ring-4 ring-olive/40' : picked ? (answer?.correct === false ? 'bg-terracotta text-white ring-4 ring-terracotta/40' : 'bg-ink text-cream ring-4 ring-ink/30') : done ? `${TILES[i % TILES.length]} opacity-35` : TILES[i % TILES.length];
                return (
                  <motion.button key={o} type="button" disabled={!can || !!answer} onClick={() => onAnswer?.(o)} initial={{ opacity: 0, y: 12 }} animate={picked && answer?.correct === false ? { opacity: 1, y: 0, x: [0, -7, 7, -4, 0] } : { opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} whileTap={can && !answer ? { scale: 0.97 } : undefined}
                    className={`flex items-center gap-3 rounded-3xl px-4 py-4 text-left text-xl font-semibold shadow-soft transition sm:text-2xl ${cls} ${can && !answer ? 'hover:-translate-y-0.5 hover:brightness-110' : ''}`} lang="es" data-testid={`option-${block.id}`} data-picked={picked || undefined} data-right={isRight || undefined}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/25 text-base font-bold">{isRight ? <Icon name="check" size={18} /> : picked && answer?.correct === false ? <Icon name="x" size={18} /> : String.fromCharCode(65 + i)}</span>
                    <span className="min-w-0">{o}</span>
                  </motion.button>
                );
              })}
            </div>
            {answer && <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 inline-block rounded-full px-4 py-2 text-lg font-semibold ${answer.correct ? 'bg-olive text-white' : 'bg-terracotta-50 text-terracotta-dark'}`} role="status" data-testid={`verdict-${block.id}`}>{answer.correct ? '¡Correcto!' : 'Not quite.'}</motion.p>}
          </>
        )}
      </div>
    </motion.article>
  );
}

/** The lesson as a row of dots, one for each part in its colour, with the answers marked: where we are and how it is going. */
export function LessonTrail({ blocks, answers, current, onGo }: { blocks: LessonBlock[]; answers?: Record<string, LessonAnswer>; current?: string | null; onGo?: (id: string) => void }) {
  const right = blocks.filter((b) => answers?.[b.id]?.correct === true).length;
  const marked = blocks.filter((b) => b.type === 'gap' || b.type === 'choice').length;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="lesson-trail">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {blocks.map((b, i) => {
          const a = answers?.[b.id]; const here = b.id === current;
          const Tag = onGo ? 'button' : 'span';
          return <Tag key={b.id} {...(onGo ? { type: 'button' as const, onClick: () => onGo(b.id), 'aria-label': `Go to part ${i + 1}` } : {})} title={`${i + 1}. ${b.title || BLOCK_THEME[b.type].en}`}
            className={`grid place-items-center rounded-full text-[10px] font-bold text-white transition-all ${here ? 'h-7 w-7 ring-4 ring-terracotta/30' : 'h-4 w-4'} ${a?.correct === true ? 'bg-olive' : a?.correct === false ? 'bg-terracotta' : a ? 'bg-ink' : `${BLOCK_THEME[b.type].dot} ${here ? '' : 'opacity-45'}`}`}>{here ? i + 1 : ''}</Tag>;
        })}
      </div>
      {marked > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron px-3 py-1 text-sm font-bold text-ink" data-testid="lesson-stars"><Icon name="star" size={14} filled /> {right} / {marked}</span>}
    </div>
  );
}
