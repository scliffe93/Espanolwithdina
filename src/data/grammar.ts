import type { Cefr } from '../types';
import type { FocusTag } from '../lib/platform/types';

// ───────────────────────────────────────────────────────────────
// Grammar drills by level, beyond ser vs estar: por vs para (A2),
// preterite vs imperfect (B1), subjunctive or indicative (B1/B2) and
// conditional sentences (B2/C1). Each item is a sentence with one gap,
// the right form, the wrong ones a learner would pick, the English, and
// why. Hand-written and unit-tested for shape.
// ───────────────────────────────────────────────────────────────

export type GrammarMode = 'ser-estar' | 'por-para' | 'pret-imp' | 'subjunctive' | 'conditional';

export interface GrammarItem {
  before: string;
  after: string;
  answer: string;
  options: string[];
  /** The verb and person to use, shown by the gap (e.g. "tener, tú"). */
  hint?: string;
  en: string;
  why: string;
  level: Cefr;
}

export const GRAMMAR_MODES: { id: GrammarMode; label: string; es: string; minLevel: Cefr; blurb: string; focus: FocusTag }[] = [
  { id: 'ser-estar', label: 'Ser vs estar', es: 'Ser o estar', minLevel: 'A1', blurb: 'What something is, versus where and how it is right now.', focus: 'ser-estar' },
  { id: 'por-para', label: 'Por vs para', es: 'Por o para', minLevel: 'A2', blurb: 'Cause, exchange and movement through (por); purpose, destination and deadlines (para).', focus: 'prepositions' },
  { id: 'pret-imp', label: 'Preterite vs imperfect', es: 'Indefinido o imperfecto', minLevel: 'B1', blurb: 'Completed events versus background, habits and descriptions in the past.', focus: 'tense-choice' },
  { id: 'subjunctive', label: 'Subjunctive or not', es: 'Subjuntivo o indicativo', minLevel: 'B1', blurb: 'Wishes, doubts, emotions and purpose take the subjunctive; facts and beliefs do not.', focus: 'tense-choice' },
  { id: 'conditional', label: 'If-sentences', es: 'Condicionales', minLevel: 'B2', blurb: 'Si + present → future; si + imperfect subjunctive → conditional; past regrets with the pluperfect.', focus: 'tense-choice' },
];
export const GRAMMAR_MODE_BY_ID: Record<GrammarMode, (typeof GRAMMAR_MODES)[number]> = Object.fromEntries(GRAMMAR_MODES.map((m) => [m.id, m])) as Record<GrammarMode, (typeof GRAMMAR_MODES)[number]>;

const PP = (before: string, after: string, answer: 'por' | 'para' | 'Por' | 'Para', en: string, why: string, level: Cefr = 'A2'): GrammarItem => ({ before, after, answer, options: answer[0] === answer[0].toUpperCase() ? ['Por', 'Para'] : ['por', 'para'], en, why, level });

