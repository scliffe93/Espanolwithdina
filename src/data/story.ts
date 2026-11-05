import type { CityId, Character, Scene } from './storyTypes';
import { madrid } from './cities/madrid';
import { CITY_STORIES_EXTRA } from './cities';
import { registerVocab } from './vocab';

export * from './storyTypes';

/** All city stories. Each city has exactly three chapters. */
export const CITY_STORIES = [madrid, ...CITY_STORIES_EXTRA];
for (const c of CITY_STORIES) registerVocab(c.vocab);

export const CHARACTERS: Record<string, Character> = Object.assign({}, ...CITY_STORIES.map((c) => c.characters));
export const SCENES: Scene[] = CITY_STORIES.flatMap((c) => c.scenes);
export const SCENE_BY_ID: Record<string, Scene> = Object.fromEntries(SCENES.map((s) => [s.id, s]));

export function scenesForCity(city: CityId): Scene[] {
  return SCENES.filter((s) => s.city === city).sort((a, b) => a.chapter - b.chapter);
}

/** Future chapters shown on every city map. Locked; not playable in this version. */
export const FUTURE_LOCATIONS = [
  { id: 'mercado', title: 'The market', theme: 'Shopping & everyday life', x: 36, y: 38 },
  { id: 'gimnasio', title: 'The gym', theme: 'Sports clubs & hobbies', x: 70, y: 44 },
  { id: 'oficina', title: 'The office', theme: 'Work & colleagues', x: 52, y: 30 },
  { id: 'centro-salud', title: 'Health centre', theme: 'Healthcare & admin', x: 24, y: 56 },
  { id: 'bar', title: 'The bar', theme: 'Friends & dating', x: 48, y: 46 },
];
