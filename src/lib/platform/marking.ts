import type { ErrorCategory } from '../../types';
import { FOCUS_TAG_LABEL, type Correction, type FocusTag, type Homework, type Marking } from './types';

// ───────────────────────────────────────────────────────────────
// Marking helpers: what the app diagnosed and what the teacher marked,
// summarised for the next lesson debrief, and corrections laid over the
// student's own text. Pure functions, no React.
// ───────────────────────────────────────────────────────────────

/** The app's error categories mapped onto the debrief's "what to fix" tags. */
export const CATEGORY_TO_FOCUS: Partial<Record<ErrorCategory, FocusTag>> = {
  accents: 'accents', 'person-agreement': 'person-agreement', 'stem-change': 'stem-change', 'irregular-yo': 'irregular-verbs', 'irregular-verb': 'irregular-verbs',
  'ser-estar': 'ser-estar', vocabulary: 'vocabulary', spelling: 'spelling', auxiliary: 'tense-choice', voseo: 'person-agreement',
};

export function focusFor(category?: string): FocusTag | null {
  if (!category) return null;
  if (category in FOCUS_TAG_LABEL) return category as FocusTag;
  return CATEGORY_TO_FOCUS[category as ErrorCategory] ?? null;
}

export interface SlipSummary { tag: FocusTag; count: number; examples: string[] }

/** Slips in homework completed since `sinceIso`: the teacher's corrections first, then the app's own diagnoses. Most frequent first. */
export function markedSlips(homework: Homework[], sinceIso: string): SlipSummary[] {
  const acc = new Map<FocusTag, SlipSummary>();
  const add = (tag: FocusTag | null, example: string) => {
    if (!tag) return;
    const s = acc.get(tag) ?? { tag, count: 0, examples: [] };
    s.count++;
    if (example && s.examples.length < 3 && !s.examples.includes(example)) s.examples.push(example);
    acc.set(tag, s);
  };
  for (const h of homework) {
    if (!h.result || h.result.completedAt < sinceIso) continue;
    for (const c of h.marking?.corrections ?? []) add(c.category ?? null, `${c.quote} → ${c.correction}`);
    const overridden = new Map((h.marking?.items ?? []).map((m) => [m.index, m.ok]));
    (h.result.items ?? []).forEach((it, i) => {
      const ok = overridden.get(i) ?? it.correct;
      if (!ok) add(focusFor(it.category), it.expected ? `${it.given || '—'} → ${it.expected}` : it.given);
    });
  }
  return [...acc.values()].sort((a, b) => b.count - a.count);
}

export interface TextSegment { text: string; correction?: Correction }

/** Splits the student's text so each quoted passage can be highlighted with its correction. Quotes that are not found are left out. */
export function segmentsWithCorrections(text: string, corrections: Correction[]): TextSegment[] {
  const found: { start: number; end: number; correction: Correction }[] = [];
  for (const c of corrections) {
    const q = c.quote.trim();
    if (!q) continue;
    let at = text.indexOf(q);
    if (at < 0) at = text.toLowerCase().indexOf(q.toLowerCase());
    if (at < 0) continue;
    const end = at + q.length;
    if (found.some((f) => at < f.end && f.start < end)) continue; // overlapping quotes: first one wins
    found.push({ start: at, end, correction: c });
  }
  found.sort((a, b) => a.start - b.start);
  const out: TextSegment[] = [];
  let pos = 0;
  for (const f of found) {
    if (f.start > pos) out.push({ text: text.slice(pos, f.start) });
    out.push({ text: text.slice(f.start, f.end), correction: f.correction });
    pos = f.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

/** "B+" or "80%", or null when nothing was marked. */
export function markLabel(m?: Marking | null): string | null {
  if (!m) return null;
  if (m.grade?.trim()) return m.grade.trim();
  if (typeof m.score === 'number') return `${Math.round(m.score * 100)}%`;
  return null;
}

/** The verdict the student sees for one answer: the teacher's override wins over the app's. */
export function verdictFor(h: Homework, index: number): boolean | undefined {
  const it = h.result?.items?.[index];
  if (!it) return undefined;
  const m = h.marking?.items?.find((x) => x.index === index);
  return m?.ok ?? it.correct;
}
