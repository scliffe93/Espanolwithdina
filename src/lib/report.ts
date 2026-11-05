import type { AppState, Cefr, ErrorCategory, MemoryTechnique, Skill } from '../types';
import { SCENE_BY_ID } from '../data/story';
import { CITY_THEMES } from '../data/cityThemes';
import { TENSES, VERB_BY_INF } from '../data/verbs';
import { VOCAB_BY_ID, vocabForm } from '../data/vocab';
import { allVerbMastery, previousWeek, thisWeek, weekSummary, type VerbMastery, type WeekSummary } from './analytics';
import { CATEGORY_LABEL } from './answer';
import { addDays, formatMinutes, formatRange, weekStart } from './dates';

// Weekly teacher report. Every number comes from recorded learning data.

export const TECHNIQUE_LABEL: Record<MemoryTechnique, string> = {
  'first-letters': 'First-letter clues',
  association: 'English–Spanish associations',
  mnemonic: 'Mnemonics',
  origin: 'Word origins (etymology)',
  visual: 'Visual memory prompts',
  story: 'Memorable stories',
  personal: 'Personal associations',
};

export interface TeacherReport {
  learnerName: string;
  teacherName: string;
  rangeLabel: string;
  generatedAt: Date;
  week: WeekSummary;
  prev: WeekSummary;
  history: { label: string; minutes: number; accuracy: number | null }[];
  levels: Record<Skill, Cefr> | null;
  region: string;
  verbsPracticed: { inf: string; en: string; mastery: VerbMastery }[];
  tenses: string[];
  newVocab: string[];
  recurringErrors: { category: ErrorCategory; label: string; count: number; example?: string }[];
  strengths: string[];
  weaknesses: string[];
  techniques: { label: string; used: number; delayedRate: number | null }[];
  scenes: string[];
  priorities: string[];
  hasData: boolean;
}

function pct(n: number | null): string {
  return n === null ? '—' : `${Math.round(n * 100)}%`;
}

export function buildTeacherReport(state: AppState, now = Date.now()): TeacherReport {
  const week = thisWeek(state, now);
  const prev = previousWeek(state, now);
  const region = state.profile?.region ?? 'spain';
  const mastery = allVerbMastery(state, 'present', region);
  const masteryByInf = Object.fromEntries(mastery.map((m) => [m.inf, m]));

  const history = [3, 2, 1, 0].map((back) => {
    const start = addDays(weekStart(now), -7 * back);
    const w = weekSummary(state, start);
    return { label: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), minutes: Math.round(w.activeSeconds / 60), accuracy: w.accuracy };
  });

  // Examples of each error category from this week
  const weekMistakes = week.dayKeys.flatMap((k) => state.days[k]?.mistakes ?? []);
  const recurringErrors = week.mistakesByCategory.map(([category, count]) => {
    const ex = weekMistakes.find((m) => m.category === category);
    return {
      category,
      label: CATEGORY_LABEL[category],
      count,
      example: ex ? `expected "${ex.expected}", wrote "${ex.given}"` : undefined,
    };
  });

  const practiced = week.verbsPracticed.map((inf) => ({ inf, en: VERB_BY_INF[inf]?.en ?? '', mastery: masteryByInf[inf] }));
  const withAcc = practiced.filter((v) => v.mastery && v.mastery.attempts >= 3);
  const strongVerbs = withAcc.filter((v) => (v.mastery.accuracy ?? 0) >= 0.85).map((v) => v.inf);
  const weakVerbs = withAcc.filter((v) => (v.mastery.accuracy ?? 1) < 0.7).map((v) => v.inf);

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (strongVerbs.length) strengths.push(`Accurate with ${strongVerbs.slice(0, 6).join(', ')} (≥85% this week).`);
  if (week.accuracy !== null && week.accuracy >= 0.8) strengths.push(`High overall accuracy: ${pct(week.accuracy)}.`);
  if (week.retention !== null && week.retention >= 0.75) strengths.push(`Good delayed recall: ${pct(week.retention)} of items remembered after 12+ hours.`);
  if (week.studyDays >= 4) strengths.push(`Consistent: studied on ${week.studyDays} days.`);
  if (week.speakingAttempts >= 5) strengths.push(`Active speaking practice: ${week.speakingAttempts} recordings.`);
  if (weakVerbs.length) weaknesses.push(`Low accuracy with ${weakVerbs.slice(0, 6).join(', ')}.`);
  for (const e of recurringErrors.slice(0, 2)) if (e.count >= 2) weaknesses.push(`${e.label} (${e.count} times).`);
  if (week.retention !== null && week.retention < 0.6) weaknesses.push(`Delayed recall is ${pct(week.retention)} — material fades between sessions.`);
  if (week.speakingAttempts === 0 && week.activeSeconds > 0) weaknesses.push('No speaking recordings this week.');

  const priorities: string[] = [];
  const topErr = recurringErrors.find((e) => e.category !== 'other' && e.category !== 'accents');
  if (topErr) priorities.push(`${topErr.label}: recurring this week (${topErr.count}×)${topErr.example ? `, e.g. ${topErr.example}` : ''}.`);
  if (weakVerbs.length) priorities.push(`Conjugation of ${weakVerbs.slice(0, 4).join(', ')} in conversation.`);
  if (week.speakingAttempts < 5) priorities.push('Spoken production — short role-plays to build confidence (in-app speaking is self-assessed).');
  const lowest = state.profile ? (Object.entries(state.profile.levels) as [Skill, Cefr][]).sort((a, b) => a[1].localeCompare(b[1]))[0] : null;
  if (lowest) priorities.push(`${lowest[0][0].toUpperCase() + lowest[0].slice(1)} (currently ${lowest[1]}, the learner's lowest skill).`);
  if (state.profile?.difficulties.includes('ser-estar') && !priorities.some((p) => p.includes('Ser'))) priorities.push('Ser vs estar (self-reported difficulty).');
  priorities.push('Review this week\'s new vocabulary in free conversation.');

  const techniques = (Object.entries(state.techniqueStats) as [MemoryTechnique, (typeof state.techniqueStats)[MemoryTechnique]][])
    .filter(([t, s]) => s.used > 0 && week.techniquesUsed.includes(t))
    .map(([t, s]) => ({ label: TECHNIQUE_LABEL[t], used: s.used, delayedRate: s.delayedAttempts ? s.delayedRecalled / s.delayedAttempts : null }));

  return {
    learnerName: state.profile?.name || 'Learner',
    teacherName: state.teacher.name,
    rangeLabel: formatRange(week.start),
    generatedAt: new Date(now),
    week,
    prev,
    history,
    levels: state.profile?.levels ?? null,
    region: `${CITY_THEMES[state.profile?.city ?? 'madrid'].varietyLabel} · ${CITY_THEMES[state.profile?.city ?? 'madrid'].name}`,
    verbsPracticed: practiced,
    tenses: week.tensesPracticed.map((t) => TENSES.find((x) => x.id === t)?.label ?? t),
    newVocab: week.newVocab.map((id) => (VOCAB_BY_ID[id] ? vocabForm(VOCAB_BY_ID[id], region) : id)),
    recurringErrors,
    strengths: strengths.length ? strengths : ['Not enough data yet this week to identify strengths.'],
    weaknesses: weaknesses.length ? weaknesses : ['No clear weaknesses recorded this week.'],
    techniques,
    scenes: week.scenesCompleted.map((id) => SCENE_BY_ID[id]?.title ?? id),
    priorities: priorities.slice(0, 3),
    hasData: week.activeSeconds > 0 || week.exercisesAttempted > 0,
  };
}

