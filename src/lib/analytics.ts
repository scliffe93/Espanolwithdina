import type { AppState, ErrorCategory, MemoryTechnique, Region } from '../types';
import { VERBS, personsForRegion, verbKey, type Tense } from '../data/verbs';
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
