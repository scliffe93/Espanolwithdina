import type { ErrorCategory, Interest } from '../types';

// ───────────────────────────────────────────────────────────────
// Story data format shared by every city.
// Dialogue templating:
//   {name}            learner name
//   {homeTown}        what the learner typed in a "Soy de …" input node
//   {g:masc|fem}      grammatical-gender agreement for the learner
// ───────────────────────────────────────────────────────────────

export type CityId = 'madrid' | 'barcelona' | 'sevilla' | 'cdmx' | 'buenosaires' | 'medellin';

export interface CharacterLook {
  skin: string;
  hair: string;
  hairStyle: 'long' | 'bun' | 'short' | 'curly' | 'grey-bun';
  shirt: string;
  accent: string;
  glasses?: boolean;
  beard?: boolean;
  earrings?: boolean;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  bio: string;
  look: CharacterLook;
}

export type Quality = 'great' | 'ok' | 'off';

export interface Choice {
  es: string;
  en: string;
  next: string;
  quality: Quality;
  feedback?: string;
  rel?: number;
  category?: ErrorCategory;
  setFlag?: [string, string];
}

export interface InputSpec {
  /** Regex (case-insensitive, run on accent-stripped text). */
  pattern: string;
  example: string;
  hint: string;
  saveAs?: string;
  /** Regex capturing the value to save, group 1. */
  capture?: string;
  /** Common wrong pattern and how to explain it. */
  wrong?: { pattern: string; feedback: string; category: ErrorCategory }[];
  next: string;
}

export interface SceneNode {
  id: string;
  speaker: string; // character id, or 'narrator'
  es: string;
  en: string;
  grammar?: string;
  /** Vocab ids that appear in this line (for Help me remember). */
  vocab?: string[];
  next?: string;
  choices?: Choice[];
  /** Generate choices from the learner's interests (uses INTEREST_YOU); each leads to `interestNext`
   *  and sets flag interest=<key>. Use with a following node that has variantFlag 'interest'. */
  choicesFrom?: 'interests';
  interestNext?: string;
  input?: InputSpec;
  /** Swap es/en depending on a story flag. */
  variantFlag?: string;
  variants?: Record<string, { es: string; en: string }>;
  /** Route depending on a learner condition. */
  branchIf?: { condition: 'dating'; then: string; else: string };
  end?: boolean;
}

export interface Scene {
  id: string;
  city: CityId;
  /** 1 = arrival, 2 = home & neighbours, 3 = café & social life. */
  chapter: 1 | 2 | 3;
  /** Which illustrated backdrop to use (tinted with the city theme). */
  backdrop: 'arrival' | 'home' | 'cafe';
  /** Pin position on the city map, in % of width/height. */
  map: { x: number; y: number };
  title: string;
  titleEs: string;
  place: string;
  blurb: string;
  goals: string[];
  requires?: string;
  cast: string[];
  vocab: string[];
  verbs: string[];
  start: string;
  nodes: Record<string, SceneNode>;
  outro: string;
}


export interface CityStory {
  city: CityId;
  characters: Record<string, Character>;
  /** Exactly three chapters: 1 arrival, 2 home, 3 café / social. */
  scenes: Scene[];
  /** Vocabulary items introduced by this city (merged into the global bank). */
  vocab?: import('./vocab').VocabItem[];
}

/** What the learner says about their interests (region-neutral, shared by all cities). */
export const INTEREST_YOU: Record<Interest | 'default', { es: string; en: string }> = {
  food: { es: 'Me encanta cocinar y probar restaurantes nuevos.', en: 'I love cooking and trying new restaurants.' },
  football: { es: 'Me encanta el fútbol.', en: 'I love football.' },
  fitness: { es: 'Voy mucho al gimnasio y me gusta correr.', en: 'I go to the gym a lot and I like running.' },
  music: { es: 'Me encanta la música en directo.', en: 'I love live music.' },
  art: { es: 'Me gustan mucho el arte y los museos.', en: 'I really like art and museums.' },
  tech: { es: 'Trabajo en tecnología y me encanta todo lo digital.', en: 'I work in tech and I love everything digital.' },
  travel: { es: 'Me encanta viajar y conocer sitios nuevos.', en: 'I love travelling and discovering new places.' },
  nightlife: { es: 'Me gusta salir de noche y bailar.', en: 'I like going out at night and dancing.' },
  reading: { es: 'Me encanta leer.', en: 'I love reading.' },
  cinema: { es: 'Me encanta el cine.', en: 'I love cinema.' },
  nature: { es: 'Me gusta la naturaleza y hacer senderismo.', en: 'I like nature and hiking.' },
  default: { es: 'Me gusta conocer gente nueva.', en: 'I like meeting new people.' },
};

/** Helper for city files: turns a node list into a lookup by id. */
export function nodes(list: SceneNode[]): Record<string, SceneNode> {
  return Object.fromEntries(list.map((n) => [n.id, n]));
}
