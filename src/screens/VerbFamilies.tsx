import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { BOOT, FAMILIES, FAMILY_BY_ID, PRONOUNS, familyRound, stemForm, type Family, type FamilyId, type FamilyQuestion } from '../data/families';
import { VERB_BY_INF, verbKey } from '../data/verbs';
import { useSay } from '../hooks/useSpeech';
import { checkAnswer } from '../lib/answer';
import { confetti, haptic, sfx } from '../lib/fx';
import { recordAttempt, updateDay } from '../lib/state';
import { useStore } from '../lib/store';

// ───────────────────────────────────────────────────────────────
// Verb families. Verbs that change in the same way are shown
// together, so learning one teaches the others: the stem-changers
// (e → ie, o → ue, e → i), which change inside the "boot", and the
// verbs with a special yo form (-go, -zco, -oy). A short game mixes
// three questions: which family is it, do the same change to a
// sister verb, and does it change here or not.
// ───────────────────────────────────────────────────────────────

const TONE: Record<FamilyId, { bar: string; tile: string; text: string }> = {
  'e-ie': { bar: 'bg-terracotta', tile: 'bg-terracotta-50', text: 'text-terracotta-dark' },
  'o-ue': { bar: 'bg-azul', tile: 'bg-azul-50', text: 'text-azul' },
  'e-i': { bar: 'bg-olive', tile: 'bg-olive-50', text: 'text-olive' },
  go: { bar: 'bg-saffron', tile: 'bg-saffron-50', text: 'text-ink' },
  zco: { bar: 'bg-rosa', tile: 'bg-rosa-50', text: 'text-ink' },
  oy: { bar: 'bg-ink', tile: 'bg-cream-100', text: 'text-ink' },
};

/** The six forms of a family's first verb, with the ones that change picked out. */
function Boot({ family }: { family: Family }) {
  const v = family.verbs[0];
  const known = VERB_BY_INF[v.inf];
  const forms = [0, 1, 2, 3, 4, 5].map((p) => (family.where === 'boot' ? stemForm(v.inf, family.id as 'e-ie', p) : known?.present[p] ?? (p === 0 ? v.yo! : '')));
  const changes = (p: number) => (family.where === 'boot' ? BOOT.includes(p) : p === 0);
  return (
    <div className="grid grid-cols-2 gap-1 text-sm" aria-label={`${v.inf} in the present`}>
      {[0, 3, 1, 4, 2, 5].map((p) => forms[p] && (
        <span key={p} className={`flex items-baseline justify-between gap-2 rounded-lg px-2 py-1 ${changes(p) ? `${TONE[family.id].tile} font-semibold` : 'bg-cream-100 text-ink-soft'}`}>
          <span className="text-[11px] text-ink-mute">{PRONOUNS[p]}</span><span lang="es">{forms[p]}</span>
        </span>
      ))}
    </div>
  );
}

export function VerbFamilies({ onExit, vosotros = true }: { onExit: () => void; vosotros?: boolean }) {
  const [game, setGame] = useState<{ only?: FamilyId; round: number } | null>(null);
  if (game) return <FamilyGame key={game.round} only={game.only} vosotros={vosotros} onAgain={() => setGame({ only: game.only, round: game.round + 1 })} onExit={() => setGame(null)} />;
  return (
    <div data-testid="families">
      <button type="button" className="ctrl mb-4" onClick={onExit}><Icon name="arrowLeft" size={14} /> Verb gym</button>
      <section className="relative overflow-hidden rounded-4xl bg-ink p-6 text-cream shadow-lift sm:p-8">
        <div className="absolute -right-10 -top-12 h-52 w-52 rounded-full bg-olive/40 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1 basis-72">
            <p className="eyebrow !text-saffron-light">Familias de verbos</p>
            <h1 className="mt-1 font-display text-4xl font-semibold leading-tight">Verbs that change the same way</h1>
            <p className="mt-2 max-w-xl text-cream/80">Learn one and you know the family. Stem-changers change for yo, tú, él and ellos, and stay regular for nosotros and vosotros. Others only change for yo.</p>
          </div>
          <button type="button" className="inline-flex items-center gap-2 rounded-full bg-saffron px-6 py-3 font-bold text-ink shadow-lift transition hover:scale-[1.02]" onClick={() => setGame({ round: 0 })} data-testid="families-play"><Icon name="play" size={18} filled /> Play: all families</button>
        </div>
      </section>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {FAMILIES.map((f) => (
          <article key={f.id} className="relative flex flex-col overflow-hidden rounded-3xl bg-white p-5 pl-6 shadow-soft ring-1 ring-ink/5" data-testid={`family-${f.id}`}>
            <span className={`absolute inset-y-0 left-0 w-1.5 ${TONE[f.id].bar}`} aria-hidden />
            <div className="flex items-baseline justify-between gap-2">
              <h2 className={`font-display text-3xl font-semibold ${TONE[f.id].text}`} lang="es">{f.name}</h2>
              <span className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-semibold text-ink-soft">{f.where === 'boot' ? 'changes in the boot' : 'only yo changes'}</span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">{f.rule}.</p>
            <div className="mt-3"><Boot family={f} /></div>
            <p className="mt-3 text-xs text-ink-mute">{f.tip}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {f.verbs.map((v) => <span key={v.inf} className={`rounded-full px-2.5 py-1 text-sm ${TONE[f.id].tile}`} title={v.en} lang="es">{v.inf}</span>)}
            </div>
            <button type="button" className="btn-soft mt-4 self-start" onClick={() => setGame({ only: f.id, round: 0 })} data-testid={`family-play-${f.id}`}><Icon name="play" size={16} filled /> Practise this family</button>
          </article>
        ))}
      </div>
    </div>
  );
}

