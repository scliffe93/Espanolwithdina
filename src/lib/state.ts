import {
  STATE_VERSION,
  type AppState,
  type DayStats,
  type ErrorCategory,
  type MemoryTechnique,
  type MistakeRecord,
  type TechniqueStats,
} from '../types';
import { dayKey } from './dates';
import { isDelayedReview, newCard, review, type Grade } from './srs';

const TECHNIQUES: MemoryTechnique[] = ['first-letters', 'association', 'mnemonic', 'origin', 'visual', 'story', 'personal'];

export function emptyTechniqueStats(): Record<MemoryTechnique, TechniqueStats> {
  return Object.fromEntries(TECHNIQUES.map((t) => [t, { used: 0, delayedAttempts: 0, delayedRecalled: 0 }])) as Record<
    MemoryTechnique,
    TechniqueStats
  >;
}

export function defaultState(): AppState {
  return {
    version: STATE_VERSION,
    profile: null,
    onboardingDone: false,
    teacher: { name: '', email: '' },
    settings: { streaksEnabled: true, guideVoice: true, showTranslations: 'on-tap', speechRate: 0.95, sound: true },
    srs: {},
    days: {},
    story: { completedScenes: [], relationships: {}, flags: {}, sceneScores: {} },
    achievements: [],
    techniqueStats: emptyTechniqueStats(),
    exerciseStats: {},
    associations: {},
    games: {},
  };
}

/** Fills in fields added in later versions so old saves keep working. */
export function migrate(raw: Partial<AppState> | undefined | null): AppState {
  const base = defaultState();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings ?? {}) },
    teacher: { ...base.teacher, ...(raw.teacher ?? {}) },
    story: { ...base.story, ...(raw.story ?? {}) },
    techniqueStats: { ...base.techniqueStats, ...(raw.techniqueStats ?? {}) },
    profile: raw.profile ? { ...raw.profile, city: raw.profile.city ?? (raw.profile.region === 'mexico' ? 'cdmx' : 'madrid'), citiesVisited: raw.profile.citiesVisited ?? [] } : null,
    version: STATE_VERSION,
  };
}

export function emptyDay(date: string): DayStats {
  return {
    date,
    activeSeconds: 0,
    listeningSeconds: 0,
    speakingAttempts: 0,
    exercisesAttempted: 0,
    exercisesCorrect: 0,
    lessonsCompleted: 0,
    scenesCompleted: [],
    verbsPracticed: [],
    tensesPracticed: [],
    newVocab: [],
    reviewsDue: 0,
    retentionAttempts: 0,
    retentionCorrect: 0,
    techniquesUsed: [],
    mistakes: [],
  };
}

export function updateDay(state: AppState, fn: (d: DayStats) => DayStats, now = Date.now()): AppState {
  const key = dayKey(now);
  const day = state.days[key] ?? emptyDay(key);
  return { ...state, days: { ...state.days, [key]: fn(day) } };
}

const addUnique = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr : [...arr, v]);

export interface AttemptInput {
  key: string;
  grade: Grade;
  exerciseType: string;
  verb?: string;
  tense?: string;
  mistake?: { expected: string; given: string; category: ErrorCategory; context: string };
  /** Count toward the day's exercise totals (false for warm-up re-tries). */
  counts?: boolean;
}

