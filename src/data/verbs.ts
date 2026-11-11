// ───────────────────────────────────────────────────────────────
// VIVA verb engine data.
// Present-tense forms are hand-written and unit-tested.
// Progressive and perfect forms are generated from the gerund /
// past participle with the correct auxiliary (estar / haber).
//
// `origin` = genuine etymology (Latin root + English cognate).
// `trick`  = an invented memory aid, always labelled as such in the UI.
// ───────────────────────────────────────────────────────────────

import { conjugateSimple, type SimpleTense } from './conjugation';
import { LEXICON, type VerbLevel } from './lexicon';

export type Tense = 'present' | 'progressive' | 'perfect' | SimpleTense;
export const TENSES: { id: Tense; label: string; es: string; minLevel: VerbLevel }[] = [
  { id: 'present', label: 'Present', es: 'Presente', minLevel: 'A1' },
  { id: 'progressive', label: 'Present progressive', es: 'Presente continuo', minLevel: 'A2' },
  { id: 'perfect', label: 'Present perfect', es: 'Pretérito perfecto', minLevel: 'A2' },
  { id: 'preterite', label: 'Preterite', es: 'Pretérito indefinido', minLevel: 'A2' },
  { id: 'imperfect', label: 'Imperfect', es: 'Pretérito imperfecto', minLevel: 'A2' },
  { id: 'imperative', label: 'Commands', es: 'Imperativo', minLevel: 'A2' },
  { id: 'future', label: 'Future', es: 'Futuro simple', minLevel: 'B1' },
  { id: 'conditional', label: 'Conditional', es: 'Condicional', minLevel: 'B1' },
  { id: 'subjunctive', label: 'Present subjunctive', es: 'Presente de subjuntivo', minLevel: 'B1' },
  { id: 'imperfect-subjunctive', label: 'Imperfect subjunctive', es: 'Imperfecto de subjuntivo', minLevel: 'B2' },
];
export const TENSE_BY_ID: Record<Tense, (typeof TENSES)[number]> = Object.fromEntries(TENSES.map((t) => [t.id, t])) as Record<Tense, (typeof TENSES)[number]>;

/** Tenses in the curriculum roadmap that are not yet implemented as drills. */
export const ROADMAP_TENSES = [
  'Negative commands',
  'Pluperfect & other compound tenses',
  'Future perfect & conditional perfect',
];

export const PERSONS = ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / ellas / ustedes'] as const;
export const PERSONS_EN = ['I', 'you (informal)', 'he / she / you (formal)', 'we', 'you all (Spain)', 'they / you all'] as const;

export type VerbGroup = 'regular' | 'stem-e-ie' | 'stem-o-ue' | 'stem-e-i' | 'stem-u-ue' | 'irregular-yo' | 'irregular';

export interface VerbExample {
  /** Sentence with the conjugated verb wrapped in {braces}. */
  es: string;
  en: string;
  person: number;
}

export interface Verb {
  inf: string;
  en: string;
  group: VerbGroup;
  present: [string, string, string, string, string, string];
  gerund: string;
  participle: string;
  frequencyRank: number; // 1 = most common in our curriculum ordering
  level: VerbLevel;
  origin?: string;
  trick: string;
  note?: string;
  examples: VerbExample[];
  /** gustar-type verbs conjugate with indirect object pronouns. */
  pronominal?: boolean;
}