function FamilyGame({ only, vosotros, onAgain, onExit }: { only?: FamilyId; vosotros: boolean; onAgain: () => void; onExit: () => void }) {
  const { update } = useStore();
  const say = useSay();
  const questions = useMemo(() => familyRound(10, Math.random, only, vosotros), [only, vosotros]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [answer, setAnswer] = useState<{ ok: boolean; given: string } | null>(null);
  const [score, setScore] = useState<{ family: FamilyId; ok: boolean }[]>([]);
  const q = questions[i];

  const give = (qq: FamilyQuestion, ok: boolean, given: string) => {
    if (answer) return;
    setAnswer({ ok, given }); setScore((s) => [...s, { family: qq.family, ok }]);
    if (ok) sfx.correct(); else { sfx.wrong(); haptic([30, 30, 30]); }
    const known = VERB_BY_INF[qq.verb.inf];
    if (qq.kind !== 'sort' && known) {
      update((s) => recordAttempt(s, { key: verbKey(qq.verb.inf, 'present', qq.person), grade: ok ? 2 : 0, exerciseType: 'families', verb: qq.verb.inf, tense: 'present', mistake: ok ? undefined : { expected: qq.answer, given, category: 'irregular-verb', context: `Verb families · ${FAMILY_BY_ID[qq.family].name}` } }));
    } else update((s) => updateDay(s, (d) => ({ ...d, exercisesAttempted: d.exercisesAttempted + 1, exercisesCorrect: d.exercisesCorrect + (ok ? 1 : 0) })));
    if (qq.kind !== 'sort' && ok) void say(`${PRONOUNS[qq.person].split(' / ')[0]} ${qq.answer}`);
  };
  const next = () => { setAnswer(null); setTyped(''); if (i + 1 >= questions.length) confetti(); setI(i + 1); };

  if (!q) {
    const right = score.filter((s) => s.ok).length;
    const weak = FAMILIES.filter((f) => score.some((s) => s.family === f.id && !s.ok));
    return (
      <div className="mx-auto max-w-xl text-center" data-testid="families-done">
        <div className="card p-8">
          <p className="eyebrow">Familias de verbos</p>
          <p className="mt-2 font-display text-5xl font-semibold">{right} of {score.length}</p>
          <p className="mt-2 text-ink-soft">{weak.length === 0 ? 'Every family right. The patterns are sticking.' : <>Worth another look: {weak.map((f, k) => <b key={f.id} lang="es">{k ? ', ' : ''}{f.name}</b>)}.</>}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-primary" onClick={onAgain} data-testid="families-again"><Icon name="play" size={18} filled /> Play again</button>
            <button type="button" className="btn-ghost" onClick={onExit}>Back to the families</button>
          </div>
        </div>
      </div>
    );
  }
  const fam = FAMILY_BY_ID[q.family];
  return (
    <div className="mx-auto max-w-2xl" data-testid="families-game">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" className="ctrl !px-2" onClick={onExit} aria-label="Leave the game"><Icon name="x" size={18} /></button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-olive transition-all" style={{ width: `${((i + (answer ? 1 : 0)) / questions.length) * 100}%` }} /></div>
        <span className="text-sm tabular-nums text-ink-mute">{i + 1}/{questions.length}</span>
      </div>
      <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-white p-6 shadow-soft" data-kind={q.kind}>
        {q.kind === 'sort' && (
          <>
            <p className="eyebrow">Which family?</p>
            <p className="mt-2 font-display text-4xl font-semibold" lang="es">{q.verb.inf}</p>
            <p className="text-ink-mute">{q.verb.en}</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-3" role="group" aria-label="Choose the family">
              {q.options.map((o) => <button key={o} type="button" disabled={!!answer} onClick={() => give(q, o === q.family, FAMILY_BY_ID[o].name)} lang="es" className={`rounded-2xl px-4 py-4 text-xl font-semibold ring-1 transition ${answer ? (o === q.family ? 'bg-olive-50 ring-olive' : o === FAMILIES.find((f) => f.name === answer.given)?.id ? 'bg-terracotta-50 ring-terracotta' : 'opacity-50 ring-ink/10') : 'bg-white ring-ink/10 hover:ring-ink/40'}`} data-testid="family-option" data-right={o === q.family || undefined}>{FAMILY_BY_ID[o].name}</button>)}
            </div>
          </>
        )}
        {q.kind === 'same' && (
          <>
            <p className="eyebrow">Same family, same change · <span lang="es" className="normal-case">{fam.name}</span></p>
            <p className="mt-3 text-lg text-ink-soft"><span lang="es">{q.model.inf}</span> <Icon name="arrowRight" size={14} className="inline" /> <b lang="es" className="text-ink">{PRONOUNS[q.person].split(' / ')[0]} {q.model.form}</b></p>
            <p className="mt-2 font-display text-3xl font-semibold"><span lang="es">{q.verb.inf}</span> <Icon name="arrowRight" size={20} className="inline text-ink-mute" /> <span lang="es" className="text-ink-mute">{PRONOUNS[q.person].split(' / ')[0]}</span> <span className="inline-block min-w-[5ch] border-b-2 border-dashed border-terracotta">&nbsp;</span></p>
            <p className="text-ink-mute">{q.verb.en}</p>
            <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!answer && typed.trim()) give(q, checkAnswer(typed, [q.answer]) !== 'wrong', typed.trim()); }}>
              <input lang="es" aria-label="Your answer" className="input min-w-0 flex-1 text-lg" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!!answer} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus placeholder="Type the form" data-testid="family-typed" data-answer={q.answer} />
              <button type="submit" className="btn-primary" disabled={!!answer || !typed.trim()}>Check</button>
            </form>
          </>
        )}
        {q.kind === 'boot' && (
          <>
            <p className="eyebrow">Does it change here? · <span lang="es" className="normal-case">{fam.name}</span></p>
            <p className="mt-2 font-display text-3xl font-semibold"><span lang="es">{q.verb.inf}</span> <span className="text-ink-mute">·</span> <span lang="es" className="text-terracotta">{PRONOUNS[q.person]}</span></p>
            <p className="text-ink-mute">{q.verb.en}</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2" role="group" aria-label="Choose the form">
              {q.options.map((o) => <button key={o} type="button" disabled={!!answer} onClick={() => give(q, o === q.answer, o)} lang="es" className={`rounded-2xl px-4 py-4 text-xl font-semibold ring-1 transition ${answer ? (o === q.answer ? 'bg-olive-50 ring-olive' : o === answer.given ? 'bg-terracotta-50 ring-terracotta' : 'opacity-50 ring-ink/10') : 'bg-white ring-ink/10 hover:ring-ink/40'}`} data-testid="family-option" data-right={o === q.answer || undefined}>{o}</button>)}
            </div>
          </>
        )}
      </motion.div>
      {answer && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 rounded-3xl p-5 ${answer.ok ? 'bg-olive-50' : 'bg-terracotta-50'}`} role="status" data-testid="family-feedback">
          <p className="font-semibold">{answer.ok ? '¡Eso es!' : 'Not quite.'} {q.kind === 'sort'
            ? <><span lang="es">{q.verb.inf}</span> is in the <b lang="es">{fam.name}</b> family{fam.where === 'boot' ? <>: <span lang="es">{stemForm(q.verb.inf, fam.id as 'e-ie', 0)}</span></> : <>: <span lang="es">{q.verb.yo}</span></>}.</>
            : q.kind === 'same' ? <>It is <b lang="es">{q.answer}</b>, the same change as <span lang="es">{q.model.form}</span>.</>
            : <><b lang="es">{q.answer}</b>. {BOOT.includes(q.person) ? 'Inside the boot, so it changes.' : 'Nosotros and vosotros stay regular: no change.'}</>}</p>
          <p className="mt-1 text-sm text-ink-soft">{fam.tip}</p>
          <button type="button" className="btn-dark mt-3" onClick={next} autoFocus data-testid="family-next">{i + 1 < questions.length ? 'Next' : 'See my score'} <Icon name="arrowRight" size={16} /></button>
        </motion.div>
      )}
    </div>
  );
}