/** Applies one graded attempt: SRS, retention, technique effectiveness, daily stats. */
export function recordAttempt(state: AppState, a: AttemptInput, now = Date.now()): AppState {
  const prev = state.srs[a.key] ?? newCard(a.key, now);
  const delayed = isDelayedReview(prev, now);
  let techniqueStats = state.techniqueStats;
  let pending = prev.pendingTechnique;
  if (pending && now - pending.at >= 12 * 3_600_000) {
    const t = techniqueStats[pending.technique];
    techniqueStats = {
      ...techniqueStats,
      [pending.technique]: { ...t, delayedAttempts: t.delayedAttempts + 1, delayedRecalled: t.delayedRecalled + (a.grade >= 2 ? 1 : 0) },
    };
    pending = undefined;
  }
  const card = { ...review(prev, a.grade, now), pendingTechnique: pending };
  const correct = a.grade > 0;
  const es = state.exerciseStats[a.exerciseType] ?? { attempts: 0, correct: 0 };

  let next: AppState = {
    ...state,
    srs: { ...state.srs, [a.key]: card },
    techniqueStats,
    exerciseStats: { ...state.exerciseStats, [a.exerciseType]: { attempts: es.attempts + 1, correct: es.correct + (correct ? 1 : 0) } },
  };
  next = updateDay(
    next,
    (d) => {
      const mistakes: MistakeRecord[] = a.mistake ? [...d.mistakes, { at: now, key: a.key, ...a.mistake }].slice(-200) : d.mistakes;
      return {
        ...d,
        exercisesAttempted: d.exercisesAttempted + (a.counts === false ? 0 : 1),
        exercisesCorrect: d.exercisesCorrect + (a.counts === false ? 0 : correct ? 1 : 0),
        verbsPracticed: a.verb ? addUnique(d.verbsPracticed, a.verb) : d.verbsPracticed,
        tensesPracticed: a.tense ? addUnique(d.tensesPracticed, a.tense) : d.tensesPracticed,
        retentionAttempts: d.retentionAttempts + (delayed ? 1 : 0),
        retentionCorrect: d.retentionCorrect + (delayed && a.grade >= 2 ? 1 : 0),
        mistakes,
      };
    },
    now,
  );
  return next;
}

/** Records a mistake that is not tied to an SRS card (e.g. a dialogue choice). */
export function recordMistake(state: AppState, m: Omit<MistakeRecord, 'at'>, now = Date.now()): AppState {
  return updateDay(state, (d) => ({ ...d, mistakes: [...d.mistakes, { ...m, at: now }].slice(-200) }), now);
}

export function applyTechnique(state: AppState, key: string, technique: MemoryTechnique, now = Date.now()): AppState {
  const card = state.srs[key] ?? newCard(key, now);
  const t = state.techniqueStats[technique];
  const next: AppState = {
    ...state,
    srs: { ...state.srs, [key]: { ...card, pendingTechnique: { technique, at: now } } },
    techniqueStats: { ...state.techniqueStats, [technique]: { ...t, used: t.used + 1 } },
  };
  return updateDay(next, (d) => ({ ...d, techniquesUsed: addUnique(d.techniquesUsed, technique) }), now);
}

/** Adds vocab cards to the learner's deck (new words only). */
export function addToDeck(state: AppState, keys: string[], now = Date.now()): AppState {
  const fresh = keys.filter((k) => !state.srs[k]);
  if (!fresh.length) return state;
  const srs = { ...state.srs };
  for (const k of fresh) srs[k] = newCard(k, now);
  return updateDay(
    { ...state, srs },
    (d) => ({ ...d, newVocab: [...d.newVocab, ...fresh.filter((k) => k.startsWith('vocab:')).map((k) => k.slice(6))] }),
    now,
  );
}

export function completeScene(
  state: AppState,
  sceneId: string,
  score: number,
  relDeltas: Record<string, number>,
  flags: Record<string, string>,
  now = Date.now(),
): AppState {
  const relationships = { ...state.story.relationships };
  for (const [c, d] of Object.entries(relDeltas)) relationships[c] = Math.max(0, Math.min(100, (relationships[c] ?? 10) + d));
  const next: AppState = {
    ...state,
    story: {
      completedScenes: addUnique(state.story.completedScenes, sceneId),
      relationships,
      flags: { ...state.story.flags, ...flags },
      sceneScores: { ...state.story.sceneScores, [sceneId]: Math.max(score, state.story.sceneScores[sceneId] ?? 0) },
    },
  };
  return updateDay(next, (d) => ({ ...d, scenesCompleted: addUnique(d.scenesCompleted, sceneId), lessonsCompleted: d.lessonsCompleted + 1 }), now);
}

export function completeLesson(state: AppState, now = Date.now()): AppState {
  return updateDay(state, (d) => ({ ...d, lessonsCompleted: d.lessonsCompleted + 1 }), now);
}

export function addActiveSeconds(state: AppState, seconds: number, listening: boolean, now = Date.now()): AppState {
  return updateDay(
    state,
    (d) => ({ ...d, activeSeconds: d.activeSeconds + seconds, listeningSeconds: d.listeningSeconds + (listening ? seconds : 0) }),
    now,
  );
}

export function addSpeakingAttempt(state: AppState, now = Date.now()): AppState {
  return updateDay(state, (d) => ({ ...d, speakingAttempts: d.speakingAttempts + 1 }), now);
}