export const POR_PARA: GrammarItem[] = [
  PP('Este regalo es', 'ti.', 'para', 'This present is for you.', 'The person who receives something → para.'),
  PP('Gracias', 'tu ayuda.', 'por', 'Thanks for your help.', 'Thanks, cause and reason → por.'),
  PP('Estudio español', 'trabajar en Madrid.', 'para', 'I study Spanish in order to work in Madrid.', 'Purpose, "in order to" → para + infinitive.'),
  PP('Pasamos', 'el parque todas las mañanas.', 'por', 'We go through the park every morning.', 'Movement through or along a place → por.'),
  PP('Necesito el informe', 'el lunes.', 'para', 'I need the report for Monday.', 'A deadline → para.'),
  PP('Vendí el coche', 'dos mil euros.', 'por', 'I sold the car for two thousand euros.', 'Price and exchange → por.'),
  PP('Hablamos', 'teléfono cada semana.', 'por', 'We talk on the phone every week.', 'The means of communication → por.'),
  PP('Es muy alto', 'su edad.', 'para', 'He is very tall for his age.', 'A comparison with what is expected → para.'),
  PP('', 'mí, la mejor ciudad es Sevilla.', 'Para', 'For me, the best city is Seville.', 'An opinion, "in my view" → para mí.'),
  PP('Llegó tarde', 'el tráfico.', 'por', 'He arrived late because of the traffic.', 'The cause → por.'),
  PP('Salimos', 'Barcelona mañana.', 'para', 'We leave for Barcelona tomorrow.', 'Destination → para.'),
  PP('Trabajo', 'una empresa pequeña.', 'para', 'I work for a small company.', 'The employer → para.'),
  PP('Fui al supermercado', 'pan.', 'por', 'I went to the supermarket for bread.', 'Going to get something → por.'),
  PP('Mi padre hizo la cena', 'mí porque estaba enferma.', 'por', 'My father made dinner for me (instead of me) because I was ill.', 'Doing something instead of someone → por.'),
  PP('Este libro fue escrito', 'Cervantes.', 'por', 'This book was written by Cervantes.', 'The agent of a passive → por.'),
  PP('Tengo que terminar el trabajo', 'mañana.', 'para', 'I have to finish the work by tomorrow.', 'Deadline → para.'),
  PP('Cambió su bici', 'un patinete.', 'por', 'She swapped her bike for a scooter.', 'An exchange → por.'),
  PP('Me preparo', 'el examen de mañana.', 'para', 'I am preparing for tomorrow’s exam.', 'Purpose → para.'),
  PP('¿Hay un cajero', 'aquí?', 'por', 'Is there a cash machine around here?', 'An approximate location, "around" → por.'),
  PP('El vaso es', 'agua.', 'para', 'The glass is for water.', 'Intended use → para.'),
  PP('Te lo digo', 'última vez.', 'por', 'I am telling you for the last time.', 'Por última vez is a fixed phrase.'),
  PP('Caminamos', 'la playa al atardecer.', 'por', 'We walked along the beach at sunset.', 'Along a place → por.'),
  PP('Es una aplicación', 'aprender español.', 'para', 'It is an app for learning Spanish.', 'Purpose → para.'),
  PP('', 'fin llegó el verano.', 'Por', 'At last summer arrived.', 'Por fin is a fixed phrase.'),
  PP('Estuvimos en Lisboa', 'tres días.', 'por', 'We were in Lisbon for three days.', 'Duration → por (or durante).', 'B1'),
  PP('Lo compré', 'mi madre: es su cumpleaños.', 'para', 'I bought it for my mother: it is her birthday.', 'The recipient → para.'),
];

const PI = (before: string, after: string, hint: string, answer: string, wrong: string, en: string, why: string, level: Cefr = 'B1'): GrammarItem => ({ before, after, hint, answer, options: [answer, wrong], en, why, level });

