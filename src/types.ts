// ───────────────────────────────────────────────────────────────
// VIVA domain model. Everything persisted lives in `AppState`.
// ───────────────────────────────────────────────────────────────

export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export const CEFR_LEVELS: Cefr[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export type Skill = 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'speaking' | 'verbs';
export const SKILLS: Skill[] = ['vocabulary', 'grammar', 'reading', 'listening', 'speaking', 'verbs'];

export type Region = 'spain' | 'mexico' | 'argentina' | 'colombia';

export type Activity = 'visual' | 'audio' | 'speaking' | 'writing' | 'stories' | 'games';

export type Interest =
  | 'food'
  | 'football'
  | 'fitness'
  | 'music'
  | 'art'
  | 'tech'
  | 'travel'
  | 'nightlife'
  | 'reading'
  | 'cinema'
  | 'nature';

export type Difficulty =
  | 'verbs'
  | 'listening'
  | 'speaking'
  | 'ser-estar'
  | 'genders'
  | 'vocabulary'
  | 'pronunciation'
  | 'confidence';

export type Reason = 'relocation' | 'career' | 'partner' | 'friends' | 'travel' | 'heritage' | 'challenge';

export interface VoiceNote {
  id: string; // key in the recordings store
  questionId: string;
  transcript?: string;
  createdAt: number;
}

export interface LearnerProfile {
  name: string;
  /** Grammatical agreement Spanish should use for the learner (cansado / cansada). 'x' shows both. */
  gender: 'm' | 'f' | 'x';
  proficiencySelf: 'none' | 'few-words' | 'basic' | 'conversational' | 'advanced';
  destinationCountry: string;
  destinationCity: string;
  relocation: 'moving-soon' | 'within-year' | 'someday' | 'already-there' | 'not-moving';
  interests: Interest[];
  career: string;
  socialGoals: ('friends' | 'dating' | 'colleagues' | 'neighbours' | 'family')[];
  reasons: Reason[];
  dailyMinutes: number;
  activities: Activity[];
  difficulties: Difficulty[];
  hasTeacher: boolean;
  region: Region;
  /** The city the learner is living in (drives theme, story and variety). */
  city: import('./data/storyTypes').CityId;
  /** Cities the learner has lived in (passport stamps). */
  citiesVisited: import('./data/storyTypes').CityId[];
  /** Free-text notes the learner gave in typed / voice answers, keyed by question. */
  notes: Record<string, string>;
  voiceNotes: VoiceNote[];
  levels: Record<Skill, Cefr>;
  levelSource: 'zero' | 'self-selected' | 'assessment';
  levelOverridden: boolean;
  createdAt: number;
}

export interface TeacherInfo {
  name: string;
  email: string;
}

export interface Settings {
  streaksEnabled: boolean;
  guideVoice: boolean;
  showTranslations: 'always' | 'on-tap';
  speechRate: number; // 0.6–1.1
  sound: boolean;
}

/** Spaced-repetition card. Keys: `verb:hablar|present|0` or `vocab:cafe`. */
export interface SrsCard {
  key: string;
  ease: number;
  intervalDays: number;
  due: number; // epoch ms
  reps: number;
  lapses: number;
  attempts: number;
  correct: number;
  lastSeen: number;
  introducedAt: number;
  /** Last memory technique the learner used on this card (for delayed-recall tracking). */
  pendingTechnique?: { technique: MemoryTechnique; at: number };
}

export type MemoryTechnique =
  | 'first-letters'
  | 'association'
  | 'mnemonic'
  | 'origin'
  | 'visual'
  | 'story'
  | 'personal';

export interface TechniqueStats {
  used: number;
  delayedAttempts: number;
  delayedRecalled: number;
}

export type ErrorCategory =
  | 'accents'
  | 'person-agreement'
  | 'stem-change'
  | 'irregular-yo'
  | 'irregular-verb'
  | 'ser-estar'
  | 'register'
  | 'vocabulary'
  | 'spelling'
  | 'auxiliary'
  | 'voseo'
  | 'other';

export interface MistakeRecord {
  at: number;
  key: string;
  expected: string;
  given: string;
  category: ErrorCategory;
  context: string;
}

export interface DayStats {
  date: string; // YYYY-MM-DD (local)
  activeSeconds: number;
  listeningSeconds: number;
  speakingAttempts: number;
  exercisesAttempted: number;
  exercisesCorrect: number;
  lessonsCompleted: number;
  scenesCompleted: string[];
  verbsPracticed: string[];
  tensesPracticed: string[];
  newVocab: string[];
  reviewsDue: number;
  retentionAttempts: number;
  retentionCorrect: number;
  techniquesUsed: MemoryTechnique[];
  mistakes: MistakeRecord[];
}

export interface StoryState {
  completedScenes: string[];
  relationships: Record<string, number>; // characterId → 0..100
  flags: Record<string, boolean | string>;
  /** Scene id → best performance (0..1). */
  sceneScores: Record<string, number>;
}

export interface AchievementUnlock {
  id: string;
  at: number;
}

export interface AppState {
  version: number;
  profile: LearnerProfile | null;
  onboardingDone: boolean;
  teacher: TeacherInfo;
  settings: Settings;
  srs: Record<string, SrsCard>;
  days: Record<string, DayStats>;
  story: StoryState;
  achievements: AchievementUnlock[];
  techniqueStats: Record<MemoryTechnique, TechniqueStats>;
  /** Exercise-type performance, used to adapt practice mix. */
  exerciseStats: Record<string, { attempts: number; correct: number }>;
  seenRecapWeek?: string;
  /** Learner-written personal memory associations, keyed by card key. */
  associations: Record<string, string>;
  /** Arcade records per game id. */
  games: Record<string, { best: number; plays: number; lastAt: number; bestCombo: number }>;
}

export const STATE_VERSION = 1;
