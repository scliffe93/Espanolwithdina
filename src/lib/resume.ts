import type { AppState } from '../types';
import { SCENE_BY_ID, scenesForCity } from '../data/story';
import { rulesCoach } from './coach';
import { routeHref } from '../screens/World';

/** Where "Continue learning" should go: the last unfinished activity, else the next chapter, else the coach's pick. */
export function resumeTarget(state: AppState): { href: string; label: string } {
  const r = state.resume;
  if (r) {
    const sceneId = r.route.startsWith('scene/') ? r.route.slice(6) : null;
    if (sceneId && SCENE_BY_ID[sceneId] && !state.story.completedScenes.includes(sceneId)) return { href: r.route, label: r.label };
    if (!sceneId && Date.now() - r.at < 2 * 86_400_000) return { href: r.route, label: r.label };
  }
  const city = state.profile?.city ?? 'madrid';
  const next = scenesForCity(city).find((s) => !state.story.completedScenes.includes(s.id) && (!s.requires || state.story.completedScenes.includes(s.requires)));
  if (next) return { href: `scene/${next.id}`, label: `${next.titleEs} — ${next.title}` };
  const top = rulesCoach.recommend(state, Date.now())[0];
  return top ? { href: routeHref(top.route), label: top.title } : { href: 'world', label: 'Your city' };
}

/** Human label for a learning route, saved as the resume point. */
export function resumeLabel(route: string, id?: string, params?: URLSearchParams): string | null {
  if (route === 'scene' && id && SCENE_BY_ID[id]) return `${SCENE_BY_ID[id].titleEs} — ${SCENE_BY_ID[id].title}`;
  if (route === 'verbs') return params?.get('focus') ? `Verb practice: ${params.get('focus')!.split(',').join(', ')}` : 'Verb gym';
  if (route === 'review') return 'Memory review';
  if (route === 'game' && id) return { metro: 'Metro Rush', order: 'Order Up!', swipe: '¿Sí o no?', serestar: 'Ser o Estar' }[id] ?? 'Arcade';
  return null;
}