export const VERBS: Verb[] = [
  {
    inf: 'ser', en: 'to be (identity, origin, profession)', group: 'irregular',
    present: ['soy', 'eres', 'es', 'somos', 'sois', 'son'], gerund: 'siendo', participle: 'sido',
    frequencyRank: 1, level: 'A1',
    origin: 'From Latin esse, "to be" — English "essence"; some forms (e.g. sido, sea) come from sedere, "to sit".',
    trick: 'SER is for what you ARE at the core: think "SERious, permanent facts" — name, nationality, job.',
    note: 'Use ser for identity, origin, profession, time and characteristics. Use estar for location and temporary states.',
    examples: [
      { es: 'Yo {soy} de Londres.', en: 'I am from London.', person: 0 },
      { es: 'Madrid {es} una ciudad preciosa.', en: 'Madrid is a beautiful city.', person: 2 },
      { es: 'Nosotros {somos} vecinos.', en: 'We are neighbours.', person: 3 },
    ],
  },
  {
    inf: 'estar', en: 'to be (location, state, mood)', group: 'irregular',
    present: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'], gerund: 'estando', participle: 'estado',
    frequencyRank: 2, level: 'A1',
    origin: 'From Latin stare, "to stand" — English "state", "station", "stable".',
    trick: '"How you feel and where you are — that is when you use ESTAR."',
    note: 'Estar describes where something is and how something is right now.',
    examples: [
      { es: 'Yo {estoy} un poco cansado.', en: 'I am a little tired.', person: 0 },
      { es: 'El metro {está} muy cerca.', en: 'The metro is very close.', person: 2 },
      { es: '¿Dónde {estás}?', en: 'Where are you?', person: 1 },
    ],
  },
  {
    inf: 'tener', en: 'to have', group: 'irregular',
    present: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'], gerund: 'teniendo', participle: 'tenido',
    frequencyRank: 3, level: 'A1',
    origin: 'From Latin tenere, "to hold" — English "tenant", "tenacious".',
    trick: 'A TENant HOLDS (has) the keys: tener = to have.',
    note: 'Irregular yo form (tengo) plus e→ie stem change (tienes, tiene, tienen). Also used for age: tengo 30 años.',
    examples: [
      { es: 'Yo {tengo} una reserva.', en: 'I have a reservation.', person: 0 },
      { es: '¿{Tienes} hambre?', en: 'Are you hungry? (lit. do you have hunger?)', person: 1 },
      { es: 'Ella {tiene} un perro muy simpático.', en: 'She has a very friendly dog.', person: 2 },
    ],
  },
  {
    inf: 'hacer', en: 'to do / to make', group: 'irregular-yo',
    present: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'], gerund: 'haciendo', participle: 'hecho',
    frequencyRank: 4, level: 'A1',
    origin: 'From Latin facere — English "fact", "factory".',
    trick: 'A FACtory MAKES things — hacer (facere) = to make / do.',
    note: 'Only the yo form is irregular: hago. Also for weather: hace calor.',
    examples: [
      { es: 'Hoy {hace} mucho calor.', en: 'It is very hot today.', person: 2 },
      { es: 'Yo {hago} yoga los lunes.', en: 'I do yoga on Mondays.', person: 0 },
      { es: '¿Qué {hacéis} esta noche?', en: 'What are you all doing tonight?', person: 4 },
    ],
  },
  {
    inf: 'ir', en: 'to go', group: 'irregular',
    present: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'], gerund: 'yendo', participle: 'ido',
    frequencyRank: 5, level: 'A1',
    origin: 'From Latin ire (as in English "exit" = ex + ire, "go out"); the v- forms come from Latin vadere.',
    trick: '¡VAMOS! — the "let\'s go!" you will hear everywhere.',
    note: 'Ir a + infinitive = going to do something: voy a comer.',
    examples: [
      { es: 'Yo {voy} al centro en metro.', en: 'I go to the centre by metro.', person: 0 },
      { es: '¿{Vamos} a tomar algo?', en: 'Shall we go for a drink?', person: 3 },
      { es: 'Ellos {van} al gimnasio.', en: 'They go to the gym.', person: 5 },
    ],
  },
  {
    inf: 'venir', en: 'to come', group: 'irregular',
    present: ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen'], gerund: 'viniendo', participle: 'venido',
    frequencyRank: 6, level: 'A1',
    origin: 'From Latin venire — English "venue", "convene", "event".',
    trick: 'People COME to a VENue: venir = to come.',
    note: 'Like tener: irregular yo (vengo) + e→ie (vienes, viene, vienen).',
    examples: [
      { es: '¿{Vienes} a la fiesta?', en: 'Are you coming to the party?', person: 1 },
      { es: 'Yo {vengo} del trabajo.', en: 'I\'m coming from work.', person: 0 },
    ],
  },
  {
    inf: 'querer', en: 'to want / to love', group: 'stem-e-ie',
    present: ['quiero', 'quieres', 'quiere', 'queremos', 'queréis', 'quieren'], gerund: 'queriendo', participle: 'querido',
    frequencyRank: 7, level: 'A1',
    origin: 'From Latin quaerere, "to seek" — English "query", "quest".',
    trick: 'On a QUEst you go after what you WANT.',
    note: 'Te quiero = I love you (warm, for friends, family and partners).',
    examples: [
      { es: 'Yo {quiero} un café con leche, por favor.', en: 'I want a white coffee, please.', person: 0 },
      { es: '¿{Quieres} venir conmigo?', en: 'Do you want to come with me?', person: 1 },
    ],
  },
  {
    inf: 'poder', en: 'to be able to / can', group: 'stem-o-ue',
    present: ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden'], gerund: 'pudiendo', participle: 'podido',
    frequencyRank: 8, level: 'A1',
    origin: 'From Vulgar Latin *potere — English "potent", "potential".',
    trick: 'Someone POTENT CAN do anything: poder = can.',
    examples: [
      { es: '¿{Puedo} pagar con tarjeta?', en: 'Can I pay by card?', person: 0 },
      { es: '¿Me {puede} ayudar, por favor?', en: 'Can you (formal) help me, please?', person: 2 },
    ],
  },
  {
    inf: 'saber', en: 'to know (facts, how to)', group: 'irregular',
    present: ['sé', 'sabes', 'sabe', 'sabemos', 'sabéis', 'saben'], gerund: 'sabiendo', participle: 'sabido',
    frequencyRank: 9, level: 'A1',
    origin: 'From Latin sapere, "to taste / to be wise" — English "sapient", "savvy".',
    trick: 'A SAVvy person KNOWS things: saber = to know facts.',
    note: 'Saber = know facts / how to do something. Conocer = know people and places. Note the accent: sé (I know) vs se (pronoun).',
    examples: [
      { es: 'No {sé} dónde está la estación.', en: 'I don\'t know where the station is.', person: 0 },
      { es: '¿{Sabes} cocinar?', en: 'Do you know how to cook?', person: 1 },
    ],
  },
  {
    inf: 'conocer', en: 'to know (people, places), to meet', group: 'irregular-yo',
    present: ['conozco', 'conoces', 'conoce', 'conocemos', 'conocéis', 'conocen'], gerund: 'conociendo', participle: 'conocido',
    frequencyRank: 10, level: 'A1',
    origin: 'From Latin cognoscere — English "recognise", "cognition".',
    trick: 'You RECOGNISE people you CONOCE.',
    note: 'Irregular yo: conozco. Encantado de conocerte = nice to meet you.',
    examples: [
      { es: 'No {conozco} bien Madrid.', en: 'I don\'t know Madrid well.', person: 0 },
      { es: '¿{Conoces} a Javi?', en: 'Do you know Javi?', person: 1 },
    ],
  },
  {
    inf: 'decir', en: 'to say / to tell', group: 'irregular',
    present: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'], gerund: 'diciendo', participle: 'dicho',
    frequencyRank: 11, level: 'A1',
    origin: 'From Latin dicere — English "dictate", "diction", "verdict".',
    trick: 'A DICtionary tells you what words SAY.',
    note: 'Irregular yo (digo) and e→i change (dices, dice, dicen). On the phone in Spain: ¿Dígame?',
    examples: [
      { es: '¿Cómo se {dice} "receipt" en español?', en: 'How do you say "receipt" in Spanish?', person: 2 },
      { es: 'Yo siempre {digo} la verdad.', en: 'I always tell the truth.', person: 0 },
    ],
  },
  {
    inf: 'hablar', en: 'to speak / to talk', group: 'regular',
    present: ['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan'], gerund: 'hablando', participle: 'hablado',
    frequencyRank: 12, level: 'A1',
    origin: 'From Latin fabulari, "to chat" — the same root as English "fable".',
    trick: 'A FABLE is something people TALK about: hablar.',
    note: 'Model regular -ar verb: -o, -as, -a, -amos, -áis, -an.',
    examples: [
      { es: 'Yo {hablo} un poco de español.', en: 'I speak a little Spanish.', person: 0 },
      { es: '¿{Hablas} inglés?', en: 'Do you speak English?', person: 1 },
      { es: 'En mi trabajo {hablamos} en español.', en: 'At my work we speak in Spanish.', person: 3 },
    ],
  },
  {
    inf: 'comer', en: 'to eat', group: 'regular',
    present: ['como', 'comes', 'come', 'comemos', 'coméis', 'comen'], gerund: 'comiendo', participle: 'comido',
    frequencyRank: 13, level: 'A1',
    origin: 'From Latin comedere (com- + edere, "to eat") — related to English "edible".',
    trick: 'COME and EAT! — comer.',
    note: 'Model regular -er verb: -o, -es, -e, -emos, -éis, -en. In Spain, la comida is often lunch, around 2–3 pm.',
    examples: [
      { es: 'En España {comemos} muy tarde.', en: 'In Spain we eat very late.', person: 3 },
      { es: 'Yo no {como} carne.', en: 'I don\'t eat meat.', person: 0 },
    ],
  },
  {
    inf: 'beber', en: 'to drink', group: 'regular',
    present: ['bebo', 'bebes', 'bebe', 'bebemos', 'bebéis', 'beben'], gerund: 'bebiendo', participle: 'bebido',
    frequencyRank: 14, level: 'A1',
    origin: 'From Latin bibere — English "imbibe", "beverage".',
    trick: 'A BEverage is something you BEBE.',
    examples: [
      { es: '¿Qué {bebes}?', en: 'What are you drinking? / What do you drink?', person: 1 },
      { es: 'Yo {bebo} agua con gas.', en: 'I drink sparkling water.', person: 0 },
    ],
  },
  {
    inf: 'vivir', en: 'to live', group: 'regular',
    present: ['vivo', 'vives', 'vive', 'vivimos', 'vivís', 'viven'], gerund: 'viviendo', participle: 'vivido',
    frequencyRank: 15, level: 'A1',
    origin: 'From Latin vivere — English "vivid", "survive", "revive".',
    trick: '¡VIVA! — long live! A VIVID life.',
    note: 'Model regular -ir verb: -o, -es, -e, -imos, -ís, -en.',
    examples: [
      { es: 'Yo {vivo} en Lavapiés.', en: 'I live in Lavapiés.', person: 0 },
      { es: '¿Dónde {vives}?', en: 'Where do you live?', person: 1 },
      { es: 'Mis amigos {viven} cerca del Retiro.', en: 'My friends live near the Retiro.', person: 5 },
    ],
  },
  {
    inf: 'trabajar', en: 'to work', group: 'regular',
    present: ['trabajo', 'trabajas', 'trabaja', 'trabajamos', 'trabajáis', 'trabajan'], gerund: 'trabajando', participle: 'trabajado',
    frequencyRank: 16, level: 'A1',
    origin: 'Traditionally traced to Vulgar Latin *tripaliare, from tripalium, a three-stake device — work as hardship.',
    trick: 'TRAvel to the BAJA office every day to WORK.',
    examples: [
      { es: 'Yo {trabajo} desde casa.', en: 'I work from home.', person: 0 },
      { es: '¿En qué {trabajas}?', en: 'What do you do for work?', person: 1 },
    ],
  },
  {
    inf: 'estudiar', en: 'to study', group: 'regular',
    present: ['estudio', 'estudias', 'estudia', 'estudiamos', 'estudiáis', 'estudian'], gerund: 'estudiando', participle: 'estudiado',
    frequencyRank: 17, level: 'A1',
    origin: 'From Latin studium, "zeal, study" — English "study", "student".',
    trick: 'Add an E to the front of STUDY: E-STUDI-AR.',
    examples: [
      { es: 'Yo {estudio} español cada día.', en: 'I study Spanish every day.', person: 0 },
      { es: 'Marta {estudia} diseño.', en: 'Marta studies design.', person: 2 },
    ],
  },
  {
    inf: 'necesitar', en: 'to need', group: 'regular',
    present: ['necesito', 'necesitas', 'necesita', 'necesitamos', 'necesitáis', 'necesitan'], gerund: 'necesitando', participle: 'necesitado',
    frequencyRank: 18, level: 'A1',
    origin: 'From Latin necessitas — English "necessity".',
    trick: 'A NECESSITY is something you NEED.',
    examples: [
      { es: '{Necesito} un billete de metro.', en: 'I need a metro ticket.', person: 0 },
      { es: '¿{Necesitas} ayuda?', en: 'Do you need help?', person: 1 },
    ],
  },
  {
    inf: 'gustar', en: 'to like (lit. to be pleasing)', group: 'regular', pronominal: true,
    present: ['me gusta', 'te gusta', 'le gusta', 'nos gusta', 'os gusta', 'les gusta'], gerund: 'gustando', participle: 'gustado',
    frequencyRank: 19, level: 'A1',
    origin: 'From Latin gustare, "to taste" — English "gusto", "disgust".',
    trick: 'Things you like you eat with GUSTO.',
    note: 'The thing liked is the subject: me gusta el café (singular), me gustan los churros (plural). The pronoun shows WHO likes it.',
    examples: [
      { es: '{Me gusta} mucho este barrio.', en: 'I really like this neighbourhood.', person: 0 },
      { es: '¿{Te gusta} el fútbol?', en: 'Do you like football?', person: 1 },
      { es: 'A Carmen {le gusta} el teatro.', en: 'Carmen likes the theatre.', person: 2 },
    ],
  },
  {
    inf: 'salir', en: 'to go out / to leave', group: 'irregular-yo',
    present: ['salgo', 'sales', 'sale', 'salimos', 'salís', 'salen'], gerund: 'saliendo', participle: 'salido',
    frequencyRank: 20, level: 'A1',
    origin: 'From Latin salire, "to jump" — English "salient", "sally (forth)".',
    trick: 'SALIDA is the EXIT sign you see in every metro station.',
    note: 'Irregular yo: salgo. Salir con alguien = to go out with / date someone.',
    examples: [
      { es: 'Los viernes {salgo} con mis amigos.', en: 'On Fridays I go out with my friends.', person: 0 },
      { es: 'El tren {sale} a las ocho.', en: 'The train leaves at eight.', person: 2 },
    ],
  },
  {
    inf: 'poner', en: 'to put / to set', group: 'irregular-yo',
    present: ['pongo', 'pones', 'pone', 'ponemos', 'ponéis', 'ponen'], gerund: 'poniendo', participle: 'puesto',
    frequencyRank: 21, level: 'A1',
    origin: 'From Latin ponere, "to place" — English "position", "postpone", "component".',
    trick: 'You POSITION things — you PUT them.',
    note: 'In a Spanish bar: ¿Me pones una caña? = Can I have a small beer? (very common and natural).',
    examples: [
      { es: '¿Me {pones} un café, por favor?', en: 'Can I have a coffee, please?', person: 1 },
      { es: 'Yo {pongo} la mesa.', en: 'I set the table.', person: 0 },
    ],
  },
  {
    inf: 'dar', en: 'to give', group: 'irregular',
    present: ['doy', 'das', 'da', 'damos', 'dais', 'dan'], gerund: 'dando', participle: 'dado',
    frequencyRank: 22, level: 'A1',
    origin: 'From Latin dare, "to give" — English "data" (literally "things given").',
    trick: 'DATA is what you are GIVEN.',
    note: 'Note: dais (vosotros) has no accent because it is one syllable.',
    examples: [
      { es: 'Te {doy} mi número.', en: 'I\'ll give you my number.', person: 0 },
      { es: '¿Me {das} la llave?', en: 'Will you give me the key?', person: 1 },
    ],
  },
  {
    inf: 'ver', en: 'to see / to watch', group: 'irregular-yo',
    present: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'], gerund: 'viendo', participle: 'visto',
    frequencyRank: 23, level: 'A1',
    origin: 'From Latin videre — English "video", "vision".',
    trick: 'You SEE a VIDEO.',
    note: 'Irregular yo (veo) and participle (visto). ¡Nos vemos! = See you!',
    examples: [
      { es: '¡Nos {vemos} mañana!', en: 'See you tomorrow!', person: 3 },
      { es: 'Yo {veo} series en español.', en: 'I watch series in Spanish.', person: 0 },
    ],
  },
  {
    inf: 'llevar', en: 'to carry / to wear / to take', group: 'regular',
    present: ['llevo', 'llevas', 'lleva', 'llevamos', 'lleváis', 'llevan'], gerund: 'llevando', participle: 'llevado',
    frequencyRank: 24, level: 'A1',
    origin: 'From Latin levare, "to lift" — English "lever", "elevate".',
    trick: 'A LEVER helps you lift and CARRY things.',
    note: 'Llevo dos años aquí = I have been here for two years. Para llevar = to take away.',
    examples: [
      { es: 'Para {llevar}, por favor.', en: 'To take away, please.', person: -1 },
      { es: '{Llevo} una maleta grande.', en: 'I\'m carrying a big suitcase.', person: 0 },
    ],
  },
  {
    inf: 'comprar', en: 'to buy', group: 'regular',
    present: ['compro', 'compras', 'compra', 'compramos', 'compráis', 'compran'], gerund: 'comprando', participle: 'comprado',
    frequencyRank: 25, level: 'A1',
    origin: 'From Vulgar Latin comparare, "to procure".',
    trick: 'You COMPARE prices before you BUY.',
    examples: [
      { es: 'Yo {compro} el pan en la panadería de la esquina.', en: 'I buy bread at the bakery on the corner.', person: 0 },
      { es: '¿Dónde {compras} la fruta?', en: 'Where do you buy fruit?', person: 1 },
    ],
  },
  {
    inf: 'pedir', en: 'to ask for / to order', group: 'stem-e-i',
    present: ['pido', 'pides', 'pide', 'pedimos', 'pedís', 'piden'], gerund: 'pidiendo', participle: 'pedido',
    frequencyRank: 26, level: 'A1',
    origin: 'From Latin petere, "to seek" — English "petition".',
    trick: 'You sign a PETITION to ASK FOR something.',
    note: 'Pedir = ask FOR something (order). Preguntar = ask a question.',
    examples: [
      { es: 'Yo {pido} la cuenta.', en: 'I\'ll ask for the bill.', person: 0 },
      { es: '¿Qué {pides}?', en: 'What are you ordering?', person: 1 },
    ],
  },
  {
    inf: 'encontrar', en: 'to find', group: 'stem-o-ue',
    present: ['encuentro', 'encuentras', 'encuentra', 'encontramos', 'encontráis', 'encuentran'], gerund: 'encontrando', participle: 'encontrado',
    frequencyRank: 27, level: 'A1',
    origin: 'From en + contra, "against / facing" — English "encounter".',
    trick: 'You ENCOUNTER (find) things.',
    examples: [
      { es: 'No {encuentro} mis llaves.', en: 'I can\'t find my keys.', person: 0 },
      { es: '¿{Encuentras} las llaves?', en: 'Can you find the keys?', person: 1 },
    ],
  },
  {
    inf: 'pensar', en: 'to think', group: 'stem-e-ie',
    present: ['pienso', 'piensas', 'piensa', 'pensamos', 'pensáis', 'piensan'], gerund: 'pensando', participle: 'pensado',
    frequencyRank: 28, level: 'A1',
    origin: 'From Latin pensare, "to weigh up" — English "pensive".',
    trick: 'A PENSIVE person is THINKING.',
    examples: [
      { es: '¿Qué {piensas}?', en: 'What do you think?', person: 1 },
      { es: '{Pienso} que es una buena idea.', en: 'I think it\'s a good idea.', person: 0 },
    ],
  },
  {
    inf: 'dormir', en: 'to sleep', group: 'stem-o-ue',
    present: ['duermo', 'duermes', 'duerme', 'dormimos', 'dormís', 'duermen'], gerund: 'durmiendo', participle: 'dormido',
    frequencyRank: 29, level: 'A1',
    origin: 'From Latin dormire — English "dormitory", "dormant".',
    trick: 'You SLEEP in a DORMitory.',
    examples: [
      { es: 'Yo {duermo} fatal con este calor.', en: 'I sleep terribly in this heat.', person: 0 },
      { es: 'Madrid nunca {duerme}.', en: 'Madrid never sleeps.', person: 2 },
    ],
  },
  {
    inf: 'volver', en: 'to return / to come back', group: 'stem-o-ue',
    present: ['vuelvo', 'vuelves', 'vuelve', 'volvemos', 'volvéis', 'vuelven'], gerund: 'volviendo', participle: 'vuelto',
    frequencyRank: 30, level: 'A1',
    origin: 'From Latin volvere, "to roll / turn" — English "revolve".',
    trick: 'Things that REVOLVE come BACK around.',
    note: 'Irregular participle: vuelto. Volver a + infinitive = to do again.',
    examples: [
      { es: '{Vuelvo} a casa a las siete.', en: 'I get back home at seven.', person: 0 },
      { es: '¿Cuándo {vuelves}?', en: 'When are you coming back?', person: 1 },
    ],
  },
  // ── Additional high-frequency verbs ──
  {
    inf: 'entender', en: 'to understand', group: 'stem-e-ie',
    present: ['entiendo', 'entiendes', 'entiende', 'entendemos', 'entendéis', 'entienden'], gerund: 'entendiendo', participle: 'entendido',
    frequencyRank: 31, level: 'A1',
    origin: 'From Latin intendere, "to direct one\'s attention" — English "intend".',
    trick: 'You need to pay ATTENTION to UNDERSTAND.',
    examples: [
      { es: 'Perdón, no {entiendo}.', en: 'Sorry, I don\'t understand.', person: 0 },
      { es: '¿Me {entiendes}?', en: 'Do you understand me?', person: 1 },
    ],
  },
  {
    inf: 'escribir', en: 'to write', group: 'regular',
    present: ['escribo', 'escribes', 'escribe', 'escribimos', 'escribís', 'escriben'], gerund: 'escribiendo', participle: 'escrito',
    frequencyRank: 32, level: 'A1',
    origin: 'From Latin scribere — English "scribe", "script".',
    trick: 'A SCRIBE WRITES.',
    note: 'Regular in the present, irregular participle: escrito.',
    examples: [
      { es: 'Te {escribo} por WhatsApp.', en: 'I\'ll message you on WhatsApp.', person: 0 },
      { es: '¿Cómo se {escribe}?', en: 'How do you spell it?', person: 2 },
    ],
  },
  {
    inf: 'leer', en: 'to read', group: 'regular',
    present: ['leo', 'lees', 'lee', 'leemos', 'leéis', 'leen'], gerund: 'leyendo', participle: 'leído',
    frequencyRank: 33, level: 'A1',
    origin: 'From Latin legere — English "legible", "lecture".',
    trick: 'LEGIBLE writing is easy to READ.',
    note: 'Gerund changes i→y: leyendo.',
    examples: [{ es: 'Yo {leo} el periódico en el café.', en: 'I read the newspaper in the café.', person: 0 }],
  },
  {
    inf: 'jugar', en: 'to play (games, sport)', group: 'stem-u-ue',
    present: ['juego', 'juegas', 'juega', 'jugamos', 'jugáis', 'juegan'], gerund: 'jugando', participle: 'jugado',
    frequencyRank: 34, level: 'A1',
    origin: 'From Latin iocari, "to jest" — English "joke", "jocular".',
    trick: 'Games are no JOKE — JUEGO means "I play" and also "game".',
    note: 'The only common u→ue verb. Jugar AL fútbol (Spain) — in Mexico "jugar fútbol" is also common.',
    examples: [
      { es: 'Los domingos {juego} al pádel.', en: 'On Sundays I play padel.', person: 0 },
      { es: '¿{Juegas} al fútbol?', en: 'Do you play football?', person: 1 },
    ],
  },
  {
    inf: 'empezar', en: 'to start / to begin', group: 'stem-e-ie',
    present: ['empiezo', 'empiezas', 'empieza', 'empezamos', 'empezáis', 'empiezan'], gerund: 'empezando', participle: 'empezado',
    frequencyRank: 35, level: 'A2',
    trick: 'Start with a PIECE: em-PIEZ-o — the stem changes e→ie just like "piece".',
    examples: [
      { es: 'La película {empieza} a las nueve.', en: 'The film starts at nine.', person: 2 },
      { es: 'Mañana {empiezo} mi nuevo trabajo.', en: 'Tomorrow I start my new job.', person: 0 },
    ],
  },
  {
    inf: 'pagar', en: 'to pay', group: 'regular',
    present: ['pago', 'pagas', 'paga', 'pagamos', 'pagáis', 'pagan'], gerund: 'pagando', participle: 'pagado',
    frequencyRank: 36, level: 'A1',
    origin: 'From Latin pacare, "to pacify" (i.e. settle a debt) — English "pay" comes from the same word via Old French.',
    trick: 'PAGar ≈ PAY.',
    examples: [
      { es: '¿Puedo {pagar} con tarjeta?', en: 'Can I pay by card?', person: -1 },
      { es: 'Hoy {pago} yo.', en: 'Today I\'m paying (it\'s on me).', person: 0 },
    ],
  },
  {
    inf: 'buscar', en: 'to look for', group: 'regular',
    present: ['busco', 'buscas', 'busca', 'buscamos', 'buscáis', 'buscan'], gerund: 'buscando', participle: 'buscado',
    frequencyRank: 37, level: 'A1',
    trick: 'Imagine searching for the BUS CAR park — you LOOK FOR it everywhere.',
    note: 'No "for" needed: busco piso = I\'m looking for a flat.',
    examples: [
      { es: '{Busco} piso en el centro.', en: 'I\'m looking for a flat in the centre.', person: 0 },
      { es: '¿Qué {buscas}?', en: 'What are you looking for?', person: 1 },
    ],
  },
  {
    inf: 'llegar', en: 'to arrive', group: 'regular',
    present: ['llego', 'llegas', 'llega', 'llegamos', 'llegáis', 'llegan'], gerund: 'llegando', participle: 'llegado',
    frequencyRank: 38, level: 'A1',
    origin: 'From Latin plicare, "to fold", via applicare, "to bring (a ship) to shore" — English "apply".',
    trick: 'Picture sailors FOLDING sails as they ARRIVE.',
    examples: [
      { es: '¿A qué hora {llegas}?', en: 'What time do you arrive?', person: 1 },
      { es: 'El avión {llega} a Barajas a las diez.', en: 'The plane arrives at Barajas at ten.', person: 2 },
    ],
  },
  {
    inf: 'tomar', en: 'to take / to have (food, drink)', group: 'regular',
    present: ['tomo', 'tomas', 'toma', 'tomamos', 'tomáis', 'toman'], gerund: 'tomando', participle: 'tomado',
    frequencyRank: 39, level: 'A1',
    trick: 'TOMorrow I\'ll TAKE a coffee.',
    note: 'Tomar algo = to have a drink. In Spain, "coger" also means to take (a bus) — avoid "coger" in Mexico, where it is vulgar; use "tomar".',
    examples: [
      { es: '¿Qué vas a {tomar}?', en: 'What are you going to have?', person: -1 },
      { es: 'Yo {tomo} un café solo.', en: 'I\'ll have an espresso.', person: 0 },
    ],
  },
  {
    inf: 'traer', en: 'to bring', group: 'irregular-yo',
    present: ['traigo', 'traes', 'trae', 'traemos', 'traéis', 'traen'], gerund: 'trayendo', participle: 'traído',
    frequencyRank: 40, level: 'A2',
    origin: 'From Latin trahere, "to drag / pull" — English "tractor", "traction".',
    trick: 'A TRACTOR BRINGS things in.',
    examples: [
      { es: '¿Nos {trae} la carta, por favor?', en: 'Could you bring us the menu, please?', person: 2 },
      { es: 'Yo {traigo} el vino.', en: 'I\'ll bring the wine.', person: 0 },
    ],
  },
  {
    inf: 'oír', en: 'to hear', group: 'irregular',
    present: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'], gerund: 'oyendo', participle: 'oído',
    frequencyRank: 41, level: 'A2',
    origin: 'From Latin audire — English "audio", "audible".',
    trick: '¡OYE! (hey, listen!) — you will HEAR it all day in Spain.',
    note: '¡Oye! is a friendly way to get someone\'s attention.',
    examples: [
      { es: 'No te {oigo} bien.', en: 'I can\'t hear you well.', person: 0 },
      { es: '¿{Oyes} la música?', en: 'Can you hear the music?', person: 1 },
    ],
  },
];

