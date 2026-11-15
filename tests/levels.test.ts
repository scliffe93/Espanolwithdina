import { describe, expect, it } from 'vitest';
import { TENSES, VERBS, verbKey } from '../src/data/verbs';
import { stageFor, translate } from '../src/lib/i18n';
import { levelReadiness, shouldSuggest } from '../src/lib/levelUp';
import { nextLevel, overallLevel } from '../src/lib/platform/level';
import { defaultState, emptyDay } from '../src/lib/state';
import { GAMES } from '../src/screens/games/registry';
import { tenseForLevel } from '../src/screens/games/level';
import type { AppState, SrsCard } from '../src/types';

// Levels: which games open when, when the app suggests moving up, and how much of the app is in Spanish.
const NOW = Date.UTC(2026, 10, 16, 12);
const DAY = 86_400_000;
const date = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const card = (key: string, good = true): SrsCard => ({ key, attempts: 10, correct: good ? 9 : 5, reps: 4, intervalDays: 10, ease: 2.5, due: NOW + DAY, lastAt: NOW } as unknown as SrsCard);

/** A learner who has done everything A1 asks for. */
function readyAtA1(): AppState {
  const s = defaultState();
  for (let i = 0; i < 12; i++) { const k = date(NOW - i * 2 * DAY); s.days[k] = { ...emptyDay(k), activeSeconds: 900, exercisesAttempted: 20, exercisesCorrect: 18 }; }
  for (const v of VERBS.slice(0, 16)) for (let p = 0; p < 6; p++) s.srs[verbKey(v.inf, 'present', p)] = card(verbKey(v.inf, 'present', p));
  for (let i = 0; i < 45; i++) s.srs[`vocab:w${i}`] = card(`vocab:w${i}`);
  return s;
}

describe('moving up a level', () => {
  it('needs every sign before it suggests anything', () => {
    const blank = levelReadiness(defaultState(), 'A1', NOW);
    expect(blank.ready).toBe(false);
    expect(blank.next).toBe('A2');
    expect(blank.checks.map((c) => c.id)).toEqual(['tenses', 'verbs', 'words', 'accuracy', 'regular']);
    const r = levelReadiness(readyAtA1(), 'A1', NOW);
    expect(r.checks.filter((c) => !c.met).map((c) => `${c.id}: ${c.detail}`)).toEqual([]);
    expect(r.ready).toBe(true);
    expect(r.summary).toBe('Everything points to being ready for A2.');
  });

  it('says what is still missing, in words', () => {
    const s = readyAtA1();
    for (const k of Object.keys(s.srs)) if (k.startsWith('vocab:')) delete s.srs[k];
    const r = levelReadiness(s, 'A1', NOW);
    expect(r.ready).toBe(false);
    expect(r.met).toBe(4);
    expect(r.summary).toBe('4 of 5 signs of being ready for A2. Still to do: 40 words remembered.');
  });

  it('judges the level the learner is at: ready for A2 is not ready for B1', () => {
    const r = levelReadiness(readyAtA1(), 'A2', NOW);
    expect(r.next).toBe('B1');
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.id === 'tenses')!.detail).toMatch(/not started/);
  });

  it('respects the teacher’s "not yet" for three weeks, and stops at the top', () => {
    const r = levelReadiness(readyAtA1(), 'A1', NOW);
    expect(shouldSuggest(r, undefined, NOW)).toBe(true);
    expect(shouldSuggest(r, { level: 'A1', at: new Date(NOW - 5 * DAY).toISOString() }, NOW)).toBe(false);
    expect(shouldSuggest(r, { level: 'A1', at: new Date(NOW - 30 * DAY).toISOString() }, NOW)).toBe(true);
    expect(levelReadiness(readyAtA1(), 'C2', NOW).ready).toBe(false);
    expect(nextLevel('C2')).toBeNull();
    expect(overallLevel({ a: 'A1', b: 'A2', c: 'B1' })).toBe('A2');
  });
});

describe('games by level', () => {
  it('every level opens at least one more game, and beginners have plenty', () => {
    const at = (l: string) => GAMES.filter((g) => g.minLevel === l).map((g) => g.id);
    expect(at('A1').length).toBeGreaterThanOrEqual(6);
    for (const l of ['A2', 'B1', 'B2']) expect(at(l).length, l).toBeGreaterThanOrEqual(1);
  });

  it('verb games bring in the tenses of the learner’s level and never one above it', () => {
    const seen = (level: 'A1' | 'A2' | 'B1' | 'B2') => { const out = new Set<string>(); let x = 7; const rng = () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; for (let i = 0; i < 600; i++) out.add(tenseForLevel(level, rng)); return out; };
    expect([...seen('A1')]).toEqual(['present']);
    const a2 = seen('A2');
    expect(a2.has('preterite') && a2.has('present')).toBe(true);
    for (const t of a2) expect(['A1', 'A2']).toContain(TENSES.find((x) => x.id === t)!.minLevel);
    expect(seen('B1').has('subjunctive')).toBe(true);
    expect(seen('B1').has('imperfect-subjunctive')).toBe(false);
    expect(seen('B2').has('imperfect-subjunctive')).toBe(true);
  });
});

describe('less English as the level rises', () => {
  it('moves the app’s own words into Spanish in stages', () => {
    expect([stageFor('A1'), stageFor('A2'), stageFor('B1'), stageFor('B2'), stageFor('C1')]).toEqual([0, 1, 2, 3, 3]);
    expect(translate('Continue', 0)).toBe('Continue');
    expect(translate('Continue', 1)).toBe('Continuar');
    expect(translate('Check the table', 1)).toBe('Check the table');
    expect(translate('Check the table', 2)).toBe('Comprobar la tabla');
    expect(translate('Which form do you hear?', 2)).toBe('Which form do you hear?');
    expect(translate('Which form do you hear?', 3)).toBe('¿Qué forma oyes?');
    expect(translate('Something with no translation', 3)).toBe('Something with no translation');
  });
  it('lets the learner overrule it', () => {
    expect(stageFor('B2', 'en')).toBe(0);
    expect(stageFor('A1', 'all')).toBe(3);
    expect(stageFor('A1', 'some')).toBe(1);
  });
});
