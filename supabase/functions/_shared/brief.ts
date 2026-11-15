// The pre-lesson brief: what a student has done since their last lesson, in a form short enough to read in the
// minute before a lesson starts. One function, used by the server (the notification to the teacher) and by the
// app (the card on the teacher's home page), so the two always agree. Pure: no database, no clock of its own.

export interface BriefDay {
  date?: string;
  activeSeconds?: number;
  exercisesAttempted?: number;
  exercisesCorrect?: number;
  verbsPracticed?: string[];
  mistakes?: { at?: number; category?: string; expected?: string; context?: string }[];
}
export interface BriefHomework { status?: string; dueAt?: string; assignedAt?: string; activity?: { title?: string }; result?: { score?: number; completedAt?: string } }

export interface Brief {
  /** Days with at least a couple of minutes of practice since the last lesson. */
  daysPractised: number;
  daysInWindow: number;
  minutes: number;
  attempts: number;
  /** 0–1, or null when nothing was attempted. */
  accuracy: number | null;
  /** The kinds of mistake made most, most frequent first. */
  mistakes: { category: string; label: string; count: number; examples: string[] }[];
  /** Verbs behind the most mistakes. */
  verbs: string[];
  homework: { done: number; pending: number; overdue: number; lastScore: number | null; overdueTitles: string[] };
  /** One or two plain sentences: the notification text. */
  line: string;
  /** What to do with the lesson, most useful first. */
  suggestions: string[];
}

const LABEL: Record<string, string> = {
  accents: 'accents', 'person-agreement': 'verb endings', 'stem-change': 'stem changes', 'irregular-yo': 'irregular "yo" forms',
  'irregular-verb': 'irregular verbs', 'ser-estar': 'ser vs estar', register: 'tú vs usted', vocabulary: 'vocabulary', spelling: 'spelling',
  auxiliary: 'estar / haber', voseo: 'vos forms', other: 'other slips',
};
const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const key = (ms: number) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

/**
 * @param days      the student's saved days (their progress data), keyed YYYY-MM-DD
 * @param homework  every homework item set for the student
 * @param since     the start of the window (their last lesson; callers fall back to a week ago)
 * @param now       the moment of the brief
 */
export function lessonBrief(days: Record<string, BriefDay> | null | undefined, homework: BriefHomework[], since: number, now: number): Brief {
  const from = Math.max(since, now - 21 * DAY); // never look further back than three weeks
  const fromKey = key(from - DAY), toKey = key(now + DAY); // a day's slack either side: days are stored in the student's local date
  const inWindow = Object.entries(days ?? {}).filter(([k]) => k >= fromKey && k <= toKey).map(([, d]) => d ?? {});
  const studied = inWindow.filter((d) => (d.activeSeconds ?? 0) >= 120);
  const minutes = Math.round(inWindow.reduce((a, d) => a + (d.activeSeconds ?? 0), 0) / 60);
  const attempts = inWindow.reduce((a, d) => a + (d.exercisesAttempted ?? 0), 0);
  const correct = inWindow.reduce((a, d) => a + (d.exercisesCorrect ?? 0), 0);

  const byCat = new Map<string, { count: number; examples: string[] }>();
  const byVerb = new Map<string, number>();
  for (const d of inWindow) for (const m of d.mistakes ?? []) {
    if (typeof m.at === 'number' && m.at < from) continue;
    const c = m.category || 'other';
    const row = byCat.get(c) ?? { count: 0, examples: [] };
    row.count++;
    if (m.expected && row.examples.length < 3 && !row.examples.includes(m.expected)) row.examples.push(m.expected);
    byCat.set(c, row);
    const verb = (m.context ?? '').split('·').pop()?.trim();
    if (verb && /^[a-záéíóúñü]+(se)?$/.test(verb) && /(ar|er|ir|ír)(se)?$/.test(verb)) byVerb.set(verb, (byVerb.get(verb) ?? 0) + 1);
  }
  const mistakes = [...byCat.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 3).map(([category, v]) => ({ category, label: LABEL[category] ?? category, count: v.count, examples: v.examples }));
  const verbs = [...byVerb.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v]) => v);

  const relevant = homework.filter((h) => { const t = Date.parse(h.assignedAt ?? '') || 0, due = Date.parse(h.dueAt ?? '') || 0; return t >= from - 14 * DAY || due >= from || h.status === 'assigned'; });
  const done = relevant.filter((h) => h.status === 'submitted' || h.status === 'reviewed');
  const open = relevant.filter((h) => h.status === 'assigned');
  const overdue = open.filter((h) => (Date.parse(h.dueAt ?? '') || Infinity) < now);
  const scored = done.filter((h) => typeof h.result?.score === 'number').sort((a, b) => (b.result!.completedAt ?? '').localeCompare(a.result!.completedAt ?? ''));
  const hw = { done: done.length, pending: open.length - overdue.length, overdue: overdue.length, lastScore: scored[0] ? scored[0].result!.score! : null, overdueTitles: overdue.map((h) => h.activity?.title ?? 'Homework').slice(0, 3) };

  const daysInWindow = Math.max(1, Math.round((now - from) / DAY));
  const accuracy = attempts ? correct / attempts : null;
  const parts: string[] = [];
  if (!studied.length && !attempts) parts.push('No practice since the last lesson.');
  else parts.push(`Practised ${studied.length} day${studied.length === 1 ? '' : 's'}, ${minutes} min${accuracy !== null ? `, ${Math.round(accuracy * 100)}% correct` : ''}.`);
  if (mistakes[0]) parts.push(`Keeps slipping on ${mistakes.slice(0, 2).map((m) => m.label).join(' and ')}${verbs.length ? ` (${verbs.slice(0, 3).join(', ')})` : ''}.`);
  if (hw.overdue) parts.push(`${hw.overdue} homework overdue.`);
  else if (hw.done && !open.length) parts.push('Homework all done.');
  else if (open.length) parts.push(`${open.length} homework still to do.`);

  const suggestions: string[] = [];
  if (!studied.length && !attempts) suggestions.push('Start with a warm-up: nothing has been practised since last time.');
  if (mistakes[0]) suggestions.push(`Spend five minutes on ${mistakes[0].label}${mistakes[0].examples.length ? `: ${mistakes[0].examples.join(', ')}` : ''}.`);
  if (verbs.length) suggestions.push(`Use these verbs in conversation: ${verbs.join(', ')}.`);
  if (hw.overdue) suggestions.push(`Ask about the overdue homework: ${hw.overdueTitles.join('; ')}.`);
  if (accuracy !== null && accuracy >= 0.85 && attempts >= 20) suggestions.push('Accuracy is high: this is a good week to introduce something new.');

  return { daysPractised: studied.length, daysInWindow, minutes, attempts, accuracy, mistakes, verbs, homework: hw, line: parts.join(' '), suggestions };
}

/** Consecutive days of practice ending on `today` (or the day before, if today has none yet). Days are YYYY-MM-DD keys. */
export function streakOf(days: Record<string, BriefDay> | null | undefined, today: string): number {
  const studied = (k: string) => ((days ?? {})[k]?.activeSeconds ?? 0) >= 60;
  const back = (k: string) => key(Date.parse(`${k}T12:00:00Z`) - DAY);
  let d = studied(today) ? today : back(today), n = 0;
  while (studied(d)) { n++; d = back(d); }
  return n;
}