export const PRET_IMP: GrammarItem[] = [
  PI('Cuando era niño,', 'en Sevilla.', 'vivir, yo', 'vivía', 'viví', 'When I was a child, I lived in Seville.', 'A background situation in the past → imperfect.'),
  PI('Ayer', 'un coche nuevo.', 'comprar, yo', 'compré', 'compraba', 'Yesterday I bought a new car.', 'A completed action at a stated time → preterite.'),
  PI('', 'las ocho cuando llegó Marta.', 'ser', 'Eran', 'Fueron', 'It was eight o’clock when Marta arrived.', 'Telling the time in the past → imperfect.'),
  PI('De repente,', 'el teléfono.', 'sonar', 'sonó', 'sonaba', 'Suddenly the phone rang.', 'A sudden event that interrupts → preterite.'),
  PI('Mientras', ', escuchaba la radio.', 'cocinar, yo', 'cocinaba', 'cociné', 'While I was cooking, I listened to the radio.', 'Two actions in progress at the same time → imperfect.'),
  PI('El año pasado', 'a México dos veces.', 'ir, yo', 'fui', 'iba', 'Last year I went to Mexico twice.', 'Counted, completed trips → preterite.'),
  PI('Antes', 'el pelo largo.', 'tener, yo', 'tenía', 'tuve', 'I used to have long hair.', 'A description of how things were → imperfect.'),
  PI('Anoche', 'una película muy buena.', 'ver, yo', 'vi', 'veía', 'Last night I watched a very good film.', 'One completed event → preterite.'),
  PI('Todos los veranos', 'a la playa con mis abuelos.', 'ir, nosotros', 'íbamos', 'fuimos', 'Every summer we went to the beach with my grandparents.', 'A habit, "every summer" → imperfect.'),
  PI('Estaba leyendo cuando alguien', 'a la puerta.', 'llamar', 'llamó', 'llamaba', 'I was reading when someone knocked at the door.', 'The interrupting event → preterite; the background stays imperfect.'),
  PI('La casa', 'un jardín enorme.', 'tener', 'tenía', 'tuvo', 'The house had a huge garden.', 'A description → imperfect.'),
  PI('Juan', 'en París durante cinco años.', 'vivir', 'vivió', 'vivía', 'Juan lived in Paris for five years.', 'A finished period with its length stated → preterite.'),
  PI('Cuando', 'al cine, la película ya había empezado.', 'llegar, yo', 'llegué', 'llegaba', 'When I got to the cinema, the film had already started.', 'A completed arrival → preterite.'),
  PI('Mi abuela siempre', 'tortilla los domingos.', 'hacer', 'hacía', 'hizo', 'My grandmother always made tortilla on Sundays.', 'A habit, "always" → imperfect.'),
  PI('En 2010', 'mi hermana.', 'nacer', 'nació', 'nacía', 'My sister was born in 2010.', 'A dated event → preterite.'),
  PI('', 'mucho frío, así que nos quedamos en casa.', 'hacer', 'Hacía', 'Hizo', 'It was very cold, so we stayed at home.', 'Weather as background → imperfect.'),
  PI('Ella', 'cansada, por eso no vino.', 'estar', 'estaba', 'estuvo', 'She was tired, that is why she did not come.', 'A state that explains something → imperfect.'),
  PI('Ayer no', 'dormir.', 'poder, yo', 'pude', 'podía', 'Yesterday I could not sleep.', '"No pude" = I tried and failed, a completed outcome → preterite.'),
  PI('No', 'que tenías un perro.', 'saber, yo', 'sabía', 'supe', 'I did not know you had a dog.', 'Knowing as an ongoing state → imperfect ("supe" would mean "I found out").'),
  PI('', 'a mi novia en una fiesta en 2019.', 'conocer, yo', 'Conocí', 'Conocía', 'I met my girlfriend at a party in 2019.', '"Conocí" = met for the first time, a single event → preterite.'),
  PI('De pequeña', 'ser médica.', 'querer, yo', 'quería', 'quise', 'As a little girl I wanted to be a doctor.', 'A wish over a period → imperfect.'),
  PI('La semana pasada', 'el curso.', 'terminar, yo', 'terminé', 'terminaba', 'Last week I finished the course.', 'A completed action → preterite.'),
  PI('Mientras él', ', yo trabajaba.', 'dormir', 'dormía', 'durmió', 'While he slept, I worked.', 'Two parallel ongoing actions → imperfect.'),
  PI('Cuando salimos,', '.', 'llover', 'llovía', 'llovió', 'When we went out, it was raining.', 'The background condition at that moment → imperfect.'),
];

const SJ = (before: string, after: string, hint: string, answer: string, wrong: string, en: string, why: string, level: Cefr = 'B1'): GrammarItem => ({ before, after, hint, answer, options: [answer, wrong], en, why, level });