/** The wider bank (A1–C2, generated from the rules) follows the hand-written verbs in frequency order; it has no example sentences. */
for (const [i, l] of LEXICON.entries()) {
  if (VERBS.some((v) => v.inf === l.inf)) continue;
  VERBS.push({ inf: l.inf, en: l.en, group: l.group, present: l.present as Verb['present'], gerund: l.gerund, participle: l.participle, frequencyRank: 100 + i, level: l.level, trick: l.trick, examples: [] });
}

export const VERB_BY_INF: Record<string, Verb> = Object.fromEntries(VERBS.map((v) => [v.inf, v]));

const ESTAR = VERB_BY_INF.estar.present;
const HABER = ['he', 'has', 'ha', 'hemos', 'habéis', 'han'];
const IO_PRONOUNS = ['me', 'te', 'le', 'nos', 'os', 'les'];

type Variety = 'spain' | 'mexico' | 'argentina' | 'colombia';
let activeVariety: Variety = 'spain';
/** Set by the app store whenever the learner's variety changes. */
export function setActiveVariety(v: Variety) {
  activeVariety = v;
}
export function getActiveVariety(): Variety {
  return activeVariety;
}

const VOSEO_EXCEPTIONS: Record<string, string> = { ser: 'sos', ir: 'vas', dar: 'das', ver: 'ves' };

