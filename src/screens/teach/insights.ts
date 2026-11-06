import { CITY_THEMES } from '../../data/cityThemes';
import type { CityId } from '../../data/story';
import { STUDY_DAY_THRESHOLD_S, currentStreak, thisWeek } from '../../lib/analytics';
import { levelIndex } from '../../lib/assessmentScore';
import { addDays, dayKey, parseDayKey } from '../../lib/dates';
import type { Booking, Homework, Person } from '../../lib/platform/types';
import { CEFR_LEVELS, SKILLS, type AppState, type Cefr } from '../../types';

// ───────────────────────────────────────────────────────────────
// Teacher-side insights: pure functions over a learner's AppState plus the
// platform's bookings and homework. Nothing here touches the backend.
// ───────────────────────────────────────────────────────────────

export const pct = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : `${Math.round(n * 100)}%`);

/** Median of the six skill levels — the same "overall" figure the learner sees on their journey page. */
export function overallLevel(state: AppState | null): Cefr | null {
  const p = state?.profile;
  if (!p) return null;
  const sorted = SKILLS.map((s) => levelIndex(p.levels[s])).sort((a, b) => a - b);
  return CEFR_LEVELS[sorted[Math.floor(sorted.length / 2)]];
}

/** Most recent day (YYYY-MM-DD) with at least a minute of active learning. */
export function lastStudyDay(state: AppState | null): string | null {
  if (!state) return null;
  const keys = Object.values(state.days).filter((d) => d.activeSeconds >= STUDY_DAY_THRESHOLD_S).map((d) => d.date).sort();
  return keys.length ? keys[keys.length - 1] : null;
}

export function daysBetween(dayA: string, dayB: string): number {
  return Math.round((parseDayKey(dayB).getTime() - parseDayKey(dayA).getTime()) / 86_400_000);
}

/** Delayed-recall (12h+) results over the last `days` days. */
export function recentRecall(state: AppState | null, now = Date.now(), days = 14): { rate: number | null; attempts: number; correct: number } {
  if (!state) return { rate: null, attempts: 0, correct: 0 };
  let attempts = 0;
  let correct = 0;
  for (let i = 0; i < days; i++) {
    const d = state.days[dayKey(addDays(new Date(now), -i))];
    if (d) {
      attempts += d.retentionAttempts;
      correct += d.retentionCorrect;
    }
  }
  return { rate: attempts ? correct / attempts : null, attempts, correct };
}

export const SUPPORT_RULES = { noStudyDays: 5, minAccuracy: 0.6, minRecall: 0.5, minRecallAttempts: 5, recallWindowDays: 14 } as const;

export interface StudentInsight {
  person: Person;
  state: AppState | null;
  level: Cefr | null;
  city: CityId | null;
  cityName: string | null;
  lastStudyDay: string | null;
  daysSinceStudy: number | null;
  streak: number;
  weekMinutes: number;
  weekAccuracy: number | null;
  weekExercises: number;
  weekStudyDays: number;
  recall: { rate: number | null; attempts: number };
  pending: Homework[];
  awaiting: Homework[];
  overdue: Homework[];
  reviewed: Homework[];
  nextLesson: Booking | null;
  /** Human reasons this student needs support (empty = fine). */
  support: string[];
}

