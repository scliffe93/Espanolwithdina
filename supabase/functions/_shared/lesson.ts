// ───────────────────────────────────────────────────────────────
// The lesson room. A teacher plans a lesson as a list of blocks,
// presents it (on a shared screen) and opens blocks to the student
// one at a time; the student, on their own device, sees only what has
// been opened, follows the block the teacher is on, and answers.
//
// Two records, so the two sides never overwrite each other:
//   • the plan  (kind 'lesson')      written only by the teacher
//   • the work  (kind 'lessonwork')  the student's answers and when
//     they were last seen, written only by the server for the student
//
// This file is the rule book both the server and the demo use: what
// a student is allowed to see, and how an answer is checked.
// ───────────────────────────────────────────────────────────────

export type BlockType = 'text' | 'question' | 'choice' | 'gap' | 'vocab';

export interface LessonBlock {
  id: string;
  type: BlockType;
  title: string;
  /** text: what to read. question / choice: the question. gap: a sentence with ___ where the answer goes. */
  body: string;
  /** choice: the options. */
  options?: string[];
  /** choice: the right option. gap: the right answer (alternatives separated by "|"). */
  answer?: string;
  /** vocab: the words. */
  pairs?: { es: string; en: string }[];
  /** Opened to the student. Until then they do not see it at all. */
  open?: boolean;
  /** The teacher has shown the right answer (choice and gap). */
  reveal?: boolean;
}

export interface LessonPlan {
  id: string;
  teacherId: string;
  studentId: string;
  title: string;
  /** The day of the lesson (YYYY-MM-DD), for sorting and the student's list. */
  date?: string;
  /** The teacher's own notes. Never sent to the student. */
  notes?: string;
  blocks: LessonBlock[];
  /** `on`: the lesson is running. `current`: the block the teacher is on, which the student's screen follows. */
  live: { on: boolean; current: string | null; startedAt?: string };
  createdAt: string;
  updatedAt: string;
}

export interface LessonAnswer { value: string; at: string; correct?: boolean }
export interface LessonWork {
  id: string;
  lessonId: string;
  studentId: string;
  answers: Record<string, LessonAnswer>;
  /** When the student's device last asked for the lesson: how the teacher knows they are there. */
  seenAt?: string;
  updatedAt: string;
}

export const workId = (lessonId: string) => `${lessonId}-work`;
export const emptyWork = (lessonId: string, studentId: string, at: string): LessonWork => ({ id: workId(lessonId), lessonId, studentId, answers: {}, updatedAt: at });

const fold = (t: string) => t.trim().toLowerCase().replace(/[.,;:!?¡¿]+/g, '').replace(/\s+/g, ' ');
const plain = (t: string) => fold(t).normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Is this answer right? `undefined` for blocks a person has to judge (open questions). */
export function checkBlock(block: LessonBlock, value: string): boolean | undefined {
  if (block.type === 'choice') return !!block.answer && value === block.answer;
  if (block.type === 'gap') { const wanted = (block.answer ?? '').split('|').map(fold).filter(Boolean); return wanted.length ? wanted.includes(fold(value)) || wanted.map(plain).includes(plain(value)) : undefined; }
  return undefined;
}

/**
 * The plan as the student may see it: only opened blocks, no teacher notes, and the right answer to a block only
 * once they have answered it or the teacher has shown it.
 */
export function studentView(plan: LessonPlan, work: LessonWork | null): LessonPlan {
  const blocks = plan.blocks.filter((b) => b.open).map((b) => {
    const answered = !!work?.answers[b.id];
    if (b.answer === undefined || answered || b.reveal) return b;
    const { answer: _hidden, ...rest } = b;
    return rest as LessonBlock;
  });
  const current = plan.live.current && blocks.some((b) => b.id === plan.live.current) ? plan.live.current : null;
  const { notes: _notes, ...rest } = plan;
  return { ...rest, blocks, live: { ...plan.live, current } };
}

/** Is the student in the room right now? Their device asks every couple of seconds while the lesson page is open. */
export function isPresent(work: LessonWork | null | undefined, now: number, withinMs = 12_000): boolean {
  return !!work?.seenAt && now - Date.parse(work.seenAt) < withinMs;
}

/** Tidies a plan a browser sent before it is stored: sizes are capped and ids must be unique. */
export function cleanPlan(input: Record<string, unknown>): { blocks: LessonBlock[]; title: string; notes: string; date: string; live: LessonPlan['live'] } {
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
  const seen = new Set<string>();
  const blocks = (Array.isArray(input.blocks) ? input.blocks : []).slice(0, 60).map((raw): LessonBlock | null => {
    const b = (raw ?? {}) as Record<string, unknown>;
    const id = str(b.id, 40), type = str(b.type, 12) as BlockType;
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(id) || seen.has(id) || !['text', 'question', 'choice', 'gap', 'vocab'].includes(type)) return null;
    seen.add(id);
    return {
      id, type, title: str(b.title, 140), body: str(b.body, 4000),
      ...(type === 'choice' ? { options: (Array.isArray(b.options) ? b.options : []).slice(0, 6).map((o) => str(o, 200)).filter(Boolean) } : {}),
      ...(type === 'choice' || type === 'gap' ? { answer: str(b.answer, 300) } : {}),
      ...(type === 'vocab' ? { pairs: (Array.isArray(b.pairs) ? b.pairs : []).slice(0, 40).map((p) => ({ es: str((p as Record<string, unknown>)?.es, 120), en: str((p as Record<string, unknown>)?.en, 120) })).filter((p) => p.es || p.en) } : {}),
      ...(b.open === true ? { open: true } : {}), ...(b.reveal === true ? { reveal: true } : {}),
    };
  }).filter((b): b is LessonBlock => !!b);
  const live = (input.live ?? {}) as Record<string, unknown>;
  const current = str(live.current, 40);
  return { blocks, title: str(input.title, 140).trim() || 'Lesson', notes: str(input.notes, 6000), date: /^\d{4}-\d{2}-\d{2}$/.test(str(input.date, 10)) ? str(input.date, 10) : '', live: { on: live.on === true, current: blocks.some((b) => b.id === current) ? current : null, ...(str(live.startedAt, 30) ? { startedAt: str(live.startedAt, 30) } : {}) } };
}
