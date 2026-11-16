import { describe, expect, it } from 'vitest';
import { homeworkItems } from '../src/lib/platform/lessonHomework';
import { exampleLesson } from '../src/lib/platform/lessonDraft';
import type { LessonBlock } from '../supabase/functions/_shared/lesson';

const b = (x: Partial<LessonBlock> & { type: LessonBlock['type'] }): LessonBlock => ({ id: Math.random().toString(36), title: '', body: '', open: false, ...x });

describe('homework from a lesson', () => {
  it('turns the tasks into exercises and leaves explanations out', () => {
    const items = homeworkItems([
      b({ type: 'text', body: 'Ir and ser share forms.' }),
      b({ type: 'gap', body: 'Ayer yo ___ al cine.', answer: 'fui' }),
      b({ type: 'choice', body: '¿Ir o ser?', options: ['ir', 'ser'], answer: 'ir' }),
      b({ type: 'question', body: '¿Qué hiciste ayer?' }),
    ]);
    expect(items.map((i) => i.kind)).toEqual(['gap', 'choice', 'question']);
  });
  it('skips tasks that cannot be marked: no answer, or an answer that is not one of the options', () => {
    expect(homeworkItems([b({ type: 'gap', body: 'Yo ___.' }), b({ type: 'choice', body: '¿?', options: ['a', 'b'], answer: 'c' }), b({ type: 'choice', body: '¿?', options: ['a'], answer: 'a' })])).toEqual([]);
  });
  it('makes a meaning question for each word when there are at least three words', () => {
    const pairs = [{ es: 'ayer', en: 'yesterday' }, { es: 'anoche', en: 'last night' }, { es: 'hoy', en: 'today' }, { es: 'mañana', en: 'tomorrow' }];
    const items = homeworkItems([b({ type: 'vocab', pairs })]);
    expect(items).toHaveLength(4);
    for (const [k, it] of items.entries()) {
      if (it.kind !== 'choice') throw new Error('expected a choice');
      expect(it.answer).toBe(pairs[k].en);
      expect(it.options).toContain(it.answer);
      expect(new Set(it.options).size).toBe(it.options.length);
    }
    expect(homeworkItems([b({ type: 'vocab', pairs: pairs.slice(0, 2) })])).toEqual([]);
  });
  it('the example lesson gives homework', () => {
    expect(homeworkItems(exampleLesson('Sam')).length).toBeGreaterThanOrEqual(4);
  });
});
