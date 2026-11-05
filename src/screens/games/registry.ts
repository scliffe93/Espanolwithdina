export interface GameInfo {
  id: 'metro' | 'order' | 'swipe' | 'serestar';
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
];
