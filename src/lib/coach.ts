import type { AppState, ErrorCategory, Interest } from '../types';
import { SCENES } from '../data/story';
import { VERB_BY_INF } from '../data/verbs';
import { allVerbMastery, dueCards, thisWeek } from './analytics';
import { CATEGORY_TIP } from './answer';

// ───────────────────────────────────────────────────────────────
// VIVA Coach — a transparent, rules-based recommender.
// Every recommendation states the evidence ("why") it is based on.
// `CoachProvider` is the seam where an optional AI provider could be
// plugged in later; no AI is used or implied in this version.
// ───────────────────────────────────────────────────────────────

export type Route =
  | { name: 'scene'; id: string }
  | { name: 'verbs'; focus?: string[]; mode?: string }
  | { name: 'review' }
  | { name: 'world' };

export interface Recommendation {
  id: string;
  title: string;
  body: string;
  why: string;
  cta: string;
  route: Route;
  priority: number; // higher first
}

export interface CoachProvider {
  readonly name: string;
  recommend(state: AppState, now: number): Recommendation[];
}

const INTEREST_CONTEXT: Partial<Record<Interest, string>> = {
  food: 'ordering at the market',
  football: 'chatting about Sunday\'s match',
  fitness: 'signing up at the gym',
  music: 'planning a night at a gig',
  art: 'a trip to the Reina Sofía',
  tech: 'small talk at a tech meetup',
  travel: 'planning a weekend in Segovia',
  nightlife: 'making plans for Friday night',
  reading: 'your book club',
  cinema: 'choosing a film',
  nature: 'a hike in the sierra',
};

function recentMistakes(state: AppState, now: number, days = 14): Map<ErrorCategory, number> {
  const since = now - days * 86_400_000;
  const out = new Map<ErrorCategory, number>();
  for (const d of Object.values(state.days)) for (const m of d.mistakes) if (m.at >= since) out.set(m.category, (out.get(m.category) ?? 0) + 1);
  return out;
}

export const rulesCoach: CoachProvider = {
  name: 'VIVA rules-based coach',
  recommend(state, now) {
    const recs: Recommendation[] = [];
    const p = state.profile;
    const region = p?.region ?? 'spain';
    const interest = p?.interests.find((i) => INTEREST_CONTEXT[i]);
    const context = interest ? INTEREST_CONTEXT[interest]! : 'everyday life in Madrid';

    // 1. Story continuation.
    const nextScene = SCENES.find((s) => !state.story.completedScenes.includes(s.id) && (!s.requires || state.story.completedScenes.includes(s.requires)));
    if (nextScene) {
      recs.push({
        id: `scene-${nextScene.id}`,
        title: `Continue your story: ${nextScene.title}`,
        body: nextScene.blurb,
        why: state.story.completedScenes.length ? 'Your next chapter in Madrid is unlocked.' : 'Your Madrid life starts here.',
        cta: 'Go there',
        route: { name: 'scene', id: nextScene.id },
        priority: state.story.completedScenes.length === 0 ? 100 : 60,
      });
    }

    // 2. Ser vs estar confusion → conversation about the apartment.
    const mistakes = recentMistakes(state, now);
    const serEstar = mistakes.get('ser-estar') ?? 0;
    if (serEstar >= 2) {
      const vm = allVerbMastery(state, 'present', region);
      const presentGood = vm.filter((v) => (v.accuracy ?? 0) >= 0.8 && v.attempts >= 5).length >= 3;
      recs.push({
        id: 'ser-estar',
        title: 'Untangle ser and estar',
        body: `${presentGood ? 'You\'ve improved your present-tense conjugations, but y' : 'Y'}ou're still mixing up ser and estar. Let's practise them through the conversation about your apartment with Doña Carmen, then a focused drill.`,
        why: `${serEstar} ser/estar slips in the last 14 days.`,
        cta: 'Practise ser & estar',
        route: state.story.completedScenes.includes('piso') ? { name: 'verbs', focus: ['ser', 'estar'], mode: 'ser-estar' } : { name: 'scene', id: 'piso' },
        priority: 90,
      });
    }

    // 3. Due reviews.
    const due = dueCards(state, now).length;
    if (due >= 5) {
      recs.push({
        id: 'review',
        title: `${due} words and forms are ready for review`,
        body: 'They are at the edge of being forgotten — reviewing now is when it counts most.',
        why: 'Spaced repetition schedule.',
        cta: 'Start review',
        route: { name: 'review' },
        priority: 80 + Math.min(due, 15),
      });
    }

    // 4. Weakest verbs.
    const weak = allVerbMastery(state, 'present', region)
      .filter((v) => v.attempts >= 3 && (v.accuracy ?? 1) < 0.7)
      .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
      .slice(0, 3);
    if (weak.length) {
      const names = weak.map((w) => w.inf);
      recs.push({
        id: 'weak-verbs',
        title: `Strengthen ${names.join(', ')}`,
        body: `These verbs keep tripping you up. We'll drill them in context — ${context}.`,
        why: weak.map((w) => `${w.inf}: ${Math.round((w.accuracy ?? 0) * 100)}% accuracy`).join(' · '),
        cta: 'Practise these verbs',
        route: { name: 'verbs', focus: names },
        priority: 75,
      });
    }

    // 5. Top recurring error pattern.
    const top = [...mistakes.entries()].filter(([c]) => c !== 'ser-estar' && c !== 'other').sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) {
      const [cat, n] = top;
      const focus =
        cat === 'stem-change' ? ['querer', 'poder', 'pensar', 'dormir', 'volver', 'pedir'] :
        cat === 'irregular-yo' ? ['tener', 'hacer', 'salir', 'poner', 'conocer', 'decir'] : undefined;
      recs.push({
        id: `pattern-${cat}`,
        title: 'A pattern worth fixing',
        body: CATEGORY_TIP[cat],
        why: `${n} recent mistakes of this type.`,
        cta: focus ? 'Targeted drill' : 'Practise verbs',
        route: { name: 'verbs', focus },
        priority: 70,
      });
    }

    // 6. Speaking practice.
    const week = thisWeek(state, now);
    if (week.speakingAttempts < 3 && state.story.completedScenes.length > 0) {
      const scene = SCENES.find((s) => state.story.completedScenes.includes(s.id)) ?? SCENES[0];
      recs.push({
        id: 'speaking',
        title: 'Get your voice in the game',
        body: `Replay "${scene.title}" and use Let me try to record your answers, then Compare with the guide.`,
        why: `${week.speakingAttempts} speaking attempts this week.`,
        cta: 'Speak now',
        route: { name: 'scene', id: scene.id },
        priority: p?.difficulties.includes('speaking') ? 72 : 50,
      });
    }

    // 7. New verbs to introduce.
    const untouched = allVerbMastery(state, 'present', region).filter((v) => v.attempts === 0);
    if (untouched.length) {
      const pick = untouched.slice(0, 4).map((v) => v.inf);
      recs.push({
        id: 'new-verbs',
        title: 'Learn new verbs',
        body: `Next up: ${pick.map((v) => `${v} (${VERB_BY_INF[v].en.split(' (')[0]})`).join(', ')}.`,
        why: `${untouched.length} high-frequency verbs not started yet.`,
        cta: 'Start',
        route: { name: 'verbs', focus: pick },
        priority: 40,
      });
    }

    return recs.sort((a, b) => b.priority - a.priority);
  },
};
