import { useT } from '../lib/i18n';
import { useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { TENSES, VERB_BY_INF, conjugate, personShort, type Tense, type Verb } from '../data/verbs';
import { useSay } from '../hooks/useSpeech';
import { CATEGORY_LABEL, checkAnswer, classifyVerbError } from '../lib/answer';
import { personsWithForm, pickVerbs } from '../lib/exercises';
import { confetti, sfx } from '../lib/fx';
import { useHomeworkCompletion } from '../lib/platform/homework';
import { completeLesson, recordAttempt } from '../lib/state';
import { strength } from '../lib/srs';
import { useStore } from '../lib/store';
import { verbKey } from '../data/verbs';
import type { AppState, Cefr, ErrorCategory, Region } from '../types';

const ACCENTS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü'];

/** How a verb behaves, in a word, for the column heading: the hint that ties the table together. */
export function verbKind(v: Verb): { label: string; tone: 'regular' | 'change' | 'irregular'; hint: string } {
  const end = v.inf.replace(/se$/, '').slice(-2);
  switch (v.group) {
    case 'regular': return { label: `Regular -${end}`, tone: 'regular', hint: `Follows the normal -${end} pattern.` };
    case 'stem-e-ie': return { label: 'Stem e → ie', tone: 'change', hint: 'The e becomes ie, except for nosotros and vosotros.' };
    case 'stem-o-ue': return { label: 'Stem o → ue', tone: 'change', hint: 'The o becomes ue, except for nosotros and vosotros.' };
    case 'stem-e-i': return { label: 'Stem e → i', tone: 'change', hint: 'The e becomes i, except for nosotros and vosotros.' };
    case 'stem-u-ue': return { label: 'Stem u → ue', tone: 'change', hint: 'The u becomes ue, except for nosotros and vosotros.' };
    case 'irregular-yo': return { label: 'Irregular “yo”', tone: 'irregular', hint: 'Only the “yo” form is irregular; the rest is normal.' };
    default: return { label: 'Irregular', tone: 'irregular', hint: 'Does not follow the pattern: learn these forms as they are.' };
  }
}
const TONE = { regular: 'bg-olive-50 text-olive ring-olive/30', change: 'bg-saffron-50 text-ink ring-saffron/50', irregular: 'bg-terracotta-50 text-terracotta-dark ring-terracotta/30' } as const;

/** Verbs for a grid: a mix of regular and irregular where the learner's pool allows it, so the patterns can be compared. */
export function gridVerbs(state: AppState, tense: Tense, count: number, focus: string[] | undefined, maxLevel: Cefr | null, allowed: Set<string> | null, region: Region): string[] {
  const usable = (list: string[]) => list.filter((v) => VERB_BY_INF[v] && personsWithForm(VERB_BY_INF[v], tense, region).length >= 3);
  const chosen = usable(focus ?? []).slice(0, count);
  if (chosen.length >= count) return chosen;
  const pool = usable(pickVerbs(state, tense, 40, Date.now(), maxLevel, allowed)).filter((v) => !chosen.includes(v));
  const regular = pool.filter((v) => VERB_BY_INF[v].group === 'regular'), other = pool.filter((v) => VERB_BY_INF[v].group !== 'regular');
  const out = [...chosen];
  // Alternate irregular and regular, so every grid has both kinds side by side.
  for (let i = 0; out.length < count && (regular.length || other.length); i++) {
    const from = (i % 2 === 0 ? other : regular).length ? (i % 2 === 0 ? other : regular) : (i % 2 === 0 ? regular : other);
    out.push(from.shift()!);
  }
  return out;
}

type Mark = 'right' | 'accent' | 'wrong';
interface Cell { verb: string; person: number; answer: string; blank: boolean }

/**
 * The grid drill: several verbs side by side, one row per person. The forms the learner is unsure of are left
 * blank; they fill them all in and check the whole table at once. Each column says what the verb means and
 * whether it is regular, so the patterns can be seen across verbs.
 */
export function VerbGrid({ tense, focus, maxLevel, allowed, onExit }: { tense: Tense; focus?: string[]; maxLevel: Cefr | null; allowed: Set<string> | null; onExit: () => void }) {
  const { state, update } = useStore();
  const say = useSay();
  const hw = useHomeworkCompletion();
  const region: Region = state.profile?.region ?? 'spain';
  const { t, stage } = useT();
  // Three verbs fit a phone without scrolling sideways; wider screens start with four.
  const [count, setCount] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 480 ? 3 : 4));
  const [mode, setMode] = useState<'weak' | 'all'>('weak');
  const [round, setRound] = useState(0);
  const [only, setOnly] = useState<Set<string> | null>(null); // "try the ones I missed": just these cells are blank
  const [values, setValues] = useState<Record<string, string>>({});
  const [marks, setMarks] = useState<Record<string, Mark> | null>(null);
  const lastFocus = useRef<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const verbs = useMemo(() => gridVerbs(state, tense, count, focus, maxLevel, allowed, region).map((v) => VERB_BY_INF[v]), [tense, count, round, region]); // eslint-disable-line react-hooks/exhaustive-deps
  const persons = useMemo(() => [...new Set(verbs.flatMap((v) => personsWithForm(v, tense, region)))].sort((a, b) => a - b), [verbs, tense, region]);
  const cells = useMemo(() => {
    const all: Cell[] = verbs.flatMap((v) => persons.map((p) => ({ verb: v.inf, person: p, answer: conjugate(v, tense, p), blank: false })).filter((c) => c.answer));
    const id = (c: Cell) => `${c.verb}|${c.person}`;
    if (only) return all.map((c) => ({ ...c, blank: only.has(id(c)) }));
    if (mode === 'all') return all.map((c) => ({ ...c, blank: true }));
    // Weak spots: forms never tried or not yet secure are blank. Always at least half the table, at least two per verb.
    const weak = new Set(all.filter((c) => strength(state.srs[verbKey(c.verb, tense, c.person)]) < 0.6).map(id));
    for (const v of verbs) {
      const mine = all.filter((c) => c.verb === v.inf);
      const ranked = [...mine].sort((a, b) => strength(state.srs[verbKey(a.verb, tense, a.person)]) - strength(state.srs[verbKey(b.verb, tense, b.person)]));
      for (const c of ranked) { if (mine.filter((m) => weak.has(id(m))).length >= Math.max(2, Math.ceil(mine.length / 2))) break; weak.add(id(c)); }
    }
    return all.map((c) => ({ ...c, blank: weak.has(id(c)) }));
  }, [verbs, persons, mode, only, tense]); // eslint-disable-line react-hooks/exhaustive-deps
  const cellAt = (v: string, p: number) => cells.find((c) => c.verb === v && c.person === p);
  const blanks = cells.filter((c) => c.blank);
  const order = persons.flatMap((p) => verbs.map((v) => `${v.inf}|${p}`)).filter((k) => blanks.some((c) => `${c.verb}|${c.person}` === k));
  const filled = blanks.filter((c) => (values[`${c.verb}|${c.person}`] ?? '').trim()).length;
  const tenseLabel = TENSES.find((t) => t.id === tense)?.label ?? tense;

  const reset = (next: { only?: Set<string> | null; newVerbs?: boolean }) => { setValues({}); setMarks(null); setOnly(next.only ?? null); if (next.newVerbs) setRound((r) => r + 1); };
  const insert = (ch: string) => {
    const k = lastFocus.current ?? order.find((o) => !(values[o] ?? '').trim());
    if (!k || marks) return;
    const el = inputs.current[k]; const cur = values[k] ?? '';
    const s = el?.selectionStart ?? cur.length, e = el?.selectionEnd ?? cur.length;
    setValues((v) => ({ ...v, [k]: cur.slice(0, s) + ch + cur.slice(e) }));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(s + 1, s + 1); });
  };
  const nextBlank = (k: string) => { const i = order.indexOf(k); const n = order.slice(i + 1).concat(order.slice(0, i)).find((o) => !(values[o] ?? '').trim()) ?? order[i + 1]; if (n) inputs.current[n]?.focus(); };

  const check = () => {
    const result: Record<string, Mark> = {};
    const attempts: { key: string; verb: string; grade: 0 | 1 | 2; mistake?: { expected: string; given: string; category: ErrorCategory; context: string } }[] = [];
    for (const c of blanks) {
      const k = `${c.verb}|${c.person}`, given = (values[k] ?? '').trim();
      const r = checkAnswer(given, [c.answer]);
      result[k] = r === 'correct' ? 'right' : r === 'accent' ? 'accent' : 'wrong';
      const category: ErrorCategory = r === 'accent' ? 'accents' : given ? classifyVerbError(VERB_BY_INF[c.verb], tense, c.person, given) : 'other';
      attempts.push({ key: verbKey(c.verb, tense, c.person), verb: c.verb, grade: r === 'correct' ? 2 : r === 'accent' ? 1 : 0, mistake: r === 'correct' ? undefined : { expected: c.answer, given, category, context: `Grid drill · ${c.verb}` } });
    }
    // One save for the whole table.
    update((s) => completeLesson(attempts.reduce((acc, a) => recordAttempt(acc, { key: a.key, grade: a.grade, exerciseType: 'grid', verb: a.verb, tense, mistake: a.mistake }), s)));
    setMarks(result);
    const good = Object.values(result).filter((m) => m !== 'wrong').length;
    hw.log('practice', `Verb grid: ${good}/${blanks.length} correct (${tenseLabel.toLowerCase()}: ${verbs.map((v) => v.inf).join(', ')})`);
    if (good === blanks.length) { sfx.win(); confetti({ count: 100 }); } else if (good / blanks.length >= 0.7) sfx.correct(); else sfx.wrong();
  };

  const wrong = marks ? blanks.filter((c) => marks[`${c.verb}|${c.person}`] === 'wrong') : [];
  const good = marks ? blanks.length - wrong.length : 0;
  const slips = new Map<ErrorCategory, number>();
  if (marks) for (const c of wrong) { const g = (values[`${c.verb}|${c.person}`] ?? '').trim(); if (g) { const cat = classifyVerbError(VERB_BY_INF[c.verb], tense, c.person, g); slips.set(cat, (slips.get(cat) ?? 0) + 1); } }
  const kinds = [...new Set(verbs.map((v) => verbKind(v).tone))];

  if (!verbs.length) return (
    <div className="mx-auto max-w-xl"><div className="card p-6 text-center"><h2 className="text-2xl font-semibold">No verbs for this tense yet</h2><p className="mt-2 text-ink-soft">Pick another tense or choose some verbs first.</p><button className="btn-primary mt-4" onClick={onExit}>Back to the verb gym</button></div></div>
  );

  return (
    <div className="mx-auto max-w-4xl" data-testid="verb-grid">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button className="ctrl !px-2" onClick={onExit} aria-label="Back to the verb gym"><Icon name="arrowLeft" size={18} /></button>
        <div className="min-w-0 flex-1"><p className="eyebrow">Tabla de verbos · Grid drill</p><h1 className="font-display text-2xl font-semibold leading-tight">{stage >= 2 ? `${TENSES.find((x) => x.id === tense)?.es}: rellena la tabla` : `${tenseLabel}: fill in the table`}</h1></div>
      </div>

      {!marks && !only && (
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="flex items-center gap-1.5"><span className="text-ink-mute">{t('Verbs')}</span>{[3, 4, 5].map((n) => <button key={n} className="chip !px-3 !py-1" aria-pressed={count === n} onClick={() => { setCount(n); setValues({}); }} data-testid={`grid-count-${n}`}>{n}</button>)}</span>
          <span className="flex items-center gap-1.5"><span className="text-ink-mute">{t('Blanks')}</span><button className="chip !py-1" aria-pressed={mode === 'weak'} onClick={() => { setMode('weak'); setValues({}); }}>{t('My weak spots')}</button><button className="chip !py-1" aria-pressed={mode === 'all'} onClick={() => { setMode('all'); setValues({}); }} data-testid="grid-all">{t('Everything')}</button></span>
          {!focus?.length && <button className="ctrl" onClick={() => reset({ newVerbs: true })}><Icon name="refresh" size={14} /> {t('Other verbs')}</button>}
        </div>
      )}

      {/* The hint at the top: which verbs follow the pattern and which do not. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl bg-white px-4 py-2.5 text-sm ring-1 ring-ink/5" data-testid="grid-legend">
        {kinds.includes('regular') && <span className="flex items-center gap-1.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${TONE.regular}`}>{t('Regular')}</span><span className="text-ink-soft">{t('follows the pattern')}</span></span>}
        {kinds.includes('change') && <span className="flex items-center gap-1.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${TONE.change}`}>{t('Stem change')}</span><span className="text-ink-soft">{t('the vowel changes, not for nosotros or vosotros')}</span></span>}
        {kinds.includes('irregular') && <span className="flex items-center gap-1.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${TONE.irregular}`}>{t('Irregular')}</span><span className="text-ink-soft">{t('has its own forms')}</span></span>}
      </div>

      {count > 3 && <p className="mb-1 text-xs text-ink-mute sm:hidden">{t('Slide the table sideways to see every verb.')}</p>}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <table className="w-full border-separate border-spacing-x-1 border-spacing-y-1.5 sm:border-spacing-x-1.5">
          <thead>
            <tr>
              <th className="w-[3.6rem] sm:w-28" />
              {verbs.map((v) => { const k = verbKind(v); return (
                <th key={v.inf} scope="col" className="min-w-[5.9rem] rounded-2xl bg-white p-2 text-left align-top font-normal ring-1 ring-ink/5" title={k.hint}>
                  <span className="block font-display text-xl font-semibold leading-tight" lang="es">{v.inf}</span>
                  <span className="block text-xs leading-snug text-ink-soft">{v.en.split(' (')[0]}</span>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${TONE[k.tone]}`} data-testid={`grid-kind-${v.inf}`}>{k.label}</span>
                </th>
              ); })}
            </tr>
          </thead>
          <tbody>
            {persons.map((p) => (
              <tr key={p}>
                <th scope="row" className="pr-0.5 text-right text-xs font-medium text-ink-mute sm:text-sm" lang="es">{personShort(p)}</th>
                {verbs.map((v) => {
                  const c = cellAt(v.inf, p); const k = `${v.inf}|${p}`;
                  if (!c) return <td key={k} className="rounded-xl bg-cream-100 text-center text-ink-mute">–</td>;
                  if (!c.blank) return <td key={k}><button type="button" className="w-full rounded-xl bg-cream-100 px-2 py-2.5 text-left text-[15px] text-ink-soft" onClick={() => void say(c.answer)} lang="es">{c.answer}</button></td>;
                  const m = marks?.[k];
                  return (
                    <td key={k} className="align-top">
                      {marks ? (
                        <button type="button" onClick={() => void say(c.answer)} className={`w-full rounded-xl px-2 py-2 text-left text-[15px] ring-2 ${m === 'right' ? 'bg-olive-50 ring-olive/50' : m === 'accent' ? 'bg-saffron-50 ring-saffron' : 'bg-terracotta-50 ring-terracotta/60'}`} data-mark={m} lang="es">
                          {m === 'wrong' ? <><span className="block text-ink-mute line-through decoration-1">{(values[k] ?? '').trim() || '—'}</span><b>{c.answer}</b></> : m === 'accent' ? <><b>{c.answer}</b><span className="block text-[11px] text-ink-soft">watch the accent</span></> : <b>{c.answer}</b>}
                        </button>
                      ) : (
                        <input ref={(el) => { inputs.current[k] = el; }} value={values[k] ?? ''} onChange={(e) => setValues((x) => ({ ...x, [k]: e.target.value }))} onFocus={() => { lastFocus.current = k; }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); nextBlank(k); } }} enterKeyHint="next"
                          className="w-full min-w-0 rounded-xl bg-white px-2 py-2.5 text-base ring-2 ring-ink/10 placeholder:text-ink-mute/50 focus:outline-none focus:ring-terracotta" autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} lang="es"
                          aria-label={`${personShort(p)} ${v.inf}`} data-testid={`grid-cell-${v.inf}-${p}`} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!marks ? (
        <div className="sticky bottom-20 z-10 mt-3 rounded-3xl bg-cream/95 p-3 shadow-lift ring-1 ring-ink/10 backdrop-blur lg:bottom-4">
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Insert accented letter">
            {ACCENTS.map((ch) => <button key={ch} type="button" className="h-9 w-9 rounded-xl bg-white text-lg ring-1 ring-ink/10" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(ch)}>{ch}</button>)}
            <span className="ml-auto text-sm tabular-nums text-ink-mute">{filled}/{blanks.length} {t('filled')}</span>
            <button type="button" className="btn-primary !py-2.5" disabled={filled === 0} onClick={check} data-testid="grid-check">{t('Check the table')}</button>
          </div>
        </div>
      ) : (
        <div className={`mt-4 rounded-3xl p-5 ring-1 ${wrong.length ? 'bg-saffron-50 ring-saffron/40' : 'bg-olive-50 ring-olive/30'}`} role="status" data-testid="grid-result">
          <p className="font-display text-2xl font-semibold">{wrong.length === 0 ? '¡Perfecto! ' : good / blanks.length >= 0.7 ? '¡Muy bien! ' : 'Buen trabajo. '}{good} of {blanks.length} right</p>
          {wrong.length > 0 && <p className="mt-1 text-ink-soft">The right form is shown under each one you missed. Tap any cell to hear it.</p>}
          {slips.size > 0 && <ul className="mt-2 grid gap-1 text-sm text-ink-soft">{[...slips.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([cat, n]) => <li key={cat}><b className="text-ink">{CATEGORY_LABEL[cat]}</b> ×{n}</li>)}</ul>}
          <div className="mt-4 flex flex-wrap gap-2">
            {wrong.length > 0 && <button className="btn-primary" onClick={() => reset({ only: new Set(wrong.map((c) => `${c.verb}|${c.person}`)) })} data-testid="grid-retry"><Icon name="refresh" size={18} /> {t('Try the ones I missed')}</button>}
            <button className={wrong.length ? 'btn-ghost' : 'btn-primary'} onClick={() => reset({ newVerbs: !focus?.length })} data-testid="grid-again"><Icon name="play" size={18} filled /> {t(focus?.length ? 'Same verbs again' : 'New grid')}</button>
            <button className="btn-ghost" onClick={onExit}>{t('Verb gym')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
