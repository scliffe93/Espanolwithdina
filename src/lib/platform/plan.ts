import type { AppState } from '../../types';
import { scenesForCity } from '../../data/story';
import { VERB_BY_INF } from '../../data/verbs';
import { VOCAB_PACKS } from '../../data/vocabPacks';
import { vocabKey } from '../../data/vocab';
import { CEFR_LEVELS } from '../../types';
import { allVerbMastery } from '../analytics';
import { dayKey, weekStart } from '../dates';
import type { FocusTag, HomeworkActivity, LessonDebrief } from './types';

// ───────────────────────────────────────────────────────────────
// Turns the teacher's lesson debrief into a week of homework, each item a
// real activity in the app, tailored with the student's own data: the verbs
// they actually get wrong, the next chapter of their storyline, their
// interests. The teacher reviews and edits the list before sending.
// ───────────────────────────────────────────────────────────────

export interface PlanItem { activity: HomeworkActivity; instructions: string; day: number; goal?: string }

const TENSE_LABEL: Record<string, string> = { present: 'present', progressive: 'progressive', perfect: 'perfect', preterite: 'preterite', imperfect: 'imperfect', future: 'future', conditional: 'conditional', subjunctive: 'present subjunctive', 'imperfect-subjunctive': 'imperfect subjunctive', imperative: 'commands', pluperfect: 'pluperfect', 'negative-imperative': 'negative commands', 'perfect-subjunctive': 'perfect subjunctive', 'pluperfect-subjunctive': 'pluperfect subjunctive', 'conditional-perfect': 'conditional perfect', 'future-perfect': 'future perfect' };

/** Student's weakest practised verbs (lowest accuracy, 3+ attempts), falling back to the debrief's verbs. */
function weakVerbs(state: AppState | null, fallback: string[], n = 4): string[] {
  if (!state) return fallback.slice(0, n);
  const rated = allVerbMastery(state, 'present', state.profile?.region ?? 'spain').filter((m) => m.attempts >= 3).sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));
  const weak = rated.filter((m) => (m.accuracy ?? 1) < 0.8).map((m) => m.inf);
  return [...new Set([...fallback, ...weak])].slice(0, n);
}

/** The next storyline chapter the student has not completed in their city. */
function nextScene(state: AppState | null): { id: string; title: string } | null {
  if (!state?.profile) return null;
  const s = scenesForCity(state.profile.city).find((sc) => !state.story.completedScenes.includes(sc.id));
  return s ? { id: s.id, title: s.title } : null;
}

