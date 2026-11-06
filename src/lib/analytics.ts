import type { AppState, ErrorCategory, MemoryTechnique, Region } from '../types';
import { TENSES, VERBS, personsForRegion, verbKey, type Tense } from '../data/verbs';
import { CATEGORY_LABEL } from './answer';
import { addDays, dayKey, weekDayKeys, weekStart } from './dates';
import { mastery, strength } from './srs';

export interface WeekSummary {
  start: Date;
  dayKeys: string[];
  minutesByDay: number[];
  activeSeconds: number;
  listeningSeconds: number;
  studyDays: number;
  lessonsCompleted: number;
  scenesCompleted: string[];
  exercisesAttempted: number;
  exercisesCorrect: number;
  accuracy: number | null;
  verbsPracticed: string[];
  tensesPracticed: string[];
  newVocab: string[];
  retentionAttempts: number;
  retentionCorrect: number;
  retention: number | null;
  speakingAttempts: number;
  mistakesByCategory: [ErrorCategory, number][];
  techniquesUsed: MemoryTechnique[];
}

/** A day counts as a study day with at least 60 seconds of active learning. */
export const STUDY_DAY_THRESHOLD_S = 60;

export function weekSummary(state: AppState, start: Date): WeekSummary {
  const keys = weekDayKeys(start);
  const days = keys.map((k) => state.days[k]).filter(Boolean);
  const sum = (f: (d: (typeof days)[number]) => number) => days.reduce((a, d) => a + f(d), 0);
  const uniq = <T,>(arr: T[]) => [...new Set(arr)];
  const cat = new Map<ErrorCategory, number>();
  for (const d of days) for (const m of d.mistakes) cat.set(m.category, (cat.get(m.category) ?? 0) + 1);
  const attempted = sum((d) => d.exercisesAttempted);
  const correct = sum((d) => d.exercisesCorrect);
  const rAtt = sum((d) => d.retentionAttempts);
  const rCor = sum((d) => d.retentionCorrect);
  return {
    start,
    dayKeys: keys,
    minutesByDay: keys.map((k) => Math.round(((state.days[k]?.activeSeconds ?? 0) / 60) * 10) / 10),
    activeSeconds: sum((d) => d.activeSeconds),
    listeningSeconds: sum((d) => d.listeningSeconds),
    studyDays: days.filter((d) => d.activeSeconds >= STUDY_DAY_THRESHOLD_S).length,
    lessonsCompleted: sum((d) => d.lessonsCompleted),
    scenesCompleted: uniq(days.flatMap((d) => d.scenesCompleted)),
    exercisesAttempted: attempted,
    exercisesCorrect: correct,
    accuracy: attempted ? correct / attempted : null,
    verbsPracticed: uniq(days.flatMap((d) => d.verbsPracticed)),
    tensesPracticed: uniq(days.flatMap((d) => d.tensesPracticed)),
    newVocab: uniq(days.flatMap((d) => d.newVocab)),
    retentionAttempts: rAtt,
    retentionCorrect: rCor,
    retention: rAtt ? rCor / rAtt : null,
    speakingAttempts: sum((d) => d.speakingAttempts),
    mistakesByCategory: [...cat.entries()].sort((a, b) => b[1] - a[1]),
    techniquesUsed: uniq(days.flatMap((d) => d.techniquesUsed)),
  };
}

export function thisWeek(state: AppState, now = Date.now()): WeekSummary {
  return weekSummary(state, weekStart(now));
}

export function previousWeek(state: AppState, now = Date.now(), back = 1): WeekSummary {
  return weekSummary(state, addDays(weekStart(now), -7 * back));
}

export interface VerbMastery {
  inf: string;
  score: number; // 0..1
  attempts: number;
  accuracy: number | null;
  level: 'new' | 'learning' | 'familiar' | 'mastered';
  personScores: number[];
}

export function verbMastery(state: AppState, inf: string, tense: Tense = 'present', region: Region = 'spain'): VerbMastery {
  const persons = personsForRegion(region);
  const cards = persons.map((p) => state.srs[verbKey(inf, tense, p)]);
  const attempts = cards.reduce((a, c) => a + (c?.attempts ?? 0), 0);
  const correct = cards.reduce((a, c) => a + (c?.correct ?? 0), 0);
  const personScores = [0, 1, 2, 3, 4, 5].map((p) => strength(state.srs[verbKey(inf, tense, p)]));
  const score = persons.reduce((a, p) => a + personScores[p], 0) / persons.length;
  const levels = cards.map((c) => mastery(c));
  let level: VerbMastery['level'] = 'new';
  if (attempts > 0) level = 'learning';
  if (levels.every((l) => l === 'familiar' || l === 'mastered')) level = 'familiar';
  if (levels.every((l) => l === 'mastered')) level = 'mastered';
  return { inf, score, attempts, accuracy: attempts ? correct / attempts : null, level, personScores };
}

