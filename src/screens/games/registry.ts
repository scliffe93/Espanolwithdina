import type { Activity, AppState, Cefr, Difficulty, Interest } from '../../types';

/** What a game mainly practises: the filter on the arcade page. */
export type GameArea = 'verbs' | 'words' | 'listening' | 'grammar' | 'speaking';
export const AREA_LABEL: Record<GameArea, string> = { verbs: 'Verbs', words: 'Words', listening: 'Listening', grammar: 'Grammar', speaking: 'Speaking' };

export interface GameInfo {
  id: 'metro' | 'order' | 'swipe' | 'serestar' | 'penalty' | 'derbi' | 'lineup' | 'pairs' | 'type' | 'say' | 'porpara' | 'pasado' | 'subjuntivo' | 'si';
  area: GameArea;
  /** The level at which the game opens in the arcade. Homework a teacher sets always opens. */
  minLevel: Cefr;
  /** The ways of learning this game suits (what the learner said they enjoy). */
  likes: Activity[];
  /** The things a learner said they find hard that this game works on. */
  helps: Difficulty[];
  /** Set when the game is built round an interest (the football games). */
  interest?: Interest;
  /** The game needs the phone to understand speech. */
  needsMic?: boolean;
  title: string;
  es: string;
  emoji: string;
  trains: string;
  how: string[];
  bg: string; // tailwind bg class
}

export const GAMES: GameInfo[] = [
  {
    id: 'metro', minLevel: 'A1', area: 'verbs', likes: ['games'], helps: ['verbs'], title: 'Metro Rush', es: 'Carrera de metro', emoji: '🚇', bg: 'bg-azul',
    trains: 'Verb conjugation speed — every verb, person and form you tap is tracked.',
    how: ['A pronoun + verb appears.', 'Carriages race past carrying conjugated forms.', 'Tap the right one before the train leaves. Streaks speed it up!'],
  },
  {
    id: 'order', minLevel: 'A1', area: 'listening', likes: ['audio', 'games'], helps: ['listening', 'vocabulary'], title: 'Order Up!', es: '¡Marchando!', emoji: '🛎️', bg: 'bg-terracotta',
    trains: 'Listening, numbers and food vocabulary — with the way people really order in your city.',
    how: ['A customer orders out loud.', 'Tap the items (and quantities) onto the tray.', 'Serve fast for bigger tips. Tap Repeat if you need to hear it again.'],
  },
  {
    id: 'swipe', minLevel: 'A2', area: 'grammar', likes: ['stories', 'games'], helps: ['verbs', 'confidence'], title: '¿Sí o no?', es: '¿Correcto o no?', emoji: '👆', bg: 'bg-olive',
    trains: 'Spotting errors — the skill that makes your own Spanish self-correcting.',
    how: ['A sentence appears.', 'Swipe right ✓ if it’s correct, left ✗ if there’s a mistake.', 'Arrow keys work too. Build a streak!'],
  },
  {
    id: 'serestar', minLevel: 'A1', area: 'grammar', likes: ['games', 'visual'], helps: ['ser-estar'], title: 'Ser o Estar', es: 'Ser o estar', emoji: '⚖️', bg: 'bg-saffron',
    trains: 'Ser vs estar — the classic hurdle, in a fast falling-block game.',
    how: ['A sentence falls from the sky.', 'Hit SER or ESTAR before it lands.', 'It gets faster as you go!'],
  },
  {
    id: 'penalty', minLevel: 'A1', area: 'verbs', likes: ['games'], helps: ['verbs'], interest: 'football', title: 'Penalty Shoot-out', es: 'Tanda de penaltis', emoji: '⚽', bg: 'bg-olive',
    trains: 'Verb conjugation under pressure — you play for your city’s club against the rival keeper. Every shot is tracked.',
    how: ['A pronoun and a verb appear.', 'Three forms sit in the goal: left post, centre, right post.', 'Shoot the right form to beat the keeper. Wrong form = saved!'],
  },
  {
    id: 'derbi', minLevel: 'A1', area: 'words', likes: ['stories', 'games'], helps: ['vocabulary'], interest: 'football', title: 'The Derby Quiz', es: 'El derbi', emoji: '🏟️', bg: 'bg-terracotta',
    trains: 'Football vocabulary the way your region says it (penalti or penal, afición or hinchada), plus your city’s clubs, grounds and nicknames.',
    how: ['A word or a club question appears.', 'Tap the right answer out of four.', 'Vocabulary answers go into your memory deck.'],
  },
  {
    id: 'lineup', minLevel: 'A2', area: 'listening', likes: ['audio'], helps: ['listening'], interest: 'football', title: 'Line-up', es: 'Once inicial', emoji: '📋', bg: 'bg-azul',
    trains: 'Listening and word order — match commentary about your city’s clubs, rebuilt word by word.',
    how: ['Listen to a line of commentary (tap Repeat any time).', 'Tap the words in the right order to line them up.', 'Faster line-ups score more.'],
  },
  {
    id: 'pairs', minLevel: 'A1', area: 'words', likes: ['visual', 'games'], helps: ['vocabulary'], title: 'Pairs', es: 'Parejas', emoji: '🧩', bg: 'bg-azul',
    trains: 'Vocabulary recall — match each Spanish word to its meaning as fast as you can. New pairs keep arriving.',
    how: ['Five Spanish words on the left, five meanings on the right.', 'Tap a word, then its partner.', 'Matched pairs are replaced by new ones. Keep the streak going!'],
  },
  {
    id: 'type', minLevel: 'A1', area: 'verbs', likes: ['writing'], helps: ['verbs'], title: 'Quick Keys', es: 'Teclas rápidas', emoji: '⌨️', bg: 'bg-terracotta',
    trains: 'Producing verb forms from memory — you type them, which is what makes them stick.',
    how: ['A pronoun and a verb appear.', 'Type the form. It is accepted the moment it is right: no need to press enter.', 'Beat the bar. Accents are forgiven, but shown.'],
  },
  {
    id: 'say', minLevel: 'A1', area: 'speaking', likes: ['speaking'], helps: ['speaking', 'pronunciation', 'confidence'], needsMic: true, title: 'Say It', es: 'Dilo', emoji: '🎙️', bg: 'bg-olive',
    trains: 'Speaking verb forms aloud — the phone listens and checks what you said.',
    how: ['A pronoun and a verb appear.', 'Tap the microphone and say the form in Spanish.', 'Say the pronoun too if you like: “yo hablo”.'],
  },
  {
    id: 'porpara', minLevel: 'A2', area: 'grammar', likes: ['games', 'stories'], helps: ['confidence'], title: 'Por o Para', es: 'Por o para', emoji: '🔀', bg: 'bg-saffron',
    trains: 'Por and para — cause, exchange and passing through against purpose, destination and deadlines.',
    how: ['A sentence appears with a gap.', 'Tap por or para before the bar runs out.', 'After a miss, the reason is shown. Read it: the same idea comes back.'],
  },
  {
    id: 'pasado', minLevel: 'B1', area: 'grammar', likes: ['games', 'stories'], helps: ['verbs'], title: 'Two Pasts', es: 'Indefinido o imperfecto', emoji: '⏳', bg: 'bg-azul',
    trains: 'Choosing between the two past tenses — a finished event, or the background and what used to happen.',
    how: ['A sentence about the past appears with a gap.', 'Choose the preterite or the imperfect form.', 'Ask yourself: did it happen once and finish, or was it going on?'],
  },
  {
    id: 'subjuntivo', minLevel: 'B1', area: 'grammar', likes: ['games', 'stories'], helps: ['verbs', 'confidence'], title: 'Subjunctive?', es: '¿Subjuntivo?', emoji: '💭', bg: 'bg-olive',
    trains: 'Knowing when the subjunctive is needed — wishes, doubts and feelings take it; facts do not.',
    how: ['A sentence appears with a gap.', 'Choose the subjunctive or the ordinary form.', 'Look at what comes before “que”: a fact, or a wish, doubt or feeling?'],
  },
  {
    id: 'si', minLevel: 'B2', area: 'grammar', likes: ['games', 'stories'], helps: ['verbs'], title: 'What If', es: 'Si…', emoji: '🪄', bg: 'bg-terracotta',
    trains: 'If-sentences — real possibilities, imagined ones, and regrets about the past, each with its own pair of tenses.',
    how: ['An “if” sentence appears with a gap.', 'Choose the form that completes it.', 'Work out which kind of “if” it is first: likely, imagined or too late.'],
  },
];

