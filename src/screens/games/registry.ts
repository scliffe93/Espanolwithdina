export interface GameInfo {
  id: 'metro' | 'order' | 'swipe' | 'serestar' | 'penalty' | 'derbi' | 'lineup';
  title: string;
  es: string;
  emoji: string;
  trains: string;
  how: string[];
  bg: string; // tailwind bg class
}

export const GAMES: GameInfo[] = [
  {
    id: 'metro', title: 'Metro Rush', es: 'Carrera de metro', emoji: '🚇', bg: 'bg-azul',
    trains: 'Verb conjugation speed — every verb, person and form you tap is tracked.',
    how: ['A pronoun + verb appears.', 'Carriages race past carrying conjugated forms.', 'Tap the right one before the train leaves. Streaks speed it up!'],
  },
  {
    id: 'order', title: 'Order Up!', es: '¡Marchando!', emoji: '🛎️', bg: 'bg-terracotta',
    trains: 'Listening, numbers and food vocabulary — with the way people really order in your city.',
    how: ['A customer orders out loud.', 'Tap the items (and quantities) onto the tray.', 'Serve fast for bigger tips. Tap Repeat if you need to hear it again.'],
  },
  {
    id: 'swipe', title: '¿Sí o no?', es: '¿Correcto o no?', emoji: '👆', bg: 'bg-olive',
    trains: 'Spotting errors — the skill that makes your own Spanish self-correcting.',
    how: ['A sentence appears.', 'Swipe right ✓ if it’s correct, left ✗ if there’s a mistake.', 'Arrow keys work too. Build a streak!'],
  },
  {
    id: 'serestar', title: 'Ser o Estar', es: 'Ser o estar', emoji: '⚖️', bg: 'bg-saffron',
    trains: 'Ser vs estar — the classic hurdle, in a fast falling-block game.',
    how: ['A sentence falls from the sky.', 'Hit SER or ESTAR before it lands.', 'It gets faster as you go!'],
  },
  {
    id: 'penalty', title: 'Penalty Shoot-out', es: 'Tanda de penaltis', emoji: '⚽', bg: 'bg-olive',
    trains: 'Verb conjugation under pressure — you play for your city’s club against the rival keeper. Every shot is tracked.',
    how: ['A pronoun and a verb appear.', 'Three forms sit in the goal: left post, centre, right post.', 'Shoot the right form to beat the keeper. Wrong form = saved!'],
  },
  {
    id: 'derbi', title: 'The Derby Quiz', es: 'El derbi', emoji: '🏟️', bg: 'bg-terracotta',
    trains: 'Football vocabulary the way your region says it (penalti or penal, afición or hinchada), plus your city’s clubs, grounds and nicknames.',
    how: ['A word or a club question appears.', 'Tap the right answer out of four.', 'Vocabulary answers go into your memory deck.'],
  },
  {
    id: 'lineup', title: 'Line-up', es: 'Once inicial', emoji: '📋', bg: 'bg-azul',
    trains: 'Listening and word order — match commentary about your city’s clubs, rebuilt word by word.',
    how: ['Listen to a line of commentary (tap Repeat any time).', 'Tap the words in the right order to line them up.', 'Faster line-ups score more.'],
  },
];