export function allVerbMastery(state: AppState, tense: Tense = 'present', region: Region = 'spain'): VerbMastery[] {
  return VERBS.map((v) => verbMastery(state, v.inf, tense, region));
}

export function dueCards(state: AppState, now = Date.now()) {
  return Object.values(state.srs).filter((c) => c.due <= now && (c.attempts > 0 || c.key.startsWith('vocab:')));
}

export function totalActiveSeconds(state: AppState): number {
  return Object.values(state.days).reduce((a, d) => a + d.activeSeconds, 0);
}

/** Consecutive study days ending today (or yesterday, if today has no study yet). */
export function currentStreak(state: AppState, now = Date.now()): number {
  let streak = 0;
  let d = new Date(now);
  const studied = (k: string) => (state.days[k]?.activeSeconds ?? 0) >= STUDY_DAY_THRESHOLD_S;
  if (!studied(dayKey(d))) d = addDays(d, -1);
  while (studied(dayKey(d))) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

export function todaySeconds(state: AppState, now = Date.now()): number {
  return state.days[dayKey(now)]?.activeSeconds ?? 0;
}

// ── Deeper analytics (teacher profile, learner journey, reports) ──────────

export interface DayPoint { date: string; minutes: number; exercises: number; accuracy: number | null }

/** One point per calendar day for the last `days` days (oldest first). */
export function dailySeries(state: AppState, days = 28, now = Date.now()): DayPoint[] {
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(new Date(now - i * 86_400_000));
    const d = state.days[key];
    out.push({ date: key, minutes: d ? Math.round(d.activeSeconds / 60) : 0, exercises: d?.exercisesAttempted ?? 0, accuracy: d && d.exercisesAttempted ? d.exercisesCorrect / d.exercisesAttempted : null });
  }
  return out;
}

export interface Consistency { days: number; studyDays: number; minutes: number; avgMinutesPerStudyDay: number; longestStreak: number; bestWeekday: string | null; weekdayMinutes: number[] }

/** How regularly the learner shows up over the last `days` days. */
export function consistency(state: AppState, days = 28, now = Date.now()): Consistency {
  const series = dailySeries(state, days, now);
  const weekdayMinutes = [0, 0, 0, 0, 0, 0, 0];
  let studyDays = 0, minutes = 0, run = 0, longest = 0;
  for (const p of series) {
    const active = (state.days[p.date]?.activeSeconds ?? 0) >= STUDY_DAY_THRESHOLD_S;
    if (active) { studyDays++; run++; longest = Math.max(longest, run); } else run = 0;
    minutes += p.minutes;
    weekdayMinutes[new Date(p.date + 'T12:00:00').getDay()] += p.minutes;
  }
  const best = Math.max(...weekdayMinutes);
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return { days, studyDays, minutes, avgMinutesPerStudyDay: studyDays ? Math.round(minutes / studyDays) : 0, longestStreak: longest, bestWeekday: best > 0 ? names[weekdayMinutes.indexOf(best)] : null, weekdayMinutes };
}

const EXERCISE_LABEL: Record<string, string> = {
  'game-metro': 'Metro Rush (verb speed)', 'game-penalty': 'Penalty Shoot-out (verbs)', 'game-swipe': '¿Sí o no? (error spotting)', 'game-serestar': 'Ser o Estar (game)',
  'game-order': 'Order Up! (listening)', 'game-lineup': 'Line-up (listening, word order)', 'game-derbi': 'Derby Quiz (football words)',
  'review-vocab': 'Memory review', match: 'Match-up', build: 'Build the sentence', context: 'Pick the form in context', fix: 'Fix the mistake', translate: 'Translate', type: 'Typed conjugation', choose: 'Multiple choice', serEstar: 'Ser vs estar', listen: 'Listening', speak: 'Speaking', dictation: 'Dictation', fill: 'Fill the gap',
};
export interface SkillStat { type: string; label: string; attempts: number; correct: number; accuracy: number }

