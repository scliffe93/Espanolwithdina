import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Cefr } from '../types';
import { useLevelAccess } from './platform/useLevelAccess';
import { useStore } from './store';

// ───────────────────────────────────────────────────────────────
// Less English as you go. The words of the app itself (buttons,
// headings, exercise names) switch to Spanish in stages as the
// learner's level rises, so the Spanish they meet all day is the
// Spanish they need: Continuar, Comprobar, Escuchar.
//   stage 0 (A1)  English
//   stage 1 (A2)  the buttons and single words
//   stage 2 (B1)  labels, headings, the names of exercises and tenses
//   stage 3 (B2+) short instructions too
// Explanations of grammar and feedback on mistakes stay in English at
// every stage: those have to be understood, not guessed.
// The learner can override it in Settings.
// ───────────────────────────────────────────────────────────────

export type AppLanguage = 'auto' | 'en' | 'some' | 'most' | 'all';
export const APP_LANGUAGES: { value: AppLanguage; label: string }[] = [
  { value: 'auto', label: 'Automatic: more Spanish as my level rises' },
  { value: 'en', label: 'English' },
  { value: 'some', label: 'Buttons in Spanish' },
  { value: 'most', label: 'Buttons and headings in Spanish' },
  { value: 'all', label: 'As much Spanish as possible' },
];

export type Stage = 0 | 1 | 2 | 3;
export function stageFor(level: Cefr, pref: AppLanguage = 'auto'): Stage {
  if (pref === 'en') return 0;
  if (pref === 'some') return 1;
  if (pref === 'most') return 2;
  if (pref === 'all') return 3;
  return level === 'A1' ? 0 : level === 'A2' ? 1 : level === 'B1' ? 2 : 3;
}

/** English → [the stage from which it is shown in Spanish, the Spanish]. */
const ES: Record<string, [1 | 2 | 3, string]> = {
  // stage 1: buttons and single words
  Continue: [1, 'Continuar'], Check: [1, 'Comprobar'], Listen: [1, 'Escuchar'], Play: [1, 'Jugar'], Skip: [1, 'Saltar'], Slower: [1, 'Más despacio'],
  Resume: [1, 'Seguir'], Review: [1, 'Repasar'], All: [1, 'Todos'], Verbs: [1, 'Verbos'], Words: [1, 'Palabras'], Grammar: [1, 'Gramática'],
  Listening: [1, 'Escucha'], Speaking: [1, 'Hablar'], 'New!': [1, '¡Nuevo!'], 'Play again': [1, 'Jugar otra vez'], Arcade: [1, 'Juegos'],
  'Not quite': [1, 'Casi'], 'Verb gym': [1, 'Gimnasio de verbos'], Regular: [1, 'Regular'], Irregular: [1, 'Irregular'], 'Stem change': [1, 'Cambio de raíz'],
  'My city': [1, 'Mi ciudad'], Memory: [1, 'Memoria'], 'My journey': [1, 'Mi camino'], 'My lessons': [1, 'Mis clases'], Me: [1, 'Yo'], 'How to use': [1, 'Guía'],
  Statistics: [1, 'Estadísticas'], Teacher: [1, 'Profe'], 'Switch person': [1, 'Cambiar'], 'Lessons with Dina': [1, 'Clases con Dina'], More: [1, 'Más'],
  // stage 2: labels, headings, exercise and tense names
  Tense: [2, 'Tiempo'], Focus: [2, 'Enfoque'], Blanks: [2, 'Huecos'], Everything: [2, 'Todo'], 'My weak spots': [2, 'Mis puntos débiles'],
  'Answer:': [2, 'Respuesta:'], 'Help me remember': [2, 'Ayúdame a recordar'], 'Grammar drills': [2, 'Ejercicios de gramática'],
  Conjugate: [2, 'Conjuga'], 'Choose the form': [2, 'Elige la forma'], 'Match the pairs': [2, 'Une las parejas'], 'Build the sentence': [2, 'Construye la frase'],
  'Fix the mistake': [2, 'Corrige el error'], Translate: [2, 'Traduce'], 'In conversation': [2, 'En conversación'], 'Ser or estar?': [2, '¿Ser o estar?'],
  'Start 12-exercise session': [2, 'Empezar sesión de 12 ejercicios'], 'Grid drill: fill in the table': [2, 'Tabla: rellena los huecos'],
  'Check the table': [2, 'Comprobar la tabla'], 'Try the ones I missed': [2, 'Repetir mis fallos'], 'New grid': [2, 'Nueva tabla'], 'Same verbs again': [2, 'Los mismos verbos'],
  'Keep going: 12 more': [2, 'Seguir: 12 más'], 'Practise my mistakes': [2, 'Practicar mis errores'], 'Other verbs': [2, 'Otros verbos'],
  'How to play': [2, 'Cómo se juega'], 'End game': [2, 'Terminar'], 'Learn from these': [2, 'Aprende de estos'], 'Out of lives': [2, 'Sin vidas'],
  correct: [2, 'aciertos'], accuracy: [2, 'precisión'], 'best streak': [2, 'mejor racha'], 'The arcade': [2, 'Los juegos'], 'All games': [2, 'Todos los juegos'],
  'Just unlocked': [2, 'Recién abierto'], filled: [2, 'rellenos'], 'follows the pattern': [2, 'sigue el patrón'], 'has its own forms': [2, 'tiene formas propias'],
  // stage 3: short instructions
  'Which form do you hear?': [3, '¿Qué forma oyes?'], 'Tap the words in order.': [3, 'Toca las palabras en orden.'], 'Type the form': [3, 'Escribe la forma'],
  'Fill the gap': [3, 'Rellena el hueco'], 'Choose the correct Spanish.': [3, 'Elige la frase correcta.'], 'Which form should replace the mistake?': [3, '¿Qué forma corrige el error?'],
  'Tap a pronoun, then its matching form.': [3, 'Toca un pronombre y luego su forma.'], 'Tap a word, then its meaning': [3, 'Toca una palabra y luego su significado'],
  'the vowel changes, not for nosotros or vosotros': [3, 'cambia la vocal, menos en nosotros y vosotros'], 'It is accepted as soon as it is right': [3, 'Se acepta en cuanto está bien'],
  'Tap the microphone, then say the form': [3, 'Toca el micrófono y di la forma'], 'Slide the table sideways to see every verb.': [3, 'Desliza la tabla para ver todos los verbos.'],
};

export function translate(en: string, stage: Stage): string {
  const e = ES[en];
  return e && stage >= e[0] ? e[1] : en;
}

const Ctx = createContext<Stage>(0);

/** Works out the stage once for the whole app (it depends on the learner's level and their setting). */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const { level } = useLevelAccess();
  const stage = useMemo(() => stageFor(level, state.settings.appLanguage ?? 'auto'), [level, state.settings.appLanguage]);
  return <Ctx.Provider value={stage}>{children}</Ctx.Provider>;
}

/** `t('Continue')` gives "Continue" or "Continuar" depending on the learner's stage. `stage` is there for the few places that choose between two fields. */
export function useT(): { t: (en: string) => string; stage: Stage } {
  const stage = useContext(Ctx);
  return useMemo(() => ({ t: (en: string) => translate(en, stage), stage }), [stage]);
}