function delta(cur: number, prev: number, unit = ''): string {
  const d = cur - prev;
  if (prev === 0 && cur === 0) return '';
  return d === 0 ? ' (same as last week)' : ` (${d > 0 ? '+' : ''}${d}${unit} vs last week)`;
}

/** Plain-text summary used for the email body and the clipboard. */
export function reportText(r: TeacherReport, maxVocab = 15): string {
  const w = r.week;
  const lines = [
    `Hi${r.teacherName ? ` ${r.teacherName}` : ''},`,
    '',
    `Here is my VIVA Spanish progress for ${r.rangeLabel}:`,
    '',
    `• Active learning time: ${formatMinutes(w.activeSeconds)}${delta(Math.round(w.activeSeconds / 60), Math.round(r.prev.activeSeconds / 60), ' min')}`,
    `• Study days: ${w.studyDays} of 7`,
    `• Lessons completed: ${w.lessonsCompleted}`,
    `• Exercises: ${w.exercisesAttempted} attempted, accuracy ${pct(w.accuracy)}${r.prev.accuracy !== null && w.accuracy !== null ? ` (last week ${pct(r.prev.accuracy)})` : ''}`,
    `• Delayed recall (12h+): ${pct(w.retention)}${w.retentionAttempts ? ` of ${w.retentionAttempts} items` : ''}`,
    `• Speaking recordings: ${w.speakingAttempts}`,
    `• Verbs practised (${r.verbsPracticed.length}): ${r.verbsPracticed.map((v) => v.inf).join(', ') || '—'}`,
    `• Tenses: ${r.tenses.join(', ') || '—'}`,
    `• New vocabulary (${r.newVocab.length}): ${r.newVocab.slice(0, maxVocab).join(', ')}${r.newVocab.length > maxVocab ? '…' : ''}`,
  ];
  if (r.recurringErrors.length) {
    lines.push('', 'Recurring errors:');
    for (const e of r.recurringErrors.slice(0, 4)) lines.push(`• ${e.label}: ${e.count}×${e.example ? ` (${e.example})` : ''}`);
  }
  lines.push('', 'Suggested teaching priorities:');
  r.priorities.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  lines.push('', 'The full PDF report is available if you would like it — I can attach it separately.', '', `Thanks,`, r.learnerName);
  return lines.join('\n');
}

export function reportSubject(r: TeacherReport): string {
  return `VIVA Spanish progress — ${r.learnerName} — ${r.rangeLabel}`;
}

/** RFC 6068 mailto link with properly encoded subject and body. */
export function mailtoHref(to: string, subject: string, body: string): string {
  const enc = (s: string) => encodeURIComponent(s).replace(/%20/g, '%20');
  // Normalise line breaks to CRLF as recommended for mail bodies.
  const crlf = body.replace(/\r?\n/g, '\r\n');
  return `mailto:${encodeURIComponent(to.trim()).replace(/%40/g, '@')}?subject=${enc(subject)}&body=${enc(crlf)}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
