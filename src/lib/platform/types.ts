// ───────────────────────────────────────────────────────────────
// Learning with Dina — teaching platform data model.
// Shared by the local demo workspace (IndexedDB) and the cloud backend.
// All timestamps are ISO-8601 strings in UTC; `tz` records the IANA
// zone a lesson was scheduled in, so it can be shown as intended.
// ───────────────────────────────────────────────────────────────

import type { Cefr } from '../../types';
import type { Tense } from '../../data/verbs';
import type { MaterialSet } from '../material';
import type { GrammarMode } from '../../data/grammar';

export type Role = 'student' | 'teacher' | 'admin';

export interface Person {
  id: string;
  username: string;
  firstName: string;
  role: Role;
  /** True for the prototype's fictional people (Dina, Sam, Anneka). */
  demo?: boolean;
}

export type BookingFormat = 'online' | 'in-person';
export type BookingStatus = 'scheduled' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  teacherId: string;
  studentId: string;
  startsAt: string;
  durationMin: number;
  tz: string;
  format: BookingFormat;
  /** Meeting link (online) or address (in person). */
  location: string;
  topic: string;
  prepNotes: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

export type BookingInput = Omit<Booking, 'id' | 'teacherId' | 'status' | 'createdAt' | 'updatedAt'>;

export type HomeworkKind = 'vocabulary' | 'verbs' | 'grammar' | 'speaking' | 'listening' | 'story' | 'written' | 'material';

/** What the student actually does — maps onto an existing activity in the app. */
export interface HomeworkActivity {
  kind: HomeworkKind;
  title: string;
  /** verbs / grammar: infinitives to drill (empty = let the app choose). */
  verbs?: string[];
  tense?: Tense;
  /** grammar: which drill (ser vs estar, por vs para, preterite vs imperfect, subjunctive, if-sentences). */
  mode?: GrammarMode;
  /** story: a scene id (e.g. 'piso', 'val-piso'). */
  sceneId?: string;
  /** listening / vocabulary: an arcade game. */
  game?: 'metro' | 'order' | 'swipe' | 'serestar' | 'penalty' | 'derbi' | 'lineup';
  /** vocabulary: review the memory deck. */
  review?: boolean;
  /** vocabulary: a level word pack to add to the deck and review (VOCAB_PACKS id). */
  pack?: string;
  /** written / speaking: the prompt the student answers. */
  prompt?: string;
  /** written: minimum words; speaking: expect a recording. */
  minWords?: number;
  /** material: exercises built from the teacher's own document or text. */
  material?: MaterialSet;
}

export type HomeworkStatus = 'assigned' | 'submitted' | 'reviewed';

/** One answer the student gave inside an activity, kept so the teacher can go through the work item by item. */
export interface ResultItem {
  /** What was asked: a pronoun and verb, a sentence with a gap, a word to recall, a line to reply to. */
  prompt: string;
  /** The right answer, when the activity knows it. */
  expected?: string;
  /** What the student answered. */
  given: string;
  correct: boolean;
  /** The app's diagnosis of the slip (an ErrorCategory) when wrong. */
  category?: string;
}

export interface HomeworkResult {
  completedAt: string;
  /** 0..1 when the activity scores itself. */
  score?: number;
  attempts?: number;
  correct?: number;
  /** Short machine-made summary, e.g. "9/12 correct · mixed up ser/estar twice". */
  summary?: string;
  /** Written answer (written / speaking homework). */
  text?: string;
  /** Recording id in the device's IndexedDB (speaking homework; stays on the device). */
  recordingId?: string;
  /** The answers, in order (capped at 60), for the teacher's marking. */
  items?: ResultItem[];
}

/** The teacher's note on one answer in the result's item list. */
export interface MarkedItem {
  /** Index into HomeworkResult.items. */
  index: number;
  /** Overrides the app's verdict when set (the teacher accepts an answer the app rejected, or the reverse). */
  ok?: boolean;
  comment?: string;
}

/** A correction to a passage of written or spoken work. */
export interface Correction {
  /** The student's words, quoted exactly. */
  quote: string;
  /** What it should be. */
  correction: string;
  note?: string;
  category?: FocusTag;
}

/** The teacher's marking of one piece of homework. */
export interface Marking {
  at: string;
  /** The teacher's mark, 0..1 (shown as a percentage). */
  score?: number;
  /** A free grade label such as "B+" or "8/10". */
  grade?: string;
  items?: MarkedItem[];
  corrections?: Correction[];
}

export interface Homework {
  id: string;
  teacherId: string;
  studentId: string;
  activity: HomeworkActivity;
  instructions: string;
  assignedAt: string;
  dueAt: string;
  status: HomeworkStatus;
  result?: HomeworkResult;
  feedback?: { body: string; at: string };
  /** The teacher's marking (score or grade, per-answer notes, corrections). */
  marking?: Marking;
  /** Set when the item belongs to a generated weekly plan; `adaptive` marks items the app added from results. */
  plan?: { week: string; goal?: string; day?: number; adaptive?: 'retry' | 'stretch'; sourceId?: string };
}

export type FeedbackKind = 'comment' | 'correction' | 'recommendation' | 'debrief';