/** Accuracy per exercise type (all time), most practised first. */
export function skillBreakdown(state: AppState, minAttempts = 3): SkillStat[] {
  return Object.entries(state.exerciseStats)
    .filter(([, s]) => s.attempts >= minAttempts)
    .map(([type, s]) => ({ type, label: EXERCISE_LABEL[type] ?? type.replace(/[-_]/g, ' '), attempts: s.attempts, correct: s.correct, accuracy: s.correct / s.attempts }))
    .sort((a, b) => b.attempts - a.attempts);
}

export interface ErrorStat { category: ErrorCategory; label: string; count: number; previous: number; examples: string[] }

/** Mistakes by category over the last `days` days, with the previous window for the trend and up to three real examples. */
export function errorBreakdown(state: AppState, days = 28, now = Date.now()): ErrorStat[] {
  const since = now - days * 86_400_000;
  const before = since - days * 86_400_000;
  const map = new Map<ErrorCategory, ErrorStat>();
  for (const d of Object.values(state.days)) {
    for (const m of d.mistakes) {
      if (m.at < before) continue;
      const e = map.get(m.category) ?? { category: m.category, label: CATEGORY_LABEL[m.category], count: 0, previous: 0, examples: [] };
      if (m.at >= since) {
        e.count++;
        if (e.examples.length < 3 && m.expected && m.given && m.given !== '(too slow)') e.examples.push(`“${m.given}” → ${m.expected}`);
      } else e.previous++;
      map.set(m.category, e);
    }
  }
  return [...map.values()].filter((e) => e.count > 0).sort((a, b) => b.count - a.count);
}

export interface TenseStat { id: Tense; label: string; es: string; verbs: number; attempts: number; accuracy: number | null; mastered: number; familiar: number }

/** Per tense: verbs practised, accuracy and how many are mastered. */
export function tenseMastery(state: AppState, region: Region = 'spain'): TenseStat[] {
  return TENSES.map((t) => {
    const ms = allVerbMastery(state, t.id, region).filter((m) => m.attempts > 0);
    const attempts = ms.reduce((a, m) => a + m.attempts, 0);
    const correct = ms.reduce((a, m) => a + (m.accuracy ?? 0) * m.attempts, 0);
    return { id: t.id, label: t.label, es: t.es, verbs: ms.length, attempts, accuracy: attempts ? correct / attempts : null, mastered: ms.filter((m) => m.level === 'mastered').length, familiar: ms.filter((m) => m.level === 'familiar').length };
  }).filter((t) => t.verbs > 0);
}

export interface WeekPoint { label: string; start: Date; minutes: number; accuracy: number | null; retention: number | null; newVocab: number; cumulativeVocab: number; speaking: number }

/** Week-by-week history (oldest first) including cumulative vocabulary learned. */
export function weeklyHistory(state: AppState, weeks = 8, now = Date.now()): WeekPoint[] {
  const out: WeekPoint[] = [];
  const seen = new Set<string>();
  const firstStart = addDays(weekStart(new Date(now)), -7 * (weeks - 1));
  for (const d of Object.values(state.days)) if (d.date < dayKey(firstStart)) d.newVocab.forEach((v) => seen.add(v));
  for (let b = weeks - 1; b >= 0; b--) {
    const start = addDays(weekStart(new Date(now)), -7 * b);
    const w = weekSummary(state, start);
    const fresh = w.newVocab.filter((v) => !seen.has(v));
    fresh.forEach((v) => seen.add(v));
    out.push({ label: b === 0 ? 'This wk' : start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), start, minutes: Math.round(w.activeSeconds / 60), accuracy: w.accuracy, retention: w.retention, newVocab: fresh.length, cumulativeVocab: seen.size, speaking: w.speakingAttempts });
  }
  return out;
}

/** Vocabulary deck health: new, learning, mastered and overdue cards. */
export function deckHealth(state: AppState, now = Date.now()) {
  const cards = Object.values(state.srs).filter((c) => c.key.startsWith('vocab:'));
  let mastered = 0, learning = 0, fresh = 0, overdue = 0;
  for (const c of cards) {
    const m = mastery(c);
    if (m === 'mastered') mastered++; else if (c.attempts > 0) learning++; else fresh++;
    if (c.attempts > 0 && c.due < now - 86_400_000) overdue++;
  }
  return { total: cards.length, mastered, learning, fresh, overdue };
}