/**
 * Rioplatense voseo (present indicative): stress on the ending and no stem change —
 * hablás, comés, vivís, tenés, querés, podés, dormís, pedís, decís, oís.
 */
export function voseo(verb: Verb): string {
  if (verb.pronominal) return verb.present[1]; // te gusta
  if (VOSEO_EXCEPTIONS[verb.inf]) return VOSEO_EXCEPTIONS[verb.inf];
  const inf = verb.inf.replace('í', 'i');
  const stem = inf.slice(0, -2);
  const end = inf.slice(-2);
  return stem + (end === 'ar' ? 'ás' : end === 'er' ? 'és' : 'ís');
}

/** Returns the conjugated form for any supported tense and person (0–5). Commands have no yo form (''). */
export function conjugate(verb: Verb, tense: Tense, person: number, variety: Variety = activeVariety): string {
  const vos = variety === 'argentina' && person === 1;
  if (tense === 'present') return vos ? voseo(verb) : verb.present[person];
  if (tense !== 'progressive' && tense !== 'perfect') return conjugateSimple(verb, tense, person, vos);
  if (verb.pronominal) {
    // gustar-type: me está gustando / me ha gustado (3rd-person singular agreement).
    const aux = tense === 'progressive' ? `está ${verb.gerund}` : `ha ${verb.participle}`;
    return `${IO_PRONOUNS[person]} ${aux}`;
  }
  if (tense === 'progressive') return `${ESTAR[person]} ${verb.gerund}`; // vos estás = tú estás
  return `${HABER[person]} ${verb.participle}`; // vos has = tú has
}

