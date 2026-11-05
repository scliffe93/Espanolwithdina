import type { ErrorCategory, Interest } from '../types';

// ───────────────────────────────────────────────────────────────
// Madrid storyline. Templating:
//   {name}            learner name
//   {homeTown}        what the learner typed in "Soy de …"
//   {g:masc|fem}      grammatical-gender agreement for the learner
// ───────────────────────────────────────────────────────────────

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

export const CHARACTERS: Record<string, Character> = {
  lucia: {
    id: 'lucia', name: 'Lucía', role: 'Your guide',
    bio: 'Born in Madrid, grew up between Lavapiés and Valencia. Teaches Spanish to newcomers and knows every shortcut in the city.',
    look: { skin: '#C98E6B', hair: '#2B1A14', hairStyle: 'long', shirt: '#C2593A', accent: '#E3A33B', earrings: true },
  },
  andres: {
    id: 'andres', name: 'Andrés', role: 'Metro station worker',
    bio: 'Has worked at Barajas for 20 years. Patient, formal and secretly a big fan of tourists who try Spanish.',
    look: { skin: '#B07D5A', hair: '#3A3532', hairStyle: 'short', shirt: '#1F3A5F', accent: '#E3A33B', beard: true },
  },
  carmen: {
    id: 'carmen', name: 'Doña Carmen', role: 'Your neighbour',
    bio: 'Has lived in the building for 50 years. Knows everyone, waters her geraniums at 9 am sharp, and loves a chat.',
    look: { skin: '#E0B394', hair: '#CFCAC4', hairStyle: 'grey-bun', shirt: '#5E7149', accent: '#D98C8C', glasses: true, earrings: true },
  },
  javi: {
    id: 'javi', name: 'Javi', role: 'Waiter at Café La Plaza',
    bio: 'Fast, funny and an Atlético fan. Remembers everybody\'s coffee order after the second visit.',
    look: { skin: '#D7A47F', hair: '#1E1612', hairStyle: 'curly', shirt: '#2E2A27', accent: '#C2593A', beard: true },
  },
  marta: {
    id: 'marta', name: 'Marta', role: 'Graphic designer, Javi\'s friend',
    bio: 'Grew up in Lavapiés, works as a freelance designer and always knows what is on in the city this weekend.',
    look: { skin: '#A86F4F', hair: '#4A2A1C', hairStyle: 'bun', shirt: '#E3A33B', accent: '#1F3A5F', earrings: true },
  },
};

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
  /** Generate choices from the learner's interests. */
  choicesFrom?: 'interests';
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

function nodes(list: SceneNode[]): Record<string, SceneNode> {
  return Object.fromEntries(list.map((n) => [n.id, n]));
}

