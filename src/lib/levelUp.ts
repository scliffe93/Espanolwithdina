import { TENSES, type Tense } from '../data/verbs';
import type { AppState, Cefr, Region } from '../types';
import { allVerbMastery, consistency, tenseMastery } from './analytics';
import { nextLevel } from './platform/level';
import { mastery } from './srs';

// ───────────────────────────────────────────────────────────────
// "Ready to move up?" The app looks at what a learner has actually
// done at their level and says whether they look ready for the next
// one. It only ever suggests: the teacher confirms the move.
// ───────────────────────────────────────────────────────────────

export interface ReadinessCheck { id: string; label: string; met: boolean; detail: string }
export interface Readiness {
  level: Cefr;
  next: Cefr | null;
  checks: ReadinessCheck[];
  met: number;
  ready: boolean;
  /** One sentence for the learner or the teacher. */
  summary: string;
}

const TARGET: Record<Cefr, { verbs: number; words: number; tenseAttempts: number }> = {
  A1: { verbs: 15, words: 40, tenseAttempts: 40 },
  A2: { verbs: 30, words: 100, tenseAttempts: 15 },
  B1: { verbs: 45, words: 180, tenseAttempts: 15 },
  B2: { verbs: 60, words: 280, tenseAttempts: 15 },
  C1: { verbs: 75, words: 400, tenseAttempts: 15 },
  C2: { verbs: 90, words: 500, tenseAttempts: 15 },
};

/** How ready a learner is to leave `level`, from their own practice. */
export function levelReadiness(state: AppState, level: Cefr, now = Date.now(), region: Region = state.profile?.region ?? 'spain'): Readiness {
  const next = nextLevel(level);
  const t = TARGET[level];
  const checks: ReadinessCheck[] = [];

  // 1. The tenses taught at this level are secure.
  const own: Tense[] = TENSES.filter((x) => x.minLevel === level).map((x) => x.id);
  const stats = tenseMastery(state, region);
  const short: string[] = [];
  for (const id of own) {
    const s = stats.find((x) => x.id === id), label = TENSES.find((x) => x.id === id)!.label.toLowerCase();
    if (!s || s.attempts === 0) short.push(`${label} not started`);
    else if (s.attempts < t.tenseAttempts) short.push(`${label} needs more practice (${s.attempts} answers so far)`);
    else if ((s.accuracy ?? 0) < 0.75) short.push(`${label} at ${Math.round((s.accuracy ?? 0) * 100)}%`);
  }
  if (own.length) checks.push({ id: 'tenses', label: own.length === 1 ? `The ${TENSES.find((x) => x.id === own[0])!.label.toLowerCase()} tense is secure` : `The ${level} tenses are secure`, met: short.length === 0, detail: short.length ? short.slice(0, 3).join('; ') : `${own.length === 1 ? 'It is' : `All ${own.length} are`} at 75% or better` });

  // 2. A solid stock of verbs.
  const verbs = allVerbMastery(state, 'present', region).filter((m) => m.level === 'familiar' || m.level === 'mastered').length;
  checks.push({ id: 'verbs', label: `${t.verbs} verbs known well`, met: verbs >= t.verbs, detail: `${verbs} of ${t.verbs}` });

  // 3. Vocabulary.
  const words = Object.values(state.srs).filter((c) => c.key.startsWith('vocab:') && (mastery(c) === 'familiar' || mastery(c) === 'mastered')).length;
  checks.push({ id: 'words', label: `${t.words} words remembered`, met: words >= t.words, detail: `${words} of ${t.words}` });

  // 4. Accuracy over the last four weeks.
  const since = new Date(now - 28 * 86_400_000).toISOString().slice(0, 10);
  const recent = Object.values(state.days).filter((d) => d.date >= since);
  const attempts = recent.reduce((a, d) => a + d.exercisesAttempted, 0), correct = recent.reduce((a, d) => a + d.exercisesCorrect, 0);
  const acc = attempts ? correct / attempts : 0;
  checks.push({ id: 'accuracy', label: '80% right over the last four weeks', met: attempts >= 80 && acc >= 0.8, detail: attempts < 80 ? `${attempts} answers so far (80 needed to judge)` : `${Math.round(acc * 100)}% of ${attempts} answers` });

  // 5. Regular practice.
  const c = consistency(state, 28, now);
  checks.push({ id: 'regular', label: 'Practising regularly', met: c.studyDays >= 8, detail: `${c.studyDays} days in the last four weeks (8 needed)` });

  const met = checks.filter((x) => x.met).length;
  const ready = !!next && met === checks.length;
  const missing = checks.filter((x) => !x.met);
  const summary = !next ? 'This is the top level.' : ready ? `Everything points to being ready for ${next}.` : `${met} of ${checks.length} signs of being ready for ${next}. Still to do: ${missing.map((x) => x.label.charAt(0).toLowerCase() + x.label.slice(1)).slice(0, 2).join(', and ')}.`;
  return { level, next, checks, met, ready, summary };
}

const DAY = 86_400_000;
/** Whether the teacher should be shown the suggestion: ready, and she has not said "not yet" for this level in the last three weeks. */
export function shouldSuggest(r: Readiness, notYet: { level: Cefr; at: string } | undefined, now = Date.now()): boolean {
  if (!r.ready) return false;
  return !(notYet && notYet.level === r.level && now - Date.parse(notYet.at) < 21 * DAY);
}
