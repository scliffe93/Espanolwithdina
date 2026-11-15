import { describe, expect, it } from 'vitest';
import { focusAreas, lessonPrep } from '../src/lib/focus';
import { defaultState, emptyDay } from '../src/lib/state';
import type { AppState, MistakeRecord } from '../src/types';

// "What to concentrate on": a learner's results become plain sentences with their own mistakes in them.
const NOW = Date.UTC(2026, 10, 16, 12);
const DAY = 86_400_000;
const date = (ms: number) => new Date(ms).toISOString().slice(0, 10);
function withMistakes(list: (Omit<MistakeRecord, 'at' | 'key'> & { daysAgo: number })[], studyDays = 8): AppState {
  const s = defaultState();
  for (let i = 0; i < studyDays; i++) { const k = date(NOW - i * DAY); s.days[k] = { ...emptyDay(k), activeSeconds: 600, speakingAttempts: 1 }; }
  for (const m of list) {
    const at = NOW - m.daysAgo * DAY, k = date(at);
    s.days[k] ??= { ...emptyDay(k), activeSeconds: 600 };
    s.days[k].mistakes.push({ at, key: 'k', expected: m.expected, given: m.given, category: m.category, context: m.context });
  }
  return s;
}

describe('what to concentrate on', () => {
  it('says nothing until there is something to say', () => {
    expect(focusAreas(defaultState(), NOW)).toEqual([]);
    expect(lessonPrep([])).toBe('');
  });

  it('explains the commonest kind of mistake with the learner’s own answers', () => {
    const s = withMistakes([
      { daysAgo: 1, category: 'stem-change', expected: 'quiero', given: 'quero', context: 'Conjugate · querer' },
      { daysAgo: 2, category: 'stem-change', expected: 'puedes', given: 'podes', context: 'Conjugate · poder' },
      { daysAgo: 3, category: 'stem-change', expected: 'pido', given: 'pedo', context: 'Conjugate · pedir' },
      { daysAgo: 3, category: 'accents', expected: 'habló', given: 'hablo', context: 'Conjugate · hablar' },
      { daysAgo: 4, category: 'accents', expected: 'comí', given: 'comi', context: 'Conjugate · comer' },
    ]);
    const areas = focusAreas(s, NOW);
    expect(areas.map((a) => a.id)).toEqual(['err-stem-change', 'err-accents']);
    const stem = areas[0];
    expect(stem.title).toBe('Stem-changing verbs');
    expect(stem.summary).toBe('This came up 3 times in the last four weeks. It shows most with querer, poder, pedir.');
    expect(stem.examples).toContainEqual({ wrong: 'quero', right: 'quiero', note: 'querer' });
    expect(stem.explain).toMatch(/nosotros/);
    expect(stem.steps.length).toBeGreaterThanOrEqual(3);
    expect(stem.ask).toMatch(/Dina/);
    expect(stem.practise?.href).toBe('verbs?focus=querer,poder,pedir&start=1');
    expect(lessonPrep(areas)).toBe('Going into your next lesson, the things to mention are stem-changing verbs and written accents. Open each one below to see what is happening and what to do about it.');
  });

  it('notices when something is getting better', () => {
    const before = Array.from({ length: 8 }, (_, i) => ({ daysAgo: 30 + i, category: 'person-agreement' as const, expected: 'hablas', given: 'hablo', context: 'Conjugate · hablar' }));
    const s = withMistakes([...before, { daysAgo: 1, category: 'person-agreement', expected: 'hablas', given: 'hablo', context: 'Conjugate · hablar' }, { daysAgo: 2, category: 'person-agreement', expected: 'comen', given: 'come', context: 'Conjugate · comer' }]);
    const a = focusAreas(s, NOW)[0];
    expect(a.trend).toBe('better');
    expect(a.summary).toMatch(/down from 8 the month before, so it is improving/);
  });

  it('points out too little practice, and every area is complete', () => {
    const s = withMistakes([], 2);
    const areas = focusAreas(s, NOW);
    expect(areas.map((a) => a.id)).toContain('habit-regular');
    for (const a of areas) { expect(a.summary.length).toBeGreaterThan(20); expect(a.explain.length).toBeGreaterThan(60); expect(a.steps.length).toBeGreaterThanOrEqual(3); expect(a.ask.length).toBeGreaterThan(20); }
  });
});
