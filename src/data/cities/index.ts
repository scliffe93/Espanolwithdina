import type { CityStory } from '../storyTypes';

// Every file in this folder (other than madrid.ts and this index) that has a
// default export of a CityStory is registered automatically.
const mods = import.meta.glob<{ default: CityStory }>('./*.ts', { eager: true });
const ORDER = ['barcelona', 'sevilla', 'cdmx', 'buenosaires', 'medellin'];

export const CITY_STORIES_EXTRA: CityStory[] = Object.entries(mods)
  .filter(([path, m]) => !/\/(index|madrid)\.ts$/.test(path) && m.default?.city)
  .map(([, m]) => m.default)
  .sort((a, b) => ORDER.indexOf(a.city) - ORDER.indexOf(b.city));