/** Things a lesson can surface that the week's work should target. */
export type FocusTag = 'person-agreement' | 'accents' | 'stem-change' | 'irregular-verbs' | 'ser-estar' | 'vocabulary' | 'listening' | 'speaking' | 'pronunciation' | 'spelling' | 'confidence' | 'gender-agreement' | 'tense-choice' | 'prepositions' | 'word-order' | 'punctuation';
export const FOCUS_TAG_LABEL: Record<FocusTag, string> = {
  'person-agreement': 'Verb endings (person agreement)', accents: 'Accents', 'stem-change': 'Stem changes (e→ie, o→ue)', 'irregular-verbs': 'Irregular verbs', 'ser-estar': 'Ser vs estar',
  vocabulary: 'Vocabulary', listening: 'Listening', speaking: 'Speaking', pronunciation: 'Pronunciation', spelling: 'Spelling / writing', confidence: 'Confidence',
  'gender-agreement': 'Gender and number agreement', 'tense-choice': 'Choosing the right tense', prepositions: 'Prepositions (a, de, en, por, para)', 'word-order': 'Word order', punctuation: 'Punctuation and capitals',
};

/** The teacher's notes after a lesson. Drives the generated weekly plan. */
export interface LessonDebrief {
  lessonDate: string; // YYYY-MM-DD
  covered: { tenses: Tense[]; verbs: string[]; themes: string[]; sceneId?: string };
  wentWell: string;
  toFix: FocusTag[];
  goals: string[];
  minutesPerDay: number;
  /** Week the plan was generated for (YYYY-MM-DD of its Monday). */
  planWeek: string;
}

export interface Feedback {
  id: string;
  teacherId: string;
  studentId: string;
  kind: FeedbackKind;
  body: string;
  createdAt: string;
  /** Present when kind = 'debrief'. */
  debrief?: LessonDebrief;
}

export type ActivityType = 'chapter' | 'practice' | 'game' | 'review' | 'homework' | 'lesson' | 'login';

/** A line in "recent student activity". */
export interface ActivityEvent {
  id: string;
  studentId: string;
  at: string;
  type: ActivityType;
  label: string;
}

// ── Invoicing ────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void';

export interface InvoiceLine {
  description: string;
  qty: number;
  /** In the invoice currency, per unit. */
  unitPrice: number;
  /** The lesson this line bills, if any (prevents double billing). */
  bookingId?: string;
}

export interface Invoice {
  id: string;
  teacherId: string;
  studentId: string;
  /** e.g. "LWD-2026-0007". */
  number: string;
  issuedAt: string; // YYYY-MM-DD
  dueAt: string; // YYYY-MM-DD
  currency: string; // ISO 4217, e.g. GBP, EUR
  lines: InvoiceLine[];
  /** Absolute discount in the invoice currency. */
  discount: number;
  total: number;
  status: InvoiceStatus;
  paidAt?: string; // YYYY-MM-DD
  paymentMethod?: string;
  notes?: string;
  paymentInstructions?: string;
  createdAt: string;
  updatedAt: string;
}

/** A lesson package the teacher sells: N lessons of M minutes for a price. */
export interface LessonPackage {
  id: string;
  name: string;
  lessons: number;
  minutesPerLesson: number;
  price: number;
  /** Months the package stays valid after purchase (0 = no expiry). */
  validMonths: number;
}

/** A package bought by a student: credits that taught lessons consume. */
export interface Credit {
  id: string;
  teacherId: string;
  studentId: string;
  packageId?: string;
  name: string;
  lessons: number;
  minutesPerLesson: number;
  price: number;
  currency: string;
  purchasedAt: string; // YYYY-MM-DD
  expiresAt?: string; // YYYY-MM-DD
  invoiceId?: string;
  note?: string;
  createdAt: string;
}

/** The teacher's invoicing settings (one row, hers). */
export interface TeacherConfig {
  businessName: string;
  address: string;
  currency: string;
  /** Default rate for a 60-minute lesson. */
  hourlyRate: number;
  /** Days until an invoice is due. */
  dueDays: number;
  invoicePrefix: string;
  nextNumber: number;
  paymentInstructions: string;
  footer: string;
  /** Packages the teacher offers. */
  packages: LessonPackage[];
}

export const DEFAULT_TEACHER_CONFIG: TeacherConfig = { businessName: 'Learning with Dina', address: '', currency: 'GBP', hourlyRate: 35, dueDays: 14, invoicePrefix: 'LWD', nextNumber: 1, paymentInstructions: '', footer: 'Thank you — ¡gracias!', packages: [] };

/** What a student may open on their own, set by the teacher from the student's profile. One row per student. */
export interface StudentSettings {
  /** `student-<studentId>` */
  id: string;
  studentId: string;
  teacherId?: string;
  /** Highest CEFR level of work the student can open by themselves (null = no ceiling). Homework the teacher assigns is always available. */
  maxLevel: Cefr | null;
  note?: string;
  /** Gradual release: when true the student's own practice only uses the verb and word blocks in `unlocked` (see data/blocks.ts). */
  stepped?: boolean;
  /** Released block ids. */
  unlocked?: string[];
  updatedAt: string;
}

/** Everything the teaching side stores (besides each learner's own AppState). */
export interface PlatformData {
  version: 1;
  people: Person[];
  bookings: Booking[];
  homework: Homework[];
  feedback: Feedback[];
  activity: ActivityEvent[];
  invoices?: Invoice[];
  config?: TeacherConfig;
  credits?: Credit[];
  students?: StudentSettings[];
}

export const DEMO_TEACHER_ID = 'demo-dina';
export const DEMO_STUDENT_IDS = { sam: 'demo-sam', anneka: 'demo-anneka' } as const;

export const HOMEWORK_KIND_LABEL: Record<HomeworkKind, string> = {
  vocabulary: 'Vocabulary practice',
  verbs: 'Verb conjugation',
  grammar: 'Grammar exercise',
  speaking: 'Speaking challenge',
  listening: 'Listening comprehension',
  story: 'Storyline chapter',
  written: 'Written homework',
  material: 'From your lesson material',
};
