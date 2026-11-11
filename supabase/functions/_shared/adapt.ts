// ───────────────────────────────────────────────────────────────
// Adaptation rules shared by the server (Edge Function) and the app.
// Pure functions over plain JSON, no imports, so the same rule runs
// wherever a homework result is recorded.
//
// When a plan item is submitted:
//  • score < 0.6 → a shorter "re-try" of the same activity two days later
//    (once per item, never for a re-try itself);
//  • score ≥ 0.9 and the item is a verb drill → a "stretch" item: the next
//    tense (present → progressive → perfect) with the same verbs;
//  • anything else → nothing.
// ───────────────────────────────────────────────────────────────

export interface AdaptHomework {
  id: string;
  teacherId: string;
  studentId: string;
  activity: { kind: string; title: string; verbs?: string[]; tense?: string; [k: string]: unknown };
  instructions: string;
  assignedAt: string;
  dueAt: string;
  status: string;
  result?: { score?: number; completedAt?: string; [k: string]: unknown };
  plan?: { week: string; goal?: string; day?: number; adaptive?: 'retry' | 'stretch'; sourceId?: string };
}

const NEXT_TENSE: Record<string, string | undefined> = { present: 'progressive', progressive: 'perfect', perfect: 'preterite', preterite: 'imperfect', imperfect: 'future', future: 'conditional', conditional: 'subjunctive', subjunctive: 'imperfect-subjunctive', 'imperfect-subjunctive': undefined, imperative: undefined };
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
/** Lowest level each tense is recommended from (mirrors TENSES in src/data/verbs.ts). */
const TENSE_MIN_LEVEL: Record<string, string> = { present: 'A1', progressive: 'A2', perfect: 'A2', preterite: 'A2', imperfect: 'A2', imperative: 'A2', future: 'B1', conditional: 'B1', subjunctive: 'B1', 'imperfect-subjunctive': 'B2' };

/**
 * Returns the follow-up homework to create for a submitted item, or null. `id` must be supplied by the caller.
 * `opts.maxLevel` is the student's level ceiling set by the teacher: no stretch task is created above it.
 */
export function followUpFor(h: AdaptHomework, nowIso: string, id: string, opts: { maxLevel?: string | null } = {}): AdaptHomework | null {
  if (!h.plan || h.plan.adaptive === 'retry') return null;
  const score = typeof h.result?.score === 'number' ? h.result.score : null;
  if (score === null) return null;
  const due = (days: number) => new Date(Date.parse(nowIso) + days * 86_400_000).toISOString();
  if (score < 0.6) {
    const verbs = Array.isArray(h.activity.verbs) ? h.activity.verbs.slice(0, 3) : undefined;
    return {
      id, teacherId: h.teacherId, studentId: h.studentId, status: 'assigned', assignedAt: nowIso, dueAt: due(2),
      activity: { ...h.activity, title: `Re-try: ${h.activity.title}`, ...(verbs ? { verbs } : {}) },
      instructions: `A shorter go at this one: ${Math.round(score * 100)}% last time. Take it slowly and use "Help me remember" when you are unsure.`,
      plan: { week: h.plan.week, goal: h.plan.goal, adaptive: 'retry', sourceId: h.id },
    };
  }
  if (score >= 0.9 && h.plan.adaptive !== 'stretch' && h.activity.kind === 'verbs') {
    const next = NEXT_TENSE[String(h.activity.tense ?? 'present')];
    if (!next) return null;
    if (opts.maxLevel && LEVELS.indexOf(TENSE_MIN_LEVEL[next] ?? 'A1') > LEVELS.indexOf(opts.maxLevel)) return null;
    return {
      id, teacherId: h.teacherId, studentId: h.studentId, status: 'assigned', assignedAt: nowIso, dueAt: due(3),
      activity: { ...h.activity, tense: next, title: `Stretch: ${h.activity.title.replace(/\(([a-z -]+)\)\s*$/i, '').trim()} (${next})` },
      instructions: `${Math.round(score * 100)}% — excellent. Same verbs, next tense.`,
      plan: { week: h.plan.week, goal: h.plan.goal, adaptive: 'stretch', sourceId: h.id },
    };
  }
  return null;
}
