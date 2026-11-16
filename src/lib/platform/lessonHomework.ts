// Homework made from a lesson: the tasks of the lesson (gaps, multiple choice, open questions, the word list) as a
// set of exercises the student can do afterwards, on their own. Explanations are left out: they are not tasks.

import type { LessonBlock } from '../../../supabase/functions/_shared/lesson';
import type { MaterialItem, MaterialSet } from '../material';

/** A fixed, repeatable reorder, so the right answer is not always first and a test can rely on it. */
function mix<T>(list: T[], seed: number): T[] {
  const arr = [...list];
  let s = seed + 7;
  for (let i = arr.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

export function homeworkItems(blocks: LessonBlock[]): MaterialItem[] {
  const items: MaterialItem[] = [];
  const pairs = blocks.filter((b) => b.type === 'vocab').flatMap((b) => b.pairs ?? []).filter((p) => p.es.trim() && p.en.trim());
  blocks.forEach((b, n) => {
    const body = b.body.trim();
    if (b.type === 'gap' && body && (b.answer ?? '').trim()) items.push({ kind: 'gap', sentence: body, answer: b.answer!.trim() });
    else if (b.type === 'choice' && body && (b.answer ?? '').trim()) {
      const options = (b.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (options.length >= 2 && options.includes(b.answer!.trim())) items.push({ kind: 'choice', prompt: body, options, answer: b.answer!.trim() });
    } else if (b.type === 'question' && body) items.push({ kind: 'question', prompt: body });
    else if (b.type === 'vocab' && pairs.length >= 3) {
      (b.pairs ?? []).filter((p) => p.es.trim() && p.en.trim()).forEach((p, k) => {
        const others = [...new Set(pairs.map((x) => x.en.trim()).filter((en) => en !== p.en.trim()))];
        const options = mix([p.en.trim(), ...mix(others, n * 31 + k).slice(0, 3)], n * 17 + k);
        if (options.length >= 2) items.push({ kind: 'choice', prompt: `¿Qué significa “${p.es.trim()}”?`, options, answer: p.en.trim() });
      });
    }
  });
  return items;
}

export function homeworkFromLesson(title: string, blocks: LessonBlock[]): MaterialSet {
  const items = homeworkItems(blocks);
  return { title, excerpt: '', source: 'paste', words: 0, items };
}
