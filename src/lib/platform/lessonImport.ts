import { uid } from './backend';
import type { LessonBlock } from './types';

// ───────────────────────────────────────────────────────────────
// A lesson from a lesson plan. The teacher uploads the plan she
// already has (a Word document, a PDF, a text file) or pastes it,
// and this turns it into the parts of a lesson by reading its shape:
//   • a heading starts a new part
//   • a line with ___ in it is a fill-the-gap sentence
//   • a question followed by a), b), c) is multiple choice
//   • a line ending in "?" is an open question
//   • lines like "la playa = the beach" are a word list
//   • everything else is an explanation
// It follows rules, it does not guess: nothing is invented and
// nothing is left out. The teacher checks the result on the Plan tab
// before the lesson, where every part can be edited.
// ───────────────────────────────────────────────────────────────

const bid = () => `b-${uid().slice(0, 8)}`;
const GAP = /_{2,}|\.{4,}|…{2,}/;
const OPTION = /^\s*(?:[-•*]\s*)?(?:\(?[a-dA-D][.)]|\[[ xX✓]?\])\s+(.+)$/;
const PAIR = /^\s*(?:[-•*]\s*)?(.{1,48}?)(?:\s*(?:=|→|–|—|\t)\s*|\s+-\s+|:\s+)(.{1,70})$/;
const ANSWER_LINE = /^\s*(?:answers?|respuestas?|soluci[oó]n(?:es)?|key|clave)\s*[:：]\s*(.+)$/i;
const MARK = /\s*(?:\*+|✓|✔|\(correct[oa]?\)|\(right\)|←)\s*$/i;

function isHeading(line: string, prevBlank: boolean, nextBlank: boolean, first: boolean, next: string): string | null {
  const t = line.trim();
  if (!t || t.length > 80 || GAP.test(t)) return null;
  // The first line of the document is its title, whatever it looks like, when something follows a gap after it.
  if (first && nextBlank && !/\?\s*$/.test(t)) return t.replace(/^#{1,6}\s+/, '');
  const md = t.match(/^#{1,6}\s+(.+)$/); if (md) return md[1].trim();
  const numbered = t.match(/^(?:\d{1,2}|[IVX]{1,4})[.)]\s+(.{2,70})$/);
  if (numbered && !/[.?!]$/.test(t) && !OPTION.test(t)) return numbered[1].trim();
  if (/[:：]$/.test(t) && t.length <= 60 && !ANSWER_LINE.test(t)) return t.replace(/[:：]$/, '').trim();
  const letters = t.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
  if (letters.length >= 4 && letters === letters.toUpperCase() && !/[.?!]$/.test(t)) return t.charAt(0) + t.slice(1).toLowerCase();
  // A short line on its own after a gap, with no full stop, is a heading for what follows.
  if (prevBlank && t.length <= 50 && !/[.?!:;,]$/.test(t) && !PAIR.test(t) && !OPTION.test(t) && t.split(/\s+/).length <= 7) return t;
  // So is a very short question that introduces an exercise ("¿Ir o ser?").
  if (prevBlank && !nextBlank && t.length <= 20 && /\?$/.test(t) && !/\?\s*$/.test(next) && !OPTION.test(next)) return t;
  return null;
}

/** Pulls the answer out of a gap line written as "… ___ … [fui]", "(answer: fui)", "→ fui" or "= fui". */
function gapAnswer(line: string): { body: string; answer: string } {
  const pats = [/\s*\[([^\]]{1,60})\]\s*$/, /\s*\((?:answer|respuesta|sol(?:uci[oó]n)?)\s*[:：]\s*([^)]{1,60})\)\s*$/i, /\s*(?:→|=>|=)\s*([^=→]{1,60})$/];
  for (const p of pats) { const m = line.match(p); if (m) return { body: line.slice(0, m.index).trim(), answer: m[1].trim() }; }
  return { body: line.trim(), answer: '' };
}

export interface ImportedPlan { title: string; blocks: LessonBlock[]; /** What was made, for the note shown to the teacher. */ counts: Record<LessonBlock['type'], number>; /** Gap and choice parts with no answer found, which she should fill in. */ needAnswers: number }

