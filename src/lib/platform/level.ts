import { CEFR_LEVELS, type Cefr } from '../../types';

// ───────────────────────────────────────────────────────────────
// Level access: the teacher sets a ceiling (A1…C2) per student; the
// student's own app hides tenses, verbs and self-selected levels above
// it. Homework the teacher assigns always opens, whatever the ceiling.
// ───────────────────────────────────────────────────────────────

export const levelIdx = (l: Cefr) => CEFR_LEVELS.indexOf(l);

/** True when `level` is at or below the ceiling (no ceiling = everything is allowed). */
export function withinLevel(level: Cefr, maxLevel: Cefr | null | undefined): boolean {
  return !maxLevel || levelIdx(level) <= levelIdx(maxLevel);
}

/** The settings row id for a student (one row per student). */
export const settingsId = (studentId: string) => `student-${studentId}`;