export function generatePlan(d: LessonDebrief, state: AppState | null): PlanItem[] {
  const items: PlanItem[] = [];
  const verbs = d.covered.verbs.map((v) => v.trim().toLowerCase()).filter((v) => VERB_BY_INF[v]);
  const tense = d.covered.tenses[0] ?? 'present';
  const likesFootball = state?.profile?.interests.includes('football') ?? false;
  const fix = new Set<FocusTag>(d.toFix);
  const goal = (i: number) => d.goals[i] || d.goals[0];

  // 1. Consolidate what the lesson covered: a verb session on those verbs, in that tense.
  if (verbs.length || d.covered.tenses.length) {
    items.push({ day: 1, goal: goal(0), activity: { kind: 'verbs', title: `Verb gym: ${verbs.length ? verbs.join(', ') : 'this week’s verbs'} (${TENSE_LABEL[tense]})`, verbs, tense }, instructions: `Consolidate what we did in the lesson. Aim for 80%+; use “Help me remember” for any form that will not stick.` });
    items.push({ day: 3, goal: goal(0), activity: { kind: 'verbs', title: `Penalty Shoot-out: ${verbs.length ? verbs.join(', ') : 'your verbs'}`, game: 'penalty', verbs, tense }, instructions: 'A fast one: beat the keeper with the right forms.' });
  }
  // 2. Fix what went wrong, using the student's real weak spots.
  if (fix.has('ser-estar')) {
    items.push({ day: 2, goal: goal(1), activity: { kind: 'grammar', title: 'Ser vs estar drill', mode: 'ser-estar' }, instructions: 'Decide ser or estar in context. Think: identity/permanent vs state/location.' });
    items.push({ day: 5, goal: goal(1), activity: { kind: 'grammar', title: 'Ser o Estar game', game: 'serestar', mode: 'ser-estar' }, instructions: 'The same decision, faster.' });
  }
  if (fix.has('person-agreement') || fix.has('stem-change') || fix.has('irregular-verbs') || fix.has('accents')) {
    const wv = weakVerbs(state, verbs);
    const what = [fix.has('person-agreement') && 'verb endings', fix.has('stem-change') && 'stem changes', fix.has('irregular-verbs') && 'irregular forms', fix.has('accents') && 'accents'].filter(Boolean).join(', ');
    items.push({ day: 2, goal: goal(1), activity: { kind: 'verbs', title: `Typed drill: ${wv.join(', ')} (${TENSE_LABEL[tense]})`, verbs: wv, tense }, instructions: `Focus: ${what}. These are the verbs you most often slip on, so type each form carefully.` });
  }
  if (fix.has('prepositions')) {
    items.push({ day: 2, goal: goal(1), activity: { kind: 'grammar', title: 'Por vs para drill', mode: 'por-para' }, instructions: 'Cause, exchange and movement through take por; purpose, destination and deadlines take para.' });
  }
  if (fix.has('tense-choice')) {
    const mode = d.covered.tenses.includes('subjunctive') ? 'subjunctive' : d.covered.tenses.includes('conditional') ? 'conditional' : 'pret-imp';
    items.push({ day: 2, goal: goal(1), activity: { kind: 'grammar', title: mode === 'subjunctive' ? 'Subjunctive or not drill' : mode === 'conditional' ? 'If-sentences drill' : 'Preterite vs imperfect drill', mode }, instructions: 'Read the whole sentence before choosing: the clue is usually in the other half.' });
  } else if (d.covered.tenses.includes('subjunctive')) {
    items.push({ day: 4, goal: goal(0), activity: { kind: 'grammar', title: 'Subjunctive or not drill', mode: 'subjunctive' }, instructions: 'Wishes, doubts, emotions and purpose take the subjunctive; facts and beliefs do not.' });
  }
  if (fix.has('vocabulary')) {
    items.push({ day: 2, goal: goal(1), activity: { kind: 'vocabulary', title: 'Memory review of your deck', review: true }, instructions: 'Clear your due cards; add a personal association to anything you forgot.' });
    // A word pack at the student's level that is not in their deck yet.
    const lvl = state?.profile ? state.profile.levels.vocabulary : 'A1';
    const pack = VOCAB_PACKS.filter((p) => CEFR_LEVELS.indexOf(p.level) <= CEFR_LEVELS.indexOf(lvl)).reverse().find((p) => !state || !p.ids.every((id) => state.srs[vocabKey(id)]));
    if (pack) items.push({ day: 5, goal: goal(1), activity: { kind: 'vocabulary', title: `Word pack: ${pack.title}`, pack: pack.id }, instructions: `Ten new words on ${pack.title.toLowerCase()} (${pack.level}). Learn them, then they come back in your reviews.` });
    if (likesFootball) items.push({ day: 6, goal: goal(1), activity: { kind: 'vocabulary', title: 'The Derby Quiz', game: 'derbi' }, instructions: 'Football words the way your city says them.' });
  }
  if (fix.has('listening')) {
    items.push({ day: 4, goal: goal(1), activity: { kind: 'listening', title: likesFootball ? 'Line-up: match commentary' : 'Order Up!: listen and serve', game: likesFootball ? 'lineup' : 'order' }, instructions: 'Listen first, then act. Repeat as often as you need.' });
  }
  if (fix.has('speaking') || fix.has('pronunciation') || fix.has('confidence')) {
    const theme = d.covered.themes[0];
    items.push({ day: 4, goal: goal(2), activity: { kind: 'speaking', title: `Speak for one minute: ${theme ?? 'your week'}`, prompt: theme ? `Record one minute in Spanish about ${theme}. Use the verbs from our lesson${verbs.length ? ` (${verbs.join(', ')})` : ''}.` : 'Record one minute in Spanish about your week so far, using the verbs from our lesson.' }, instructions: fix.has('pronunciation') ? 'Listen back once and re-record the phrase you found hardest.' : 'Do not worry about mistakes; aim for a full minute.' });
  }
  if (fix.has('spelling')) {
    items.push({ day: 5, goal: goal(2), activity: { kind: 'written', title: `Write 60 words: ${d.covered.themes[0] ?? 'this week'}`, prompt: `Write about ${d.covered.themes[0] ?? 'your week'} in about 60 words, using ${verbs.length ? verbs.join(', ') : 'the verbs from our lesson'}.`, minWords: 60 }, instructions: 'Check accents and endings before you submit.' });
  }
  // 3. Keep the story moving.
  const scene = d.covered.sceneId ? null : nextScene(state);
  if (scene) items.push({ day: 6, goal: goal(0), activity: { kind: 'story', title: `Storyline: ${scene.title}`, sceneId: scene.id }, instructions: 'Your next chapter. Speak the replies out loud.' });
  // 4. Always a short review if nothing else covers it.
  if (!items.some((i) => i.activity.kind === 'vocabulary')) items.push({ day: 7, goal: goal(0), activity: { kind: 'vocabulary', title: 'Memory review', review: true }, instructions: 'Ten minutes to keep everything fresh before our next lesson.' });

  // Spread across the week, cap at 7 items, one per day where possible.
  const sorted = items.sort((a, b) => a.day - b.day).slice(0, 7);
  return sorted;
}

/** Monday of the week the plan should cover (next week if today is already Friday or later). */
export function planWeekFor(now = Date.now()): string {
  const start = weekStart(new Date(now));
  const dow = (new Date(now).getDay() + 6) % 7; // Monday = 0
  return dayKey(dow >= 4 ? new Date(start.getTime() + 7 * 86_400_000) : start);
}

/** Due date for a plan day (1 = Monday) at 20:00 local time, never earlier than tomorrow evening. */
export function dueFor(planWeek: string, day: number, now = Date.now()): string {
  const d = new Date(planWeek + 'T20:00:00');
  d.setDate(d.getDate() + Math.max(0, day - 1));
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(20, 0, 0, 0);
  return (d.getTime() < tomorrow.getTime() ? tomorrow : d).toISOString();
}
