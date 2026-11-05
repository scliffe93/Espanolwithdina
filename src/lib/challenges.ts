import type { WeekSummary } from './analytics';

export interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  target: number;
  measure: (w: WeekSummary) => number;
  unit: string;
}

export const CHALLENGES: WeeklyChallenge[] = [
  { id: 'verbs-15', title: 'Verb explorer', description: 'Practise 15 different verbs this week.', target: 15, measure: (w) => w.verbsPracticed.length, unit: 'verbs' },
  { id: 'days-4', title: 'Little and often', description: 'Study on 4 different days this week.', target: 4, measure: (w) => w.studyDays, unit: 'days' },
  { id: 'speak-10', title: 'Find your voice', description: 'Record yourself speaking 10 times.', target: 10, measure: (w) => w.speakingAttempts, unit: 'recordings' },
  { id: 'correct-60', title: 'Precision week', description: 'Answer 60 exercises correctly.', target: 60, measure: (w) => w.exercisesCorrect, unit: 'correct answers' },
  { id: 'minutes-60', title: 'The hour', description: 'Reach 60 active minutes this week.', target: 60, measure: (w) => Math.floor(w.activeSeconds / 60), unit: 'minutes' },
];

/** Deterministic rotation by ISO-ish week number. */
export function challengeForWeek(start: Date): WeeklyChallenge {
  const weekNo = Math.floor(start.getTime() / (7 * 86_400_000));
  return CHALLENGES[((weekNo % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
}
