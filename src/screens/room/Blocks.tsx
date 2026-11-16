import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useSay } from '../../hooks/useSpeech';
import type { LessonAnswer, LessonBlock } from '../../lib/platform/types';

const ACCENTS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡'];

/** The sentence of a gap block with the gap drawn (or filled, once there is something to show). */
function GapSentence({ body, fill, tone }: { body: string; fill?: string; tone?: 'right' | 'wrong' }) {
  const [before, ...rest] = body.split(/_{2,}/);
  const after = rest.join('___');
  return <>{before}<span className={`mx-1 inline-block min-w-[4ch] border-b-[3px] px-1 text-center font-semibold ${fill ? (tone === 'wrong' ? 'border-terracotta text-terracotta-dark' : 'border-olive text-olive') : 'border-dashed border-ink/40'}`}>{fill || ' '}</span>{after}</>;
}

/**
 * One block of a lesson, drawn large enough to share on a screen.
 *  • `student`: the learner's own device. They can answer.
 *  • `present`: the teacher's shared screen. It shows the student's answer as it arrives.
 */
export function BlockView({ block, mode, answer, onAnswer, current }: { block: LessonBlock; mode: 'student' | 'present'; answer?: LessonAnswer; onAnswer?: (value: string) => void; current?: boolean }) {
  const say = useSay();
  const [draft, setDraft] = useState(answer?.value ?? '');
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setDraft(answer?.value ?? ''); }, [answer?.value, editing]);
  const can = mode === 'student' && !!onAnswer;
  const showAnswer = block.answer !== undefined && (block.reveal || !!answer);
  const right = (block.answer ?? '').split('|')[0].trim();
  const send = () => { if (draft.trim() && onAnswer) { onAnswer(draft.trim()); setEditing(false); } };

  return (
    <article className={`rounded-3xl bg-white p-5 shadow-soft ring-2 transition sm:p-7 ${current ? 'ring-terracotta' : 'ring-transparent'}`} data-testid={`block-${block.id}`} data-current={current || undefined}>
      {block.title && <p className="eyebrow">{block.title}</p>}

      {block.type === 'text' && <p className="mt-1 whitespace-pre-wrap text-[19px] leading-relaxed sm:text-[22px]">{block.body}</p>}

      {block.type === 'vocab' && (
        <>
          {block.body && <p className="mt-1 whitespace-pre-wrap text-lg text-ink-soft">{block.body}</p>}
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {(block.pairs ?? []).map((p, i) => (
              <li key={i}><button type="button" onClick={() => void say(p.es)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-cream-100 px-4 py-3 text-left hover:bg-cream-200"><span className="font-display text-xl font-semibold" lang="es">{p.es}</span><span className="text-ink-soft">{p.en}</span></button></li>
            ))}
          </ul>
        </>
      )}

      {block.type === 'question' && (
        <>
          <p className="mt-1 whitespace-pre-wrap font-display text-2xl font-medium leading-snug sm:text-3xl" lang="es">{block.body}</p>
          {can ? (
            <div className="mt-4">
              <textarea className="input min-h-[110px] w-full text-lg" value={draft} onChange={(e) => { setDraft(e.target.value); setEditing(true); }} placeholder="Escribe tu respuesta…" lang="es" spellCheck={false} data-testid={`answer-${block.id}`} />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {ACCENTS.map((c) => <button key={c} type="button" className="h-9 w-9 rounded-xl bg-cream-100 text-lg" onMouseDown={(e) => e.preventDefault()} onClick={() => { setDraft((d) => d + c); setEditing(true); }}>{c}</button>)}
                <button type="button" className="btn-primary ml-auto !py-2.5" disabled={!draft.trim() || (!editing && !!answer)} onClick={send} data-testid={`send-${block.id}`}><Icon name="send" size={16} /> {answer && !editing ? 'Sent' : answer ? 'Send again' : 'Send'}</button>
              </div>
            </div>
          ) : (
            <div className="mt-4 min-h-[4rem] rounded-2xl bg-cream-100 p-4 text-xl" lang="es" data-testid={`shown-${block.id}`}>{answer ? answer.value : <span className="text-base text-ink-mute">{mode === 'present' ? 'Waiting for an answer…' : ''}</span>}</div>
          )}
        </>
      )}

      {block.type === 'gap' && (
        <>
          <p className="mt-2 font-display text-2xl font-medium leading-relaxed sm:text-3xl" lang="es"><GapSentence body={block.body} fill={answer ? (answer.correct ? answer.value : answer.value) : block.reveal ? right : undefined} tone={answer && answer.correct === false ? 'wrong' : 'right'} /></p>
          {can && !answer?.correct && (
            <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <input className="input min-w-0 flex-1 text-xl" value={draft} onChange={(e) => { setDraft(e.target.value); setEditing(true); }} placeholder="Tu respuesta" lang="es" autoCapitalize="off" autoCorrect="off" spellCheck={false} data-testid={`answer-${block.id}`} />
              <button className="btn-primary" disabled={!draft.trim()} data-testid={`send-${block.id}`}>Check</button>
              <div className="flex w-full flex-wrap gap-1.5">{ACCENTS.slice(0, 6).map((c) => <button key={c} type="button" className="h-9 w-9 rounded-xl bg-cream-100 text-lg" onMouseDown={(e) => e.preventDefault()} onClick={() => { setDraft((d) => d + c); setEditing(true); }}>{c}</button>)}</div>
            </form>
          )}
          {answer && <p className={`mt-3 text-lg font-semibold ${answer.correct ? 'text-olive' : 'text-terracotta-dark'}`} role="status" data-testid={`verdict-${block.id}`}>{answer.correct ? '¡Correcto!' : <>Not quite{showAnswer && right ? <>: it is <span lang="es">{right}</span></> : ''}.{can ? ' Try again.' : ''}</>}</p>}
          {!answer && block.reveal && <p className="mt-3 text-lg font-semibold text-olive">{right}</p>}
        </>
      )}

      {block.type === 'choice' && (
        <>
          <p className="mt-1 whitespace-pre-wrap font-display text-2xl font-medium leading-snug sm:text-3xl" lang="es">{block.body}</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {(block.options ?? []).map((o) => {
              const picked = answer?.value === o, isRight = showAnswer && o === block.answer;
              const cls = isRight ? 'bg-olive text-white ring-olive' : picked ? (answer?.correct === false ? 'bg-terracotta text-white ring-terracotta' : 'bg-ink text-cream ring-ink') : 'bg-cream-100 ring-transparent';
              return <button key={o} type="button" disabled={!can || !!answer} onClick={() => onAnswer?.(o)} className={`rounded-2xl px-4 py-4 text-left text-xl font-semibold ring-2 transition-colors ${cls} ${can && !answer ? 'hover:ring-ink/30 active:scale-[0.98]' : ''}`} lang="es" data-testid={`option-${block.id}`} data-picked={picked || undefined}>{o}</button>;
            })}
          </div>
          {answer && <p className={`mt-3 text-lg font-semibold ${answer.correct ? 'text-olive' : 'text-terracotta-dark'}`} role="status" data-testid={`verdict-${block.id}`}>{answer.correct ? '¡Correcto!' : 'Not quite.'}</p>}
        </>
      )}
    </article>
  );
}