export const SUBJUNCTIVE: GrammarItem[] = [
  SJ('Quiero que', 'a mi fiesta.', 'venir, tú', 'vengas', 'vienes', 'I want you to come to my party.', 'A wish about someone else’s action → subjunctive.'),
  SJ('Creo que Madrid', 'una ciudad preciosa.', 'ser', 'es', 'sea', 'I think Madrid is a beautiful city.', 'Creer que, affirmative belief → indicative.'),
  SJ('No creo que', 'buena idea.', 'ser', 'sea', 'es', 'I don’t think it is a good idea.', 'No creer que, doubt → subjunctive.'),
  SJ('Es importante que', 'cada día.', 'estudiar, vosotros', 'estudiéis', 'estudiáis', 'It is important that you study every day.', 'Es importante que (a value judgement) → subjunctive.'),
  SJ('Espero que', 'un buen viaje.', 'tener, tú', 'tengas', 'tienes', 'I hope you have a good trip.', 'Esperar que, a hope → subjunctive.'),
  SJ('Sé que', 'en Valencia.', 'vivir, ella', 'vive', 'viva', 'I know she lives in Valencia.', 'Saber que, certainty → indicative.'),
  SJ('Ojalá', 'sol mañana.', 'hacer', 'haga', 'hace', 'I hope it is sunny tomorrow.', 'Ojalá always takes the subjunctive.'),
  SJ('Cuando', 'a casa, te llamo.', 'llegar, yo', 'llegue', 'llego', 'When I get home, I will call you.', 'Cuando + an action that has not happened yet → subjunctive.'),
  SJ('Siempre que', 'a Madrid, me visita.', 'venir, ella', 'viene', 'venga', 'Whenever she comes to Madrid, she visits me.', 'A habitual event → indicative.'),
  SJ('Busco un piso que', 'terraza.', 'tener', 'tenga', 'tiene', 'I am looking for a flat that has a terrace.', 'An unknown, hoped-for thing → subjunctive.'),
  SJ('Tengo un piso que', 'terraza.', 'tener', 'tiene', 'tenga', 'I have a flat that has a terrace.', 'A real, known thing → indicative.'),
  SJ('Es verdad que', 'caro.', 'ser', 'es', 'sea', 'It is true that it is expensive.', 'Es verdad que, a fact → indicative.'),
  SJ('No es verdad que', 'caro.', 'ser', 'sea', 'es', 'It is not true that it is expensive.', 'Denial → subjunctive.'),
  SJ('Te recomiendo que', 'la paella.', 'probar, tú', 'pruebes', 'pruebas', 'I recommend that you try the paella.', 'Advice and influence → subjunctive.'),
  SJ('Me alegro de que', 'aquí.', 'estar, tú', 'estés', 'estás', 'I am glad you are here.', 'An emotion about something → subjunctive.'),
  SJ('Para que', 'mejor, repito la frase.', 'entender, ellos', 'entiendan', 'entienden', 'So that they understand better, I repeat the sentence.', 'Para que, purpose → subjunctive.'),
  SJ('Dudo que', 'venir.', 'poder, él', 'pueda', 'puede', 'I doubt he can come.', 'Doubt → subjunctive.'),
  SJ('Pienso que', 'razón.', 'tener, tú', 'tienes', 'tengas', 'I think you are right.', 'Pensar que, affirmative → indicative.'),
  SJ('Es posible que', 'esta noche.', 'nevar', 'nieve', 'nieva', 'It is possible that it will snow tonight.', 'Possibility → subjunctive.'),
  SJ('Antes de que', 'la clase, apaga el móvil.', 'empezar', 'empiece', 'empieza', 'Before the class starts, switch off your phone.', 'Antes de que always takes the subjunctive.'),
  SJ('Está claro que', 'la respuesta.', 'saber, ellos', 'saben', 'sepan', 'It is clear that they know the answer.', 'Certainty → indicative.'),
  SJ('Necesito que me', 'con esto.', 'ayudar, tú', 'ayudes', 'ayudas', 'I need you to help me with this.', 'A need imposed on someone else → subjunctive.'),
  SJ('Me parece que', 'a llegar tarde.', 'ir, nosotros', 'vamos', 'vayamos', 'I think we are going to be late.', 'Me parece que, an opinion stated as fact → indicative.'),
  SJ('Prefiero que', 'en el café.', 'quedar, nosotros', 'quedemos', 'quedamos', 'I prefer that we meet at the café.', 'Preference about an action → subjunctive.'),
  SJ('Aunque', 'caro, lo compraré.', 'ser', 'sea', 'es', 'Even if it is expensive, I will buy it.', 'Aunque with a hypothetical ("even if") → subjunctive.', 'B2'),
  SJ('No hay nadie que', 'cocinar como mi abuela.', 'saber', 'sepa', 'sabe', 'There is nobody who can cook like my grandmother.', 'A negated antecedent → subjunctive.', 'B2'),
];

const CD = (before: string, after: string, hint: string, answer: string, wrong: string[], en: string, why: string, level: Cefr = 'B2'): GrammarItem => ({ before, after, hint, answer, options: [answer, ...wrong], en, why, level });

