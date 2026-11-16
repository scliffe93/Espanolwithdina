import { TENSE_BY_ID, VERB_BY_INF, personShort, type Tense } from '../../data/verbs';
import type { AppState } from '../../types';
import { focusAreas } from '../focus';
import { uid } from './backend';
import type { LessonBlock } from './types';

const bid = () => `b-${uid().slice(0, 8)}`;

/** A blank block of each kind, with a sensible starting text. */
export function newBlock(type: LessonBlock['type']): LessonBlock {
  switch (type) {
    case 'text': return { id: bid(), type, title: 'Explanation', body: '' };
    case 'question': return { id: bid(), type, title: 'Question', body: '' };
    case 'choice': return { id: bid(), type, title: 'Choose', body: '', options: ['', ''], answer: '' };
    case 'gap': return { id: bid(), type, title: 'Fill the gap', body: 'Ayer yo ___ (ir) al mercado.', answer: '' };
    case 'vocab': return { id: bid(), type, title: 'Words', body: '', pairs: [] };
  }
}

/**
 * A first draft of a lesson from what the student has actually been doing: a warm-up, the thing they find hardest
 * explained with their own mistakes, gap exercises on the exact forms they missed, the verbs to recycle, and a
 * wrap-up. The teacher edits it from there. Nothing is opened to the student until she opens it.
 */
export function draftLesson(state: AppState | null, name: string, now = Date.now()): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  const areas = state ? focusAreas(state, now, 3) : [];
  blocks.push({ id: bid(), type: 'question', title: 'Para empezar', body: `¿Qué tal la semana, ${name}? Cuéntame tres cosas que hiciste.` });
  if (areas.length) blocks.push({ id: bid(), type: 'text', title: 'Hoy', body: `Today we will work on:\n${areas.map((a) => `• ${a.title}`).join('\n')}` });
  const top = areas.find((a) => a.id.startsWith('err-') || a.id.startsWith('tense-'));
  if (top) blocks.push({ id: bid(), type: 'text', title: top.title, body: `${top.explain}${top.examples.length ? `\n\nFrom your answers:\n${top.examples.map((e) => `• ${e.wrong} → ${e.right}`).join('\n')}` : ''}` });

  // Gap exercises on the exact verb forms missed in the last four weeks, most recent first, one per form.
  const recent = state ? Object.values(state.days).flatMap((d) => d.mistakes).filter((m) => m.at >= now - 28 * 86_400_000).sort((a, b) => b.at - a.at) : [];
  const seen = new Set<string>(); const verbs = new Set<string>();
  for (const m of recent) {
    const k = m.key.match(/^verb:([^|]+)\|([^|]+)\|(\d)$/);
    if (!k || seen.has(m.key) || !VERB_BY_INF[k[1]] || !m.expected) continue;
    seen.add(m.key); verbs.add(k[1]);
    const tense = TENSE_BY_ID[k[2] as Tense]?.es.toLowerCase() ?? k[2];
    blocks.push({ id: bid(), type: 'gap', title: `${k[1]} · ${tense}`, body: `${personShort(Number(k[3]))} ___ (${k[1]})`, answer: m.expected });
    if (seen.size >= 5) break;
  }
  if (verbs.size) blocks.push({ id: bid(), type: 'vocab', title: 'Verbos de hoy', body: '', pairs: [...verbs].map((v) => ({ es: v, en: VERB_BY_INF[v].en.split(' (')[0] })) });
  blocks.push({ id: bid(), type: 'question', title: 'Para terminar', body: verbs.size ? `Escribe una frase con cada verbo: ${[...verbs].join(', ')}.` : 'Escribe tres frases sobre lo que vas a hacer esta semana.' });
  return blocks;
}

export const BLOCK_LABEL: Record<LessonBlock['type'], string> = { text: 'Explanation', question: 'Open question', choice: 'Multiple choice', gap: 'Fill the gap', vocab: 'Word list' };
