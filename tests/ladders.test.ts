import { describe, expect, it } from 'vitest';
import { LADDERS, SENTENCE_STEPS, parseRung, sentenceLevelFor } from '../src/data/ladders';
import { VERB_BY_INF } from '../src/data/verbs';
import { GRAMMAR_DRILLS } from '../src/data/grammar';
import { buildSession } from '../src/lib/exercises';
import { defaultState } from '../src/lib/state';

const state = { ...defaultState(), profile: { ...(defaultState().profile ?? {}), region: 'spain', activities: [] } } as never;
const squash = (s: string) => s.toLowerCase().replace(/[.,;]/g, '').replace(/\s+/g, ' ').trim();

describe('growing sentences', () => {
  it('every ladder has five steps, a known verb and one part to add at each step', () => {
    for (const l of LADDERS) {
      expect(VERB_BY_INF[l.verb], l.id).toBeTruthy();
      expect(l.rungs, l.id).toHaveLength(SENTENCE_STEPS.length);
      for (const r of l.rungs) { expect(r.es.match(/\[/g), r.es).toHaveLength(1); expect(parseRung(r).add.length).toBeGreaterThan(0); expect(r.en.length).toBeGreaterThan(3); }
    }
  });
  it('each step is the sentence so far with only the new part added', () => {
    for (const l of LADDERS) for (let k = 1; k < l.rungs.length; k++) {
      const pr = parseRung(l.rungs[k]);
      expect(squash(pr.before + ' ' + pr.after), `${l.id} step ${k + 1}`).toBe(squash(parseRung(l.rungs[k - 1]).plain));
      expect(pr.plain.length).toBeGreaterThan(parseRung(l.rungs[k - 1]).plain.length);
    }
  });
  it('a session ends with one growing sentence, as many steps as the sentence level', () => {
    for (const sentence of [1, 3, 5]) {
      const ex = buildSession({ state, tense: 'present', sentence, rng: () => 0.3 });
      const grow = ex.filter((e) => e.kind === 'extend');
      expect(grow).toHaveLength(sentence);
      expect(grow.map((e) => (e.kind === 'extend' ? e.rung : -1))).toEqual([...Array(sentence).keys()]);
      expect(ex.slice(-sentence).every((e) => e.kind === 'extend')).toBe(true);
      expect(ex.length).toBe(12 + sentence);
    }
    expect(buildSession({ state, tense: 'pluperfect', sentence: 5, rng: () => 0.3 }).some((e) => e.kind === 'extend')).toBe(false);
  });
  it('the starting sentence level follows the CEFR level', () => {
    expect([null, 'A1', 'A2', 'B1', 'B2', 'C1'].map((l) => sentenceLevelFor(l as never))).toEqual([2, 2, 3, 4, 5, 5]);
  });
  it('grammar drills use shorter sentences at the lower sentence levels', () => {
    const words = (e: { kind: string; item?: { before: string; after: string } }) => (e.item ? `${e.item.before} ${e.item.after}`.trim().split(/\s+/).length + 1 : 0);
    for (const mode of Object.keys(GRAMMAR_DRILLS) as (keyof typeof GRAMMAR_DRILLS)[]) {
      const avg = (sentence: number) => { const ex = buildSession({ state, tense: 'present', mode, length: 8, sentence, rng: () => 0.5 }); expect(ex.length).toBeGreaterThan(0); return ex.reduce((n, e) => n + words(e as never), 0) / ex.length; };
      expect(avg(1), mode).toBeLessThanOrEqual(avg(5) + 0.001);
    }
  });
});