export const CONDITIONAL: GrammarItem[] = [
  CD('Si', 'tiempo, iré al gimnasio.', 'tener, yo', 'tengo', ['tuviera', 'tendría'], 'If I have time, I will go to the gym.', 'A real condition: si + present, future in the main clause.'),
  CD('Si', 'tiempo, iría al gimnasio.', 'tener, yo', 'tuviera', ['tengo', 'tendría'], 'If I had time, I would go to the gym.', 'An unreal condition now: si + imperfect subjunctive, conditional in the main clause.'),
  CD('Si hubiera estudiado,', 'el examen.', 'aprobar, yo', 'habría aprobado', ['aprobaría', 'aprobé'], 'If I had studied, I would have passed the exam.', 'A regret about the past: conditional perfect in the main clause.', 'C1'),
  CD('Si llueve mañana,', 'al cine.', 'ir, nosotros', 'iremos', ['iríamos', 'vayamos'], 'If it rains tomorrow, we will go to the cinema.', 'Real condition → future.'),
  CD('Si fuera rico,', 'una casa en la playa.', 'comprar, yo', 'compraría', ['compraré', 'comprara'], 'If I were rich, I would buy a house on the beach.', 'Unreal condition → conditional.'),
  CD('Si', ', te ayudaría.', 'poder, yo', 'pudiera', ['puedo', 'podría'], 'If I could, I would help you.', 'Si + imperfect subjunctive, never si + conditional.'),
  CD('', 'un café, por favor.', 'gustar, a mí', 'Me gustaría', ['Me gusta', 'Me gustara'], 'I would like a coffee, please.', 'A polite request → conditional.'),
  CD('Yo que tú,', 'con ella.', 'hablar', 'hablaría', ['hablaré', 'hable'], 'If I were you, I would talk to her.', 'Advice, "if I were you" → conditional.'),
  CD('Si vienes a Madrid, te', 'la ciudad.', 'enseñar, yo', 'enseñaré', ['enseñaría', 'enseñara'], 'If you come to Madrid, I will show you the city.', 'Real condition → future.'),
  CD('Si no', 'por ti, no habría terminado.', 'ser', 'fuera', ['es', 'sería'], 'If it were not for you, I would not have finished.', 'Si no fuera por… is a fixed unreal condition.'),
  CD('¿Qué', 'si ganaras la lotería?', 'hacer, tú', 'harías', ['harás', 'hicieras'], 'What would you do if you won the lottery?', 'Unreal condition → conditional in the main clause.'),
  CD('Si hubieras venido,', 'a mi familia.', 'conocer, tú', 'habrías conocido', ['conocerías', 'conociste'], 'If you had come, you would have met my family.', 'Past regret → conditional perfect.', 'C1'),
  CD('Dijo que', 'a las ocho.', 'llegar', 'llegaría', ['llegará', 'llegue'], 'He said he would arrive at eight.', 'The future seen from the past → conditional.'),
  CD('Si', 'la respuesta, te la diría.', 'saber, yo', 'supiera', ['sé', 'sabría'], 'If I knew the answer, I would tell you.', 'Unreal condition → imperfect subjunctive.'),
  CD('Si', 'más, aprobarás.', 'estudiar, tú', 'estudias', ['estudiaras', 'estudiarías'], 'If you study more, you will pass.', 'Real condition → present.'),
  CD('¿', 'ayudarme, por favor?', 'poder, usted', 'Podría', ['Puede', 'Pudiera'], 'Could you help me, please?', 'Politeness → conditional.'),
  CD('Si tuviéramos más dinero,', 'por todo el mundo.', 'viajar, nosotros', 'viajaríamos', ['viajaremos', 'viajáramos'], 'If we had more money, we would travel all over the world.', 'Unreal condition → conditional.'),
  CD('Si', 'ayer, no habríamos salido.', 'llover', 'hubiera llovido', ['lloviera', 'llovió'], 'If it had rained yesterday, we would not have gone out.', 'An unreal past condition → pluperfect subjunctive.', 'C1'),
  CD('Me', 'ir a Argentina algún día.', 'encantar', 'encantaría', ['encantará', 'encante'], 'I would love to go to Argentina one day.', 'A wish softened with the conditional.'),
  CD('Si no', 'tan cansado, saldría.', 'estar, yo', 'estuviera', ['estoy', 'estaría'], 'If I were not so tired, I would go out.', 'Unreal condition → imperfect subjunctive.'),
];

export const GRAMMAR_DRILLS: Record<Exclude<GrammarMode, 'ser-estar'>, GrammarItem[]> = { 'por-para': POR_PARA, 'pret-imp': PRET_IMP, subjunctive: SUBJUNCTIVE, conditional: CONDITIONAL };