export function studentInsight(person: Person, state: AppState | null, homework: Homework[], bookings: Booking[], now = Date.now()): StudentInsight {
  const week = state ? thisWeek(state, now) : null;
  const last = lastStudyDay(state);
  const daysSince = last ? daysBetween(last, dayKey(now)) : null;
  const nowIso = new Date(now).toISOString();
  const mine = homework.filter((h) => h.studentId === person.id);
  const pending = mine.filter((h) => h.status === 'assigned');
  const awaiting = mine.filter((h) => h.status === 'submitted');
  const reviewed = mine.filter((h) => h.status === 'reviewed');
  const overdue = pending.filter((h) => h.dueAt < nowIso);
  const nextLesson = bookings.filter((b) => b.studentId === person.id && b.status === 'scheduled' && b.startsAt >= nowIso).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
  const recall = recentRecall(state, now, SUPPORT_RULES.recallWindowDays);
  const city = state?.profile?.city ?? null;

  const support: string[] = [];
  if (state) {
    if (daysSince === null) support.push('No study sessions recorded yet.');
    else if (daysSince >= SUPPORT_RULES.noStudyDays) support.push(`No study day in the last ${SUPPORT_RULES.noStudyDays} days — last studied ${daysSince} days ago.`);
    if (week && week.accuracy !== null && week.accuracy < SUPPORT_RULES.minAccuracy) support.push(`Accuracy this week is ${pct(week.accuracy)} (below ${Math.round(SUPPORT_RULES.minAccuracy * 100)}%, over ${week.exercisesAttempted} exercises).`);
    if (recall.rate !== null && recall.attempts >= SUPPORT_RULES.minRecallAttempts && recall.rate < SUPPORT_RULES.minRecall) support.push(`Delayed recall is ${pct(recall.rate)} over the last ${SUPPORT_RULES.recallWindowDays} days (${recall.attempts} items) — material fades between sessions.`);
  }
  if (overdue.length) support.push(`${overdue.length} overdue homework: ${overdue.map((h) => h.activity.title).join(', ')}.`);

  return {
    person,
    state,
    level: overallLevel(state),
    city,
    cityName: city ? CITY_THEMES[city].name : null,
    lastStudyDay: last,
    daysSinceStudy: daysSince,
    streak: state ? currentStreak(state, now) : 0,
    weekMinutes: week ? Math.round(week.activeSeconds / 60) : 0,
    weekAccuracy: week?.accuracy ?? null,
    weekExercises: week?.exercisesAttempted ?? 0,
    weekStudyDays: week?.studyDays ?? 0,
    recall: { rate: recall.rate, attempts: recall.attempts },
    pending,
    awaiting,
    overdue,
    reviewed,
    nextLesson,
    support,
  };
}

/** "today", "yesterday", "3 days ago", or "never". */
export function studyAgo(daysSince: number | null): string {
  if (daysSince === null) return 'never';
  if (daysSince <= 0) return 'today';
  if (daysSince === 1) return 'yesterday';
  return `${daysSince} days ago`;
}

export interface HomeworkStats { assigned: number; submitted: number; reviewed: number; onTime: number; late: number; overdue: number; pending: number; avgScore: number | null; completionRate: number | null; byKind: { kind: string; count: number; avgScore: number | null }[] }

/** Completion and scores across a student's homework. */
export function homeworkStats(homework: Homework[], now = Date.now()): HomeworkStats {
  const done = homework.filter((h) => h.result);
  const scored = done.filter((h) => typeof h.result?.score === 'number');
  const onTime = done.filter((h) => h.result!.completedAt <= h.dueAt).length;
  const overdue = homework.filter((h) => !h.result && new Date(h.dueAt).getTime() < now).length;
  const kinds = new Map<string, { count: number; scores: number[] }>();
  for (const h of homework) {
    const k = kinds.get(h.activity.kind) ?? { count: 0, scores: [] };
    k.count++;
    if (typeof h.result?.score === 'number') k.scores.push(h.result.score);
    kinds.set(h.activity.kind, k);
  }
  return {
    assigned: homework.length, submitted: done.length, reviewed: homework.filter((h) => h.status === 'reviewed').length,
    onTime, late: done.length - onTime, overdue, pending: homework.length - done.length,
    avgScore: scored.length ? scored.reduce((a, h) => a + h.result!.score!, 0) / scored.length : null,
    completionRate: homework.length ? done.length / homework.length : null,
    byKind: [...kinds.entries()].map(([kind, k]) => ({ kind, count: k.count, avgScore: k.scores.length ? k.scores.reduce((a, b) => a + b, 0) / k.scores.length : null })).sort((a, b) => b.count - a.count),
  };
}