export const INTEREST_LINES: Record<Interest | 'default', { you: { es: string; en: string }; invite: { es: string; en: string } }> = {
  food: {
    you: { es: 'Me encanta cocinar y probar restaurantes nuevos.', en: 'I love cooking and trying new restaurants.' },
    invite: { es: '¡Pues el sábado vamos al mercado de San Fernando a comer! ¿Te apuntas?', en: 'Well, on Saturday we\'re going to San Fernando market to eat! Want to join?' },
  },
  football: {
    you: { es: 'Me encanta el fútbol.', en: 'I love football.' },
    invite: { es: 'El domingo hay partido. Lo vemos en el bar de Javi, ¿te apuntas?', en: 'There\'s a match on Sunday. We\'re watching it at Javi\'s bar — want to join?' },
  },
  fitness: {
    you: { es: 'Voy mucho al gimnasio y me gusta correr.', en: 'I go to the gym a lot and I like running.' },
    invite: { es: 'Yo corro en el Retiro los domingos por la mañana. ¿Te vienes?', en: 'I run in the Retiro on Sunday mornings. Are you coming?' },
  },
  music: {
    you: { es: 'Me encanta la música en directo.', en: 'I love live music.' },
    invite: { es: 'El jueves hay un concierto en una sala aquí al lado. ¿Te apuntas?', en: 'There\'s a gig at a venue round the corner on Thursday. Want to come?' },
  },
  art: {
    you: { es: 'Me gustan mucho el arte y los museos.', en: 'I really like art and museums.' },
    invite: { es: 'El Reina Sofía es gratis algunas tardes. ¿Vamos juntos un día?', en: 'The Reina Sofía is free some evenings. Shall we go together one day?' },
  },
  tech: {
    you: { es: 'Trabajo con ordenadores y me encanta la tecnología.', en: 'I work with computers and I love technology.' },
    invite: { es: 'El miércoles hay un encuentro de gente de tecnología en un coworking. ¿Vienes?', en: 'There\'s a tech meetup at a coworking space on Wednesday. Are you coming?' },
  },
  travel: {
    you: { es: 'Me encanta viajar y conocer sitios nuevos.', en: 'I love travelling and discovering new places.' },
    invite: { es: 'Este fin de semana vamos a Segovia en tren. ¿Te apuntas?', en: 'This weekend we\'re going to Segovia by train. Want to join?' },
  },
  nightlife: {
    you: { es: 'Me gusta salir de noche y bailar.', en: 'I like going out at night and dancing.' },
    invite: { es: 'El viernes salimos por Malasaña. ¿Te apuntas?', en: 'On Friday we\'re going out in Malasaña. Are you in?' },
  },
  reading: {
    you: { es: 'Me encanta leer.', en: 'I love reading.' },
    invite: { es: 'Hay un club de lectura en la librería de la esquina. ¿Vienes conmigo?', en: 'There\'s a book club at the bookshop on the corner. Will you come with me?' },
  },
  cinema: {
    you: { es: 'Me encanta el cine.', en: 'I love cinema.' },
    invite: { es: 'Aquí cerca hay un cine con películas en versión original. ¿Vamos el martes?', en: 'There\'s a cinema near here showing films in their original language. Shall we go on Tuesday?' },
  },
  nature: {
    you: { es: 'Me gusta la naturaleza y hacer senderismo.', en: 'I like nature and hiking.' },
    invite: { es: 'Los sábados hacemos senderismo en la sierra. ¿Te vienes?', en: 'On Saturdays we go hiking in the mountains. Are you coming?' },
  },
  default: {
    you: { es: 'Me gusta conocer gente nueva.', en: 'I like meeting new people.' },
    invite: { es: 'El viernes quedamos unos amigos para tomar algo. ¿Te apuntas?', en: 'On Friday a few friends are meeting for a drink. Want to join?' },
  },
};