/** Turns the text of a lesson plan into the parts of a lesson. */
export function planFromText(raw: string, fallbackTitle = 'Lesson'): ImportedPlan {
  const lines = raw.replace(/\r\n?/g, '\n').replace(/ /g, ' ').split('\n').map((l) => l.replace(/\s+$/, ''));
  const blocks: LessonBlock[] = [];
  let title = '';
  let section = '';
  let text: string[] = [];
  let pendingGaps: LessonBlock[] = []; // gaps in the current section still waiting for an "Answers:" line
  const flushText = () => {
    const body = text.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (body) blocks.push({ id: bid(), type: 'text', title: section, body });
    text = [];
  };

  for (let i = 0; i < lines.length && blocks.length < 40; i++) {
    const line = lines[i]; const t = line.trim();
    if (!t) { if (text.length) text.push(''); continue; }
    const firstIdx = lines.findIndex((l) => l.trim());
    const heading = isHeading(line, i === 0 || !lines[i - 1].trim(), i === lines.length - 1 || !lines[i + 1].trim(), i === firstIdx, lines[i + 1] ?? '');
    if (heading) { flushText(); if (!title) title = heading; section = heading; pendingGaps = []; continue; }

    // "Answers: fui, fue, fuimos" fills the gaps above it that have none, in order.
    const key = t.match(ANSWER_LINE);
    if (key && pendingGaps.some((g) => !g.answer)) {
      const given = key[1].split(/\s*[,;]\s*|\s+\d+[.)]\s*/).map((x) => x.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
      const empty = pendingGaps.filter((g) => !g.answer);
      empty.forEach((g, k) => { if (given[k]) g.answer = given[k]; });
      continue;
    }

    if (GAP.test(t)) {
      flushText();
      const g = gapAnswer(t.replace(/^\s*(?:[-•*]|\d{1,2}[.)])\s+/, ''));
      const block: LessonBlock = { id: bid(), type: 'gap', title: section, body: g.body.replace(/\.{4,}|…{2,}/g, '___'), answer: g.answer };
      blocks.push(block); pendingGaps.push(block);
      continue;
    }

    // A question with lettered options under it is multiple choice.
    const opts: { text: string; right: boolean }[] = [];
    let j = i + 1;
    while (j < lines.length && OPTION.test(lines[j])) { const o = lines[j].match(OPTION)![1]; const box = /^\s*(?:[-•*]\s*)?\[[xX✓]\]/.test(lines[j]); opts.push({ text: o.replace(MARK, '').trim(), right: box || MARK.test(o) }); j++; }
    if (opts.length >= 2 && !OPTION.test(t)) {
      flushText();
      blocks.push({ id: bid(), type: 'choice', title: section, body: t.replace(/^\s*(?:[-•*]|\d{1,2}[.)])\s+/, ''), options: opts.map((o) => o.text), answer: opts.find((o) => o.right)?.text ?? '' });
      i = j - 1;
      continue;
    }

    // Two or more "word = meaning" lines in a row are a word list.
    const pairs: { es: string; en: string }[] = [];
    let k = i;
    while (k < lines.length) { const m = lines[k].match(PAIR); if (!m || /\?\s*$/.test(lines[k]) || GAP.test(lines[k]) || m[1].split(/\s+/).length > 6) break; pairs.push({ es: m[1].trim(), en: m[2].trim() }); k++; }
    if (pairs.length >= 2) { flushText(); blocks.push({ id: bid(), type: 'vocab', title: section, body: '', pairs }); i = k - 1; continue; }

    if (/\?\s*$/.test(t)) { flushText(); blocks.push({ id: bid(), type: 'question', title: section, body: t.replace(/^\s*(?:[-•*]|\d{1,2}[.)])\s+/, '') }); continue; }

    text.push(t.replace(/^\s*[-•*]\s+/, '• '));
  }
  flushText();

  const counts = { text: 0, question: 0, choice: 0, gap: 0, vocab: 0 } as ImportedPlan['counts'];
  for (const b of blocks) counts[b.type]++;
  const firstLine = lines.find((l) => l.trim())?.trim() ?? '';
  return { title: (title || (firstLine.length <= 80 ? firstLine : '') || fallbackTitle).slice(0, 120), blocks, counts, needAnswers: blocks.filter((b) => (b.type === 'gap' || b.type === 'choice') && !b.answer).length };
}

/** "9 parts: 2 explanations, 3 gap sentences…" for the note the teacher sees after importing. */
export function describeImport(p: ImportedPlan): string {
  const names: [LessonBlock['type'], string, string][] = [['text', 'explanation', 'explanations'], ['question', 'open question', 'open questions'], ['gap', 'gap sentence', 'gap sentences'], ['choice', 'multiple-choice question', 'multiple-choice questions'], ['vocab', 'word list', 'word lists']];
  const bits = names.filter(([t]) => p.counts[t]).map(([t, one, many]) => `${p.counts[t]} ${p.counts[t] === 1 ? one : many}`);
  return `${p.blocks.length} part${p.blocks.length === 1 ? '' : 's'}: ${bits.join(', ')}.`;
}
