import { BLOCK_BY_ID, VERB_BLOCKS } from '../../data/blocks';
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

// ───────────────────────────────────────────────────────────────
// Gradual release: instead of opening a whole level at once, the
// teacher releases blocks of verbs and words. With it on, the student's
// own practice only draws on released blocks. Assigned homework is
// never restricted.
// ───────────────────────────────────────────────────────────────

export interface ReleaseSettings { stepped?: boolean; unlocked?: string[] }

/** The verbs a student may practise on their own: null = no restriction. Never empty, so practice always has something to offer. */
export function allowedVerbs(s: ReleaseSettings | null | undefined): Set<string> | null {
  if (!s?.stepped) return null;
  const blocks = (s.unlocked ?? []).map((id) => BLOCK_BY_ID[id]).filter((b) => b?.kind === 'verbs');
  return new Set((blocks.length ? blocks : [VERB_BLOCKS[0]]).flatMap((b) => b.items));
}

/** The word packs a student may add on their own: null = no restriction. */
export function allowedPacks(s: ReleaseSettings | null | undefined): Set<string> | null {
  if (!s?.stepped) return null;
  return new Set((s.unlocked ?? []).filter((id) => BLOCK_BY_ID[id]?.kind === 'words'));
}