export const SCENES: Scene[] = [
  // ─────────────────────────── 1. ARRIVAL ───────────────────────────
  {
    id: 'llegada',
    title: 'Arrival at Barajas',
    titleEs: 'La llegada',
    place: 'Aeropuerto Madrid-Barajas, Terminal 4',
    blurb: 'Land in Madrid, meet Lucía and find your way onto the metro.',
    goals: ['Introduce yourself with ser', 'Say how you feel with estar', 'Buy a metro ticket'],
    cast: ['lucia', 'andres'],
    vocab: ['aeropuerto', 'maleta', 'billete', 'salida', 'llegadas', 'pasaporte', 'movil', 'izquierda'],
    verbs: ['ser', 'estar', 'tener', 'necesitar', 'poder', 'ir', 'encontrar'],
    start: 'a1',
    outro: 'You made it onto the metro. Next stop: your new flat in Lavapiés.',
    nodes: nodes([
      { id: 'a1', speaker: 'narrator', es: 'Terminal 4. Madrid. Tu nueva vida empieza aquí.', en: 'Terminal 4. Madrid. Your new life starts here.', vocab: ['llegadas'], next: 'a2' },
      {
        id: 'a2', speaker: 'lucia',
        es: '¡Hola! Tú eres {name}, ¿verdad? Soy Lucía. ¡{g:Bienvenido|Bienvenida} a Madrid!',
        en: 'Hi! You\'re {name}, right? I\'m Lucía. Welcome to Madrid!',
        grammar: 'Soy / eres come from SER — used for identity: who you are. "¿verdad?" at the end of a sentence means "right?".',
        choices: [
          { es: '¡Hola, Lucía! Sí, soy yo. {g:Encantado|Encantada}.', en: 'Hi, Lucía! Yes, that\'s me. Pleased to meet you.', next: 'a3', quality: 'great', rel: 5, feedback: '¡Perfecto! "Encantado/a" agrees with you, the speaker.' },
          { es: '¡Hola! Sí. Mucho gusto.', en: 'Hi! Yes. Nice to meet you.', next: 'a3', quality: 'great', rel: 4, feedback: 'Natural and friendly. "Mucho gusto" works for everyone.' },
          { es: 'Hola. Yo es {name}.', en: '(Hello. I is {name}.)', next: 'a3', quality: 'off', category: 'person-agreement', feedback: '"Es" is for él / ella. With yo, ser becomes "soy": Yo soy {name}.' },
        ],
      },
      {
        id: 'a3', speaker: 'lucia',
        es: '¿Qué tal el vuelo? ¿Estás {g:cansado|cansada}?',
        en: 'How was the flight? Are you tired?',
        grammar: 'ESTAR describes temporary states and feelings: estoy cansado/a (I\'m tired right now).',
        choices: [
          { es: 'Un poco, pero estoy muy {g:contento|contenta} de estar aquí.', en: 'A little, but I\'m really happy to be here.', next: 'a4', quality: 'great', rel: 5, feedback: 'Lovely — estar for how you feel right now.' },
          { es: 'Sí, soy muy {g:cansado|cansada}.', en: '(Yes, I am a very tiring person.)', next: 'a4', quality: 'off', category: 'ser-estar', feedback: '"Soy cansado/a" means you are a tiresome person! For how you feel right now, use estar: estoy cansado/a.' },
          { es: 'No, estoy bien, gracias.', en: 'No, I\'m fine, thanks.', next: 'a4', quality: 'great', rel: 3, feedback: 'Correct — estar for your state.' },
        ],
      },
      {
        id: 'a4', speaker: 'lucia',
        es: 'Vale. Primero vamos al metro. ¿Tienes todo? ¿El pasaporte, la maleta…?',
        en: 'OK. First, let\'s go to the metro. Have you got everything? Passport, suitcase…?',
        vocab: ['pasaporte', 'maleta'],
        grammar: '"Vale" is the Spanish OK — you\'ll hear it constantly in Spain. In Mexico you\'d hear "va" or "sale".',
        choices: [
          { es: 'Sí, lo tengo todo.', en: 'Yes, I\'ve got everything.', next: 'a5', quality: 'great', rel: 2, feedback: 'Natural! "Lo tengo todo" = I\'ve got it all.' },
          { es: '¡Ay! No encuentro mi móvil…', en: 'Oh no! I can\'t find my phone…', next: 'a4b', quality: 'great', rel: 3, feedback: 'Great use of encontrar (o→ue): encuentro.' },
          { es: 'Sí, tienes todo.', en: '(Yes, you have everything.)', next: 'a5', quality: 'off', category: 'person-agreement', feedback: '"Tienes" means "you have". For "I have", tener becomes "tengo".' },
        ],
      },
      { id: 'a4b', speaker: 'lucia', es: '¡{g:Tranquilo|Tranquila}! Lo tienes en la mano.', en: 'Relax! It\'s in your hand.', vocab: ['movil'], next: 'a5' },
      { id: 'a5', speaker: 'narrator', es: 'En la máquina de billetes del metro, un empleado se acerca.', en: 'At the metro ticket machine, a member of staff comes over.', vocab: ['billete'], next: 'a6' },
      {
        id: 'a6', speaker: 'andres',
        es: 'Buenas. ¿Necesita ayuda?',
        en: 'Hello. Do you need any help?',
        grammar: '"Necesita" is the USTED (formal you) form — it looks like the él/ella form. Staff usually use usted with strangers.',
        choices: [
          { es: 'Sí, por favor. Necesito un billete para el centro.', en: 'Yes, please. I need a ticket to the centre.', next: 'a7', quality: 'great', rel: 5, feedback: 'Perfect: necesito (yo) + polite "por favor".' },
          { es: 'Sí, gracias. ¿Cuánto cuesta un billete a Sol?', en: 'Yes, thanks. How much is a ticket to Sol?', next: 'a7', quality: 'great', rel: 5, feedback: 'Excellent question. Sol is the very centre of Madrid.' },
          { es: 'Sí. Necesitas un billete.', en: '(Yes. You need a ticket.)', next: 'a7', quality: 'off', category: 'person-agreement', feedback: '"Necesitas" = you need. For "I need": necesito.' },
        ],
      },
      {
        id: 'a7', speaker: 'andres',
        es: 'Desde el aeropuerto hay un suplemento. Con el suplemento son unos cinco euros. ¿Paga con tarjeta?',
        en: 'There\'s a supplement from the airport. With the supplement it\'s about five euros. Paying by card?',
        grammar: '"¿Paga con tarjeta?" — usted form again. Prices change, so always check the machine!',
        choices: [
          { es: 'Sí, con tarjeta.', en: 'Yes, by card.', next: 'a8', quality: 'great', rel: 2 },
          { es: '¿Puedo pagar en efectivo?', en: 'Can I pay in cash?', next: 'a8', quality: 'great', rel: 3, feedback: 'Poder + infinitive: ¿puedo pagar…? = can I pay…?' },
        ],
      },
      {
        id: 'a8', speaker: 'andres',
        es: 'Perfecto. Coja la línea ocho hasta Nuevos Ministerios. Allí cambie de línea. La salida está a la izquierda.',
        en: 'Perfect. Take line 8 to Nuevos Ministerios. Change lines there. The exit is on the left.',
        vocab: ['salida', 'izquierda'],
        grammar: '"Coja" and "cambie" are formal commands (usted). In Spain, "coger" = to take (a bus, a line). In Mexico avoid "coger" — it\'s vulgar there; use "tomar".',
        next: 'a9',
      },
      {
        id: 'a9', speaker: 'lucia',
        es: 'A ver si has escuchado bien: ¿qué línea tomamos?',
        en: 'Let\'s see if you listened carefully: which line do we take?',
        choices: [
          { es: 'La línea ocho.', en: 'Line eight.', next: 'a10', quality: 'great', rel: 5, feedback: '¡Exacto! Ocho = 8.' },
          { es: 'La línea diez.', en: 'Line ten.', next: 'a9', quality: 'off', category: 'vocabulary', feedback: 'Not quite. Tap "Listen again" on Andrés\'s line — he said "la línea ocho" (8).' },
          { es: 'La línea tres.', en: 'Line three.', next: 'a9', quality: 'off', category: 'vocabulary', feedback: 'Not quite. He said "ocho" — eight.' },
        ],
      },
      { id: 'a10', speaker: 'lucia', es: '¡Muy bien! Vamos. Tu piso está en Lavapiés. Te va a encantar el barrio.', en: 'Great! Let\'s go. Your flat is in Lavapiés. You\'re going to love the neighbourhood.', grammar: 'Ir a + infinitive talks about the near future: te va a encantar = you\'re going to love it.', end: true },
    ]),
  },

  // ─────────────────────────── 2. THE FLAT ───────────────────────────
  {
    id: 'piso',
    title: 'Your new flat',
    titleEs: 'El piso nuevo',
    place: 'Lavapiés',
    blurb: 'Meet Doña Carmen, learn when to use usted, and master ser vs estar.',
    goals: ['Choose the right register (tú vs usted)', 'Say where you\'re from', 'Ser for characteristics, estar for location'],
    requires: 'llegada',
    cast: ['lucia', 'carmen'],
    vocab: ['piso', 'vecino', 'llave', 'portal', 'escalera', 'ruido', 'farmacia', 'ventana'],
    verbs: ['ser', 'estar', 'vivir', 'trabajar', 'buscar', 'necesitar', 'querer'],
    start: 'p1',
    outro: 'Carmen has your back, and you\'ve got the keys. Café La Plaza is waiting.',
    nodes: nodes([
      { id: 'p1', speaker: 'narrator', es: 'Lavapiés. Un edificio antiguo con balcones llenos de flores.', en: 'Lavapiés. An old building with balconies full of flowers.', next: 'p2' },
      {
        id: 'p2', speaker: 'lucia',
        es: 'Este es tu portal. Tu piso está en el tercero. Ah, mira, es Doña Carmen, tu vecina.',
        en: 'This is your building\'s entrance. Your flat is on the third floor. Oh, look, it\'s Doña Carmen, your neighbour.',
        vocab: ['portal', 'piso', 'vecino'],
        grammar: 'Location → estar: tu piso está en el tercero. Identity → ser: es Doña Carmen.',
        next: 'p3',
      },
      {
        id: 'p3', speaker: 'carmen',
        es: '¡Buenos días! Usted debe de ser {g:el nuevo vecino|la nueva vecina}.',
        en: 'Good morning! You must be the new neighbour.',
        grammar: '"Doña" is a respectful title used before an older woman\'s first name. She uses usted with you — how will you reply?',
        choices: [
          { es: 'Buenos días, señora. Sí, soy yo. ¿Cómo está usted?', en: 'Good morning, madam. Yes, that\'s me. How are you?', next: 'p4', quality: 'great', rel: 10, setFlag: ['register', 'usted'], feedback: 'Very respectful. With an older neighbour you\'ve just met, usted is a safe, warm choice.' },
          { es: '¡Hola, Carmen! ¿Qué tal estás?', en: 'Hi, Carmen! How are you doing?', next: 'p4', quality: 'ok', rel: 3, category: 'register', setFlag: ['register', 'tu'], feedback: 'Grammatically perfect and many Madrileños wouldn\'t mind — but with an older neighbour, starting with usted shows respect.' },
          { es: '¿Qué pasa, tía?', en: 'What\'s up, girl?', next: 'p4b', quality: 'off', rel: -5, category: 'register', setFlag: ['register', 'slang'], feedback: '"Tía" is slang between friends of your age. With an older neighbour you\'ve just met, it\'s far too casual.' },
        ],
      },
      { id: 'p4', speaker: 'carmen', es: 'Muy bien, gracias. ¡Qué {g:educado|educada}! Pero háblame de tú, ¿eh? Aquí somos todos vecinos.', en: 'Very well, thank you. How polite! But call me "tú", OK? We\'re all neighbours here.', grammar: '"Hablar / tratar de tú" (tutear) = to address someone informally. Older Spaniards often invite you to switch to tú — wait for the invitation.', next: 'p5' },
      { id: 'p4b', speaker: 'carmen', es: 'Ay… ¡qué moderno! Bueno, bueno. Encantada.', en: 'Oh… how modern! Well, well. Pleased to meet you.', next: 'p5' },
      {
        id: 'p5', speaker: 'carmen',
        es: '¿Y de dónde eres?',
        en: 'And where are you from?',
        grammar: 'Origin always takes SER: soy de + place.',
        input: {
          pattern: '^\\s*(yo\\s+)?soy\\s+de\\s+\\S+',
          capture: 'soy\\s+de\\s+(.+?)[.!]*$',
          example: 'Soy de Londres.',
          hint: 'Start with "Soy de…" and add your city or country.',
          saveAs: 'homeTown',
          wrong: [
            { pattern: '^\\s*(yo\\s+)?estoy\\s+de', feedback: 'For origin, use ser, not estar: "Soy de…".', category: 'ser-estar' },
            { pattern: '^\\s*(yo\\s+)?es\\s+de', feedback: 'With yo, ser is "soy": "Soy de…".', category: 'person-agreement' },
          ],
          next: 'p6',
        },
      },
      {
        id: 'p6', speaker: 'carmen',
        es: '¡Ah, {homeTown}! Qué bien. ¿Y a qué te dedicas?',
        en: 'Ah, {homeTown}! Lovely. And what do you do for a living?',
        grammar: '"¿A qué te dedicas?" is the natural way to ask about someone\'s job. Note: no article with professions — soy médico, not "soy un médico".',
        choices: [
          { es: 'Trabajo en remoto, desde casa.', en: 'I work remotely, from home.', next: 'p7', quality: 'great', rel: 4 },
          { es: 'Busco trabajo aquí en Madrid.', en: 'I\'m looking for work here in Madrid.', next: 'p7', quality: 'great', rel: 4, feedback: 'Busco trabajo — no "for" needed after buscar.' },
          { es: 'Soy estudiante.', en: 'I\'m a student.', next: 'p7', quality: 'great', rel: 4 },
          { es: 'Estoy {g:profesor|profesora}.', en: '(I am [temporarily] a teacher.)', next: 'p7', quality: 'off', category: 'ser-estar', feedback: 'Professions take ser: soy profesor/a.' },
        ],
      },
      {
        id: 'p7', speaker: 'carmen',
        es: '¡Qué bien! Oye, el piso es pequeño pero muy luminoso. Y la farmacia está aquí al lado.',
        en: 'Great! Listen, the flat is small but very bright. And the pharmacy is right next door.',
        vocab: ['piso', 'farmacia'],
        grammar: 'Es pequeño → ser for characteristics. Está al lado → estar for location.',
        next: 'p8',
      },
      {
        id: 'p8', speaker: 'lucia',
        es: 'Pregunta rápida: ¿cómo dices "the pharmacy is next to the café"?',
        en: 'Quick question: how do you say "the pharmacy is next to the café"?',
        choices: [
          { es: 'La farmacia está al lado del café.', en: 'The pharmacy is next to the café.', next: 'p9', quality: 'great', rel: 3, feedback: 'Exacto: location → estar.' },
          { es: 'La farmacia es al lado del café.', en: '(The pharmacy is [ser] next to the café.)', next: 'p8', quality: 'off', category: 'ser-estar', feedback: 'Where something is → estar. Try again.' },
          { es: 'La farmacia están al lado del café.', en: '(The pharmacy are next to the café.)', next: 'p8', quality: 'off', category: 'person-agreement', feedback: 'One pharmacy → singular: está. Try again.' },
        ],
      },
      {
        id: 'p9', speaker: 'carmen',
        es: 'Toma, la llave del portal. Si necesitas algo, vivo en el tercero B. Llama cuando quieras.',
        en: 'Here, the key to the front door. If you need anything, I live in 3B. Knock whenever you like.',
        vocab: ['llave', 'portal'],
        choices: [
          { es: '¡Muchísimas gracias, Carmen! Eres muy amable.', en: 'Thank you so much, Carmen! You\'re very kind.', next: 'p10', quality: 'great', rel: 6, feedback: 'Eres muy amable — ser for a personality trait.' },
          { es: 'Gracias. ¿Hay mucho ruido por la noche?', en: 'Thanks. Is it noisy at night?', next: 'p9b', quality: 'great', rel: 3 },
        ],
      },
      { id: 'p9b', speaker: 'carmen', es: 'Bueno… es Lavapiés. ¡Los fines de semana hay mucha marcha! Pero es un barrio con mucha vida.', en: 'Well… it\'s Lavapiés. There\'s lots going on at weekends! But it\'s a neighbourhood full of life.', vocab: ['ruido'], next: 'p10' },
      { id: 'p10', speaker: 'carmen', es: 'Ah, y si quieres un buen café, ve al Café La Plaza. Javi, el camarero, es un encanto.', en: 'Oh, and if you want a good coffee, go to Café La Plaza. Javi, the waiter, is a sweetheart.', vocab: ['camarero'], end: true },
    ]),
  },

  // ─────────────────────────── 3. THE CAFÉ ───────────────────────────
  {
    id: 'cafe',
    title: 'Café La Plaza',
    titleEs: 'Café La Plaza',
    place: 'Plaza de Lavapiés',
    blurb: 'Order like a local, meet Marta, and make your first plans in Madrid.',
    goals: ['Order naturally (¿Me pones…?)', 'Talk about what you like with gustar', 'Make plans with quedar'],
    requires: 'piso',
    cast: ['javi', 'marta'],
    vocab: ['cafe-con-leche', 'tostada', 'cuenta', 'terraza', 'quedar', 'camarero', 'vale', 'amigo'],
    verbs: ['poner', 'querer', 'gustar', 'hablar', 'vivir', 'pagar', 'volver', 'dar'],
    start: 'c1',
    outro: 'You have a new friend and plans for the week. Your Madrid life is starting to feel real.',
    nodes: nodes([
      { id: 'c1', speaker: 'narrator', es: 'Café La Plaza. Huele a café recién hecho y la terraza está al sol.', en: 'Café La Plaza. It smells of fresh coffee and the terrace is in the sun.', vocab: ['terraza'], next: 'c2' },
      {
        id: 'c2', speaker: 'javi',
        es: '¡Buenas! ¿Qué te pongo?',
        en: 'Hi! What can I get you?',
        grammar: '"¿Qué te pongo?" (lit. "what do I put for you?") is how bar staff in Spain take orders. In Mexico you\'d more often hear "¿Qué le sirvo?" or "¿Qué va a querer?".',
        choices: [
          { es: '¿Me pones un café con leche, por favor?', en: 'Can I have a white coffee, please?', next: 'c3', quality: 'great', rel: 6, setFlag: ['order', 'coffee'], feedback: 'Very natural in Spain — exactly how locals order.' },
          { es: 'Quiero un café con leche, por favor.', en: 'I\'d like a white coffee, please.', next: 'c3', quality: 'great', rel: 4, setFlag: ['order', 'coffee'], feedback: 'Correct and polite with "por favor".' },
          { es: 'Dame un café.', en: 'Give me a coffee.', next: 'c3', quality: 'ok', rel: 0, setFlag: ['order', 'coffee'], category: 'register', feedback: 'Grammatically fine and common in busy bars, but it can sound abrupt without "por favor".' },
          { es: 'Yo pone un café.', en: '(I puts a coffee.)', next: 'c2', quality: 'off', category: 'irregular-yo', feedback: '"Pone" is for él / ella, and "I put" would be "pongo" — but to order, ask: "¿Me pones un café?" Try again.' },
        ],
      },
      {
        id: 'c3', speaker: 'javi',
        es: '¡Marchando! ¿Algo para comer? Tenemos tostadas con tomate.',
        en: 'Coming right up! Anything to eat? We\'ve got toast with tomato.',
        vocab: ['tostada'],
        grammar: '"¡Marchando!" = coming right up (bar slang). Tostada con tomate is a classic Spanish breakfast.',
        choices: [
          { es: 'Sí, una tostada con tomate, por favor.', en: 'Yes, toast with tomato, please.', next: 'c4', quality: 'great', rel: 3, setFlag: ['order', 'toast'] },
          { es: 'No, gracias. Solo el café.', en: 'No, thanks. Just the coffee.', next: 'c4', quality: 'great', rel: 2 },
        ],
      },
      {
        id: 'c4', speaker: 'javi',
        es: 'Oye, tú no eres de aquí, ¿no? Hablas muy bien español.',
        en: 'Hey, you\'re not from round here, are you? You speak Spanish really well.',
        grammar: '"Oye" (from oír) = hey / listen — a friendly way to get someone\'s attention.',
        choices: [
          { es: '¡Gracias! Acabo de llegar. Vivo aquí al lado.', en: 'Thanks! I\'ve just arrived. I live right nearby.', next: 'c5', quality: 'great', rel: 6, feedback: '"Acabo de llegar" = I\'ve just arrived. Very useful!' },
          { es: '¡Gracias! Pero solo hablo un poco.', en: 'Thanks! But I only speak a little.', next: 'c5', quality: 'great', rel: 4 },
          { es: '¡Gracias! Pero solo hablas un poco.', en: '(Thanks! But you only speak a little.)', next: 'c5', quality: 'off', category: 'person-agreement', feedback: 'Oops, "hablas" = you speak. You meant "hablo".' },
        ],
      },
      { id: 'c5', speaker: 'narrator', es: 'Entra Marta, una amiga de Javi, y se sienta a tu lado.', en: 'Marta, a friend of Javi\'s, comes in and sits down next to you.', next: 'c6' },
      {
        id: 'c6', speaker: 'marta',
        es: '¡Hola! Soy Marta. ¿Eres {g:el nuevo vecino|la nueva vecina} de Carmen? ¡Aquí todo se sabe!',
        en: 'Hi! I\'m Marta. Are you Carmen\'s new neighbour? Word travels fast round here!',
        choices: [
          { es: '¡Sí! Soy {name}. {g:Encantado|Encantada}.', en: 'Yes! I\'m {name}. Nice to meet you.', next: 'c7', quality: 'great', rel: 6 },
          { es: 'Sí, estoy {name}.', en: '(Yes, I am [estar] {name}.)', next: 'c7', quality: 'off', category: 'ser-estar', feedback: 'Your name is your identity → ser: "Soy {name}".' },
        ],
      },
      {
        id: 'c7', speaker: 'marta',
        es: '¿Y qué te gusta hacer en tu tiempo libre?',
        en: 'And what do you like doing in your free time?',
        grammar: 'Gustar + infinitive: ¿Qué te gusta hacer? → Me gusta correr. Me encanta = I love.',
        choicesFrom: 'interests',
      },
      {
        id: 'c8', speaker: 'marta',
        es: INTEREST_LINES.default.invite.es,
        en: INTEREST_LINES.default.invite.en,
        variantFlag: 'interest',
        variants: Object.fromEntries(Object.entries(INTEREST_LINES).map(([k, v]) => [k, v.invite])),
        grammar: '"¿Te apuntas?" = are you in? / want to join? — very common in Spain.',
        choices: [
          { es: '¡Me encantaría! ¿A qué hora quedamos?', en: 'I\'d love to! What time shall we meet?', next: 'c9', quality: 'great', rel: 10, feedback: '"Me encantaría" (I\'d love to) + "quedamos" (we meet up). ¡Genial!' },
          { es: '¡Vale! ¿Dónde quedamos?', en: 'OK! Where shall we meet?', next: 'c9', quality: 'great', rel: 8 },
          { es: 'Lo siento, esta semana no puedo, pero otro día sí.', en: 'Sorry, I can\'t this week, but another day for sure.', next: 'c9', quality: 'great', rel: 4, feedback: 'A perfectly polite way to decline.' },
        ],
      },
      {
        id: 'c9', speaker: 'marta',
        es: '¡Genial! Te escribo por WhatsApp. ¿Me das tu número?',
        en: 'Great! I\'ll message you on WhatsApp. Will you give me your number?',
        grammar: 'Quedar = to arrange to meet. "¿Me das…?" (lit. do you give me…?) is a natural, friendly way to ask for something.',
        branchIf: { condition: 'dating', then: 'c9d', else: 'c10' },
        choices: [
          { es: '¡Claro! Toma, aquí tienes mi número.', en: 'Of course! Here\'s my number.', next: '__branch', quality: 'great', rel: 5 },
        ],
      },
      {
        id: 'c9d', speaker: 'marta',
        es: 'Por cierto… ¿tienes pareja, o estás disfrutando de la soltería en Madrid?',
        en: 'By the way… do you have a partner, or are you enjoying the single life in Madrid?',
        grammar: '"Tener pareja" = to have a partner (gender-neutral). "Estar soltero/a" = to be single.',
        choices: [
          { es: 'Estoy {g:soltero|soltera}, ¡y {g:abierto|abierta} a conocer gente!', en: 'I\'m single, and open to meeting people!', next: 'c9e', quality: 'great', rel: 5, feedback: 'Both "soy soltero/a" and "estoy soltero/a" are common; estar is very frequent in conversation.' },
          { es: 'Sí, tengo pareja.', en: 'Yes, I have a partner.', next: 'c10', quality: 'great', rel: 3 },
          { es: 'Prefiero no hablar de eso, ¡jaja!', en: 'I\'d rather not talk about that, haha!', next: 'c10', quality: 'great', rel: 3, feedback: 'A perfectly polite boundary.' },
        ],
      },
      { id: 'c9e', speaker: 'marta', es: '¡Pues Madrid es perfecto para eso! Ya te presentaré a mis amigos.', en: 'Well, Madrid is perfect for that! I\'ll introduce you to my friends.', next: 'c10' },
      {
        id: 'c10', speaker: 'javi',
        es: 'Aquí tienes. Son dos euros con cincuenta.',
        en: 'Here you go. That\'s two euros fifty.',
        variantFlag: 'order',
        variants: {
          coffee: { es: 'Aquí tienes. Son dos euros con cincuenta.', en: 'Here you go. That\'s two euros fifty.' },
          toast: { es: 'Aquí tienes. El café y la tostada son cuatro euros con veinte.', en: 'Here you go. The coffee and the toast come to four euros twenty.' },
        },
        vocab: ['cuenta'],
        choices: [
          { es: '¿Puedo pagar con tarjeta?', en: 'Can I pay by card?', next: 'c11', quality: 'great', rel: 3 },
          { es: 'Aquí tienes. ¡Gracias, Javi!', en: 'Here you are. Thanks, Javi!', next: 'c11', quality: 'great', rel: 5 },
        ],
      },
      { id: 'c11', speaker: 'javi', es: '¡A ti! Pues nada, ¡hasta luego! Vuelve cuando quieras.', en: 'Thank you! Well then, see you later! Come back whenever you like.', grammar: '"Pues nada" is a classic Spanish filler to wrap up a conversation.', end: true },
    ]),
  },
];

export const SCENE_BY_ID: Record<string, Scene> = Object.fromEntries(SCENES.map((s) => [s.id, s]));

/** Future chapters shown on the map. Locked; not playable in this version. */
export const FUTURE_LOCATIONS = [
  { id: 'mercado', title: 'Mercado de San Fernando', theme: 'Shopping & everyday life' },
  { id: 'gimnasio', title: 'El gimnasio', theme: 'Sports clubs & hobbies' },
  { id: 'oficina', title: 'La oficina', theme: 'Work & colleagues' },
  { id: 'centro-salud', title: 'Centro de salud', theme: 'Healthcare & admin' },
  { id: 'bar-tapas', title: 'Bar de tapas', theme: 'Friends & dating' },
];