/** Subject label for a person in the active variety. */
export function personLabel(person: number, variety: Variety = activeVariety): string {
  if (person === 1 && variety === 'argentina') return 'vos';
  if (person === 5 && variety !== 'spain') return 'ellos / ellas / ustedes';
  return PERSONS[person];
}

/** Strips the {braces}, returning the plain sentence and the blanked form. */
export function parseExample(ex: VerbExample): { before: string; answer: string; after: string; plain: string } {
  const m = ex.es.match(/^(.*)\{(.+?)\}(.*)$/);
  if (!m) return { before: ex.es, answer: '', after: '', plain: ex.es };
  return { before: m[1], answer: m[2], after: m[3], plain: m[1] + m[2] + m[3] };
}

export function groupLabel(g: VerbGroup): string {
  switch (g) {
    case 'regular': return 'Regular';
    case 'stem-e-ie': return 'Stem change e → ie';
    case 'stem-o-ue': return 'Stem change o → ue';
    case 'stem-e-i': return 'Stem change e → i';
    case 'stem-u-ue': return 'Stem change u → ue';
    case 'irregular-yo': return 'Irregular "yo" form';
    case 'irregular': return 'Irregular';
  }
}

/** Persons available for the learner's region (Mexico doesn't use vosotros). */
export function personsForRegion(region: Variety = activeVariety): number[] {
  return region === 'spain' ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 5];
}

/** Persons that exist for a tense in the learner's region: commands have no yo form. */
export function personsForTense(tense: Tense, region: Variety = activeVariety): number[] {
  const all = personsForRegion(region);
  return tense === 'imperative' ? all.filter((p) => p !== 0) : all;
}

export function verbKey(inf: string, tense: Tense, person: number): string {
  return `verb:${inf}|${tense}|${person}`;
}
