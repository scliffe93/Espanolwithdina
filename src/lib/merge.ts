import type { AppState, DayStats, MistakeRecord, SrsCard } from '../types';

// ───────────────────────────────────────────────────────────────
// Merging two copies of a learner's progress (e.g. phone edited offline
// while the laptop synced). Rules never lose learning:
//  • sets (completed scenes, verbs practised, achievements…) → union
//  • counters per day → the larger value (never double-counts a day)
//  • SRS cards → the copy reviewed most recently (most attempts on ties)
//  • profile / settings / teacher → the most recently edited copy
// The function is pure, deterministic and commutative for these fields.
// ───────────────────────────────────────────────────────────────

const uniq = <T,>(a: T[] = [], b: T[] = []) => [...new Set([...a, ...b])].sort();
const max = (a = 0, b = 0) => Math.max(a, b);

function mergeMistakes(a: MistakeRecord[] = [], b: MistakeRecord[] = []): MistakeRecord[] {
  const seen = new Map<string, MistakeRecord>();
  for (const m of [...a, ...b]) seen.set(`${m.at}|${m.key}|${m.given}`, m);
  return [...seen.values()].sort((x, y) => x.at - y.at).slice(-200);
}

function mergeDay(a: DayStats | undefined, b: DayStats | undefined): DayStats {
  if (!a) return b!;
  if (!b) return a;
  return {
    date: a.date,
    activeSeconds: max(a.activeSeconds, b.activeSeconds),
    listeningSeconds: max(a.listeningSeconds, b.listeningSeconds),
    speakingAttempts: max(a.speakingAttempts, b.speakingAttempts),
    exercisesAttempted: max(a.exercisesAttempted, b.exercisesAttempted),
    exercisesCorrect: max(a.exercisesCorrect, b.exercisesCorrect),
    lessonsCompleted: max(a.lessonsCompleted, b.lessonsCompleted),
    scenesCompleted: uniq(a.scenesCompleted, b.scenesCompleted),
    verbsPracticed: uniq(a.verbsPracticed, b.verbsPracticed),
    tensesPracticed: uniq(a.tensesPracticed, b.tensesPracticed),
    newVocab: uniq(a.newVocab, b.newVocab),
    reviewsDue: max(a.reviewsDue, b.reviewsDue),
    retentionAttempts: max(a.retentionAttempts, b.retentionAttempts),
    retentionCorrect: max(a.retentionCorrect, b.retentionCorrect),
    techniquesUsed: uniq(a.techniquesUsed, b.techniquesUsed),
    mistakes: mergeMistakes(a.mistakes, b.mistakes),
  };
}

function newerCard(a: SrsCard | undefined, b: SrsCard | undefined): SrsCard {
  if (!a) return b!;
  if (!b) return a;
  if (a.lastSeen !== b.lastSeen) return a.lastSeen > b.lastSeen ? a : b;
  return a.attempts >= b.attempts ? a : b;
}

function mergeRecord<T>(a: Record<string, T> = {}, b: Record<string, T> = {}, pick: (x: T | undefined, y: T | undefined) => T): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = pick(a[k], b[k]);
  return out;
}

const newer = <T,>(a: T, at: number | undefined, b: T, bt: number | undefined): T => ((bt ?? 0) > (at ?? 0) ? b : a);

/** Returns `local` merged with `remote`. Neither input is mutated. */
export function mergeStates(local: AppState, remote: AppState): AppState {
  const lm = local.meta ?? {};
  const rm = remote.meta ?? {};
  const profile = newer(local.profile, lm.profileAt, remote.profile, rm.profileAt) ?? local.profile ?? remote.profile;
  return {
    ...local,
    version: Math.max(local.version, remote.version),
    profile,
    onboardingDone: local.onboardingDone || remote.onboardingDone,
    teacher: newer(local.teacher, lm.teacherAt, remote.teacher, rm.teacherAt),
    settings: newer(local.settings, lm.settingsAt, remote.settings, rm.settingsAt),
    srs: mergeRecord(local.srs, remote.srs, newerCard),
    days: mergeRecord(local.days, remote.days, mergeDay),
    story: {
      completedScenes: uniq(local.story.completedScenes, remote.story.completedScenes),
      relationships: mergeRecord(local.story.relationships, remote.story.relationships, (x, y) => max(x, y)),
      flags: { ...remote.story.flags, ...local.story.flags },
      sceneScores: mergeRecord(local.story.sceneScores, remote.story.sceneScores, (x, y) => max(x, y)),
    },
    achievements: (() => {
      const m = new Map<string, { id: string; at: number }>();
      for (const a of [...local.achievements, ...remote.achievements]) if (!m.has(a.id) || m.get(a.id)!.at > a.at) m.set(a.id, a);
      return [...m.values()].sort((x, y) => x.at - y.at);
    })(),
    techniqueStats: mergeRecord(local.techniqueStats, remote.techniqueStats, (x, y) => ({
      used: max(x?.used, y?.used), delayedAttempts: max(x?.delayedAttempts, y?.delayedAttempts), delayedRecalled: max(x?.delayedRecalled, y?.delayedRecalled),
    })) as AppState['techniqueStats'],
    exerciseStats: mergeRecord(local.exerciseStats, remote.exerciseStats, (x, y) => ({ attempts: max(x?.attempts, y?.attempts), correct: max(x?.correct, y?.correct) })),
    associations: { ...remote.associations, ...local.associations },
    games: mergeRecord(local.games ?? {}, remote.games ?? {}, (x, y) => ({
      best: max(x?.best, y?.best), plays: max(x?.plays, y?.plays), lastAt: max(x?.lastAt, y?.lastAt), bestCombo: max(x?.bestCombo, y?.bestCombo),
    })),
    seenRecapWeek: [local.seenRecapWeek, remote.seenRecapWeek].filter(Boolean).sort().pop(),
    resume: (remote.resume?.at ?? 0) > (local.resume?.at ?? 0) ? remote.resume : local.resume,
    meta: {
      profileAt: max(lm.profileAt, rm.profileAt), settingsAt: max(lm.settingsAt, rm.settingsAt), teacherAt: max(lm.teacherAt, rm.teacherAt),
      changedAt: max(lm.changedAt, rm.changedAt),
    },
    linkedTo: undefined,
  };
}

/** True when a state contains real learning (used to decide whether to offer migration). */
export function hasProgress(s: AppState | null | undefined): boolean {
  if (!s) return false;
  return !!(s.onboardingDone || s.story.completedScenes.length || Object.keys(s.srs).length || Object.values(s.days).some((d) => d.activeSeconds > 0 || d.exercisesAttempted > 0));
}
