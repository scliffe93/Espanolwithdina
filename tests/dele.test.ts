import { describe, expect, it } from 'vitest';
import { DELE_LEVELS, DELE_TASKS, type DelePart } from '../src/data/dele';

// The exam practice tasks are hand-written, so this checks they are complete and well formed.
describe('exam practice tasks', () => {
  it('has reading, listening and writing at every level from A1 to B2', () => {
    for (const level of DELE_LEVELS) for (const part of ['reading', 'listening', 'writing'] as DelePart[]) {
      expect(DELE_TASKS.filter((t) => t.level === level && t.part === part).length, `${level} ${part}`).toBeGreaterThanOrEqual(1);
    }
    expect(new Set(DELE_TASKS.map((t) => t.id)).size).toBe(DELE_TASKS.length);
  });

  it('every question has three different options, one right answer and a reason', () => {
    for (const t of DELE_TASKS.filter((x) => x.part !== 'writing')) {
      expect(t.text && t.text.length > 200, t.id).toBe(true);
      expect(t.questions!.length, t.id).toBeGreaterThanOrEqual(4);
      for (const q of t.questions!) {
        expect(new Set(q.options).size, `${t.id}: ${q.q}`).toBe(3);
        expect([0, 1, 2]).toContain(q.answer);
        expect(q.why.length, `${t.id}: ${q.q}`).toBeGreaterThan(15);
      }
      // The right answers are spread out, not all the same letter.
      expect(new Set(t.questions!.map((q) => q.answer)).size, t.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('texts get longer and writing asks for more as the level rises', () => {
    const words = (s: string) => s.split(/\s+/).length;
    const reading = DELE_LEVELS.map((l) => words(DELE_TASKS.find((t) => t.level === l && t.part === 'reading')!.text!));
    const writing = DELE_LEVELS.map((l) => DELE_TASKS.find((t) => t.level === l && t.part === 'writing')!.writing!.minWords);
    expect([...reading].sort((a, b) => a - b)).toEqual(reading);
    expect([...writing].sort((a, b) => a - b)).toEqual(writing);
    for (const t of DELE_TASKS.filter((x) => x.part === 'writing')) { expect(t.writing!.maxWords).toBeGreaterThan(t.writing!.minWords); expect(t.writing!.points.length).toBeGreaterThanOrEqual(4); expect(t.writing!.checklist.length).toBeGreaterThanOrEqual(4); }
  });
});