/**
 * How well a game suits this learner, and why, in a few words. It looks at what they said they enjoy, what they
 * said they find hard, and their interests. A football game ranks high for a football fan and low for everyone else.
 */
export function gameFit(g: GameInfo, state: AppState): { score: number; why: string } {
  const p = state.profile;
  const reasons: [number, string][] = [];
  const LIKE: Record<Activity, string> = { visual: 'you like visual cues', audio: 'you like listening', speaking: 'you like speaking aloud', writing: 'you like writing and typing', stories: 'you like stories and reading', games: 'you like quick games' };
  const HARD: Partial<Record<Difficulty, string>> = { verbs: 'you want to work on verb forms', listening: 'you want to understand fast speech', 'ser-estar': 'you want to get ser and estar right', vocabulary: 'you want to remember more words', speaking: 'you want to speak more easily', pronunciation: 'you want to work on pronunciation', confidence: 'you want more confidence' };
  for (const a of p?.activities ?? []) if (g.likes.includes(a) && a !== 'games') reasons.push([3, LIKE[a]]);
  for (const d of p?.difficulties ?? []) if (g.helps.includes(d) && HARD[d]) reasons.push([2.5, HARD[d]!]);
  if (g.interest) { if (p?.interests.includes(g.interest)) reasons.push([3, `you follow ${g.interest}`]); else reasons.push([-2, '']); }
  if ((p?.activities ?? []).includes('games') && g.likes.includes('games')) reasons.push([1, LIKE.games]);
  if (!state.games[g.id]) reasons.push([0.5, 'you have not tried it yet']);
  const best = reasons.filter((r) => r[1]).sort((a, b) => b[0] - a[0])[0];
  return { score: reasons.reduce((a, r) => a + r[0], 0), why: best ? `Because ${best[1]}` : '' };
}
