import { describe, expect, it } from 'vitest';
import { TENSES, VERBS, VERB_BY_INF, conjugate, parseExample, setActiveVariety } from '../src/data/verbs';
import { buildSession, cardKeyFor } from '../src/lib/exercises';
import { defaultState } from '../src/lib/state';

// Builds thousands of sessions (every tense, every verb, three varieties) and checks that no exercise is broken:
// a full 12 questions, an answer that exists, options that differ, and match tiles that are never identical.
describe('verb sessions', () => {
  it('are always full and every exercise can be answered', () => {
    const issues = new Map<string, number>(); const add = (k: string) => issues.set(k, (issues.get(k) ?? 0) + 1);
    for (const region of ['spain', 'mexico', 'argentina'] as const) {
      setActiveVariety(region);
      const state = { ...defaultState(), profile: { ...(defaultState().profile ?? {}), region, activities: [] } } as never;
      for (const t of TENSES) for (const focus of [undefined, ...VERBS.map((v) => [v.inf])]) for (let n = 0; n < (focus ? 2 : 30); n++) {
        let s; try { s = buildSession({ state, tense: t.id, focus }); } catch (e) { add(`CRASH build ${t.id} ${focus} ${(e as Error).message}`); continue; }
        // Twelve questions, then the steps of one growing sentence where the tense has one.
        const grow = s.filter((e) => e.kind === 'extend').length;
        if (s.length - grow !== 12) add(`session of ${s.length - grow} in ${t.id}`);
        if (grow > 5) add(`too many sentence steps in ${t.id}`);
        for (const ex of s) {
          try {
            cardKeyFor(ex);
            if (ex.kind === 'type' || ex.kind === 'choice' || ex.kind === 'listen') {
              const a = conjugate(VERB_BY_INF[ex.verb], ex.tense, ex.person);
              if (!a) add(`empty answer ${ex.verb} ${ex.tense}`);
              if (ex.options && (new Set(ex.options).size !== ex.options.length || ex.options.length < 2 || ex.options.includes(''))) add(`bad options ${ex.tense}`);
              if (ex.options && !ex.options.includes(a)) add(`answer missing ${ex.tense}`);
              if (!ex.pronoun) add('no pronoun');
            } else if (ex.kind === 'match') {
              const f = ex.persons.map((p) => conjugate(VERB_BY_INF[ex.verb], ex.tense, p));
              if (f.some((x) => !x)) add(`match empty ${ex.tense} ${ex.verb}`);
              if (new Set(f).size !== f.length) add(`match duplicate forms ${ex.tense}`);
              if (ex.persons.length < 2) add('match tiny');
            } else if (ex.kind === 'context' || ex.kind === 'build' || ex.kind === 'fix' || ex.kind === 'translate') {
              const pe = parseExample(ex.example); if (!pe.answer) add(`example no gap ${ex.verb}`);
              if ((ex.kind === 'fix' || ex.kind === 'translate') && (new Set(ex.options).size !== ex.options.length || ex.options.length < 2)) add(`bad ${ex.kind} options ${ex.verb}`);
              if (ex.kind === 'fix' && (!ex.wrong || !ex.options.includes(VERB_BY_INF[ex.verb].present[ex.example.person]))) add(`fix broken ${ex.verb}`);
              if (ex.kind === 'fix' && VERB_BY_INF[ex.verb].present[ex.example.person].toLowerCase() !== pe.answer.toLowerCase()) add(`fix: example form is not the present form ${ex.verb} "${pe.answer}"`);
              if (ex.kind === 'fix' && [ex.wrong, ...ex.options].some((f) => !VERB_BY_INF[ex.verb].present.includes(f))) add(`fix: the mistake or an option is not a real form of ${ex.verb}: ${[ex.wrong, ...ex.options].join(', ')}`);
            }
          } catch (e) { add(`CRASH ${ex.kind} ${(e as Error).message}`); }
        }
      }
    }
    expect([...issues.entries()].map(([k, v]) => `${v}x ${k}`)).toEqual([]);
    setActiveVariety('spain');
  });
});
