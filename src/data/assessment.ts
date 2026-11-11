import type { Cefr, Skill } from '../types';

export interface AssessmentQuestion {
  id: string;
  skill: Exclude<Skill, 'speaking'>;
  level: Cefr;
  prompt: string;
  /** Spanish text shown (reading) or spoken (listening). */
  text?: string;
  listen?: boolean;
  options: string[];
  answer: number;
  explain: string;
}

export const ASSESSMENT: AssessmentQuestion[] = [
  // Vocabulary
  { id: 'v1', skill: 'vocabulary', level: 'A1', prompt: 'What does "la manzana" mean?', options: ['the apple', 'the bread', 'the water', 'the door'], answer: 0, explain: 'La manzana = the apple.' },
  { id: 'v2', skill: 'vocabulary', level: 'A1', prompt: 'How do you say "thank you very much"?', options: ['De nada', 'Muchas gracias', 'Por favor', 'Lo siento'], answer: 1, explain: 'Muchas gracias = thank you very much.' },
  { id: 'v3', skill: 'vocabulary', level: 'A2', prompt: 'In Spain, what is "el alquiler"?', options: ['the lift', 'the rent', 'the landlord', 'the street'], answer: 1, explain: 'El alquiler = the rent.' },
  { id: 'v4', skill: 'vocabulary', level: 'B1', prompt: 'What does "aprovechar" mean?', options: ['to approve', 'to take advantage of / make the most of', 'to approach', 'to borrow'], answer: 1, explain: 'Aprovechar = to make the most of. ¡Aprovecha el día!' },
  { id: 'v5', skill: 'vocabulary', level: 'B1', prompt: '"Echo de menos a mi familia" means…', options: ['I throw my family less', 'I miss my family', 'I need less family', 'I call my family less'], answer: 1, explain: 'Echar de menos = to miss (someone). In Mexico: extrañar.' },
  { id: 'v6', skill: 'vocabulary', level: 'C1', prompt: '"Estoy hasta las narices" means…', options: ['I\'ve got a cold', 'I\'m fed up', 'I\'m very nosy', 'I\'m very close'], answer: 1, explain: 'Estar hasta las narices = to be fed up (colloquial, Spain).' },
  // Grammar
  { id: 'g1', skill: 'grammar', level: 'A1', prompt: 'Ella ___ médica.', options: ['es', 'está', 'soy', 'eres'], answer: 0, explain: 'Professions take ser: ella es médica.' },
  { id: 'g2', skill: 'grammar', level: 'A2', prompt: 'Ayer nosotros ___ al cine.', options: ['vamos', 'fuimos', 'iremos', 'vayamos'], answer: 1, explain: 'Ayer → preterite: fuimos.' },
  { id: 'g3', skill: 'grammar', level: 'A2', prompt: 'Cuando era pequeño, ___ en el campo.', options: ['he vivido', 'vivía', 'viviré', 'vivo'], answer: 1, explain: 'Background / habitual past → imperfect: vivía.' },
  { id: 'g4', skill: 'grammar', level: 'B1', prompt: 'Espero que mañana ___ buen tiempo.', options: ['hace', 'hará', 'haga', 'hacía'], answer: 2, explain: 'Esperar que + present subjunctive: haga.' },
  { id: 'g5', skill: 'grammar', level: 'B2', prompt: 'Si lo ___ sabido, te lo habría dicho.', options: ['habría', 'hubiera', 'había', 'haya'], answer: 1, explain: 'Third conditional: si + pluperfect subjunctive (hubiera sabido).' },
  // Verbs
  { id: 'vb1', skill: 'verbs', level: 'A1', prompt: 'Yo ___ (tener) dos hermanos.', options: ['teno', 'tengo', 'tiene', 'tienes'], answer: 1, explain: 'Tener has an irregular yo form: tengo.' },
  { id: 'vb2', skill: 'verbs', level: 'A1', prompt: 'Nosotros ___ (vivir) en Madrid.', options: ['vivemos', 'vivimos', 'viven', 'vivís'], answer: 1, explain: '-ir verbs: nosotros vivimos.' },
  { id: 'vb3', skill: 'verbs', level: 'A1', prompt: '¿Tú ___ (poder) venir mañana?', options: ['podes', 'puedes', 'puede', 'pudes'], answer: 1, explain: 'Poder is o→ue: puedes.' },
  { id: 'vb4', skill: 'verbs', level: 'A2', prompt: 'Yo nunca ___ (estar) en México.', options: ['he estado', 'estaba', 'estoy', 'he estada'], answer: 0, explain: 'Life experience → present perfect: he estado.' },
  { id: 'vb5', skill: 'verbs', level: 'B2', prompt: 'Ojalá ___ (venir) Marta a la fiesta.', options: ['viene', 'vendrá', 'venga', 'vino'], answer: 2, explain: 'Ojalá + subjunctive: venga.' },
  // Reading
  { id: 'r1', skill: 'reading', level: 'A1', prompt: 'Where does Ana work?', text: 'Me llamo Ana. Vivo en Sevilla y trabajo en un hotel.', options: ['In a school', 'In a hotel', 'In Seville\'s airport', 'At home'], answer: 1, explain: '"Trabajo en un hotel" = I work in a hotel.' },
  { id: 'r2', skill: 'reading', level: 'B1', prompt: 'Why did Pablo rent the flat?', text: 'Aunque el piso es caro, Pablo decidió alquilarlo porque está cerca de su oficina y odia el tráfico.', options: ['Because it was cheap', 'Because it is close to his office', 'Because he likes traffic', 'Because his office paid for it'], answer: 1, explain: '"Está cerca de su oficina" = it\'s close to his office. "Aunque es caro" = although it\'s expensive.' },
  { id: 'r3', skill: 'reading', level: 'B2', prompt: 'What happened to the traffic?', text: 'Lejos de mejorar, la situación del tráfico en el centro se ha agravado desde que cerraron la calle.', options: ['It improved a lot', 'It got worse', 'It stayed the same', 'The centre was closed to traffic'], answer: 1, explain: '"Lejos de mejorar… se ha agravado" = far from improving… it has got worse.' },
  // Listening
  { id: 'l1', skill: 'listening', level: 'A1', listen: true, prompt: 'What does the customer want?', text: 'Buenos días. Un café con leche, por favor.', options: ['A tea', 'A white coffee', 'An orange juice', 'The bill'], answer: 1, explain: '"Un café con leche" = a white coffee.' },
  { id: 'l2', skill: 'listening', level: 'A2', listen: true, prompt: 'When does the train leave?', text: 'El tren a Toledo sale a las nueve y media del andén cuatro.', options: ['At 9:30', 'At 4:00', 'At 9:15', 'At 10:30'], answer: 0, explain: '"A las nueve y media" = at half past nine, from platform 4.' },
  { id: 'l3', skill: 'listening', level: 'B1', listen: true, prompt: 'What will the speaker do?', text: 'Te llamo cuando salga del trabajo, que hoy tengo una reunión hasta tarde.', options: ['Call now', 'Call after work — they have a meeting until late', 'Skip work today', 'Meet at the office'], answer: 1, explain: '"Te llamo cuando salga del trabajo" = I\'ll call you when I leave work.' },
  { id: 'l4', skill: 'listening', level: 'B2', listen: true, prompt: 'What is the speaker saying?', text: 'Si hubiera sabido que venías, habría preparado algo de cenar.', options: ['Dinner is ready', 'They would have made dinner if they had known you were coming', 'They want you to make dinner', 'They knew you were coming'], answer: 1, explain: 'A third conditional: if I had known… I would have made dinner.' },
  // C1 and C2
  { id: 'v7', skill: 'vocabulary', level: 'C2', prompt: '"Se me fue el santo al cielo" means…', options: ['I went to church', 'I completely forgot what I was about to do or say', 'I was overjoyed', 'I fell asleep'], answer: 1, explain: 'Írsele a alguien el santo al cielo = to lose one\'s train of thought, to forget what one was doing.' },
  { id: 'g6', skill: 'grammar', level: 'C1', prompt: 'Me pidió que le ___ el informe antes del viernes.', options: ['envíe', 'enviara', 'enviaré', 'envié'], answer: 1, explain: 'A past request: pedir in the preterite calls for the imperfect subjunctive (enviara).' },
  { id: 'g7', skill: 'grammar', level: 'C2', prompt: 'El libro ___ autor ganó el Nobel se agotó en dos días.', options: ['que', 'cuyo', 'el cual', 'quien'], answer: 1, explain: 'Cuyo = whose, agreeing with the noun that follows (autor).' },
  { id: 'vb6', skill: 'verbs', level: 'C1', prompt: 'Ojalá ___ (venir, ellos) ayer a la fiesta.', options: ['vengan', 'vinieran', 'hubieran venido', 'habrían venido'], answer: 2, explain: 'A wish about something that did not happen → pluperfect subjunctive: hubieran venido.' },
  { id: 'vb7', skill: 'verbs', level: 'C2', prompt: 'Para cuando llegues, ya ___ (terminar, nosotros).', options: ['terminaremos', 'habremos terminado', 'hayamos terminado', 'terminamos'], answer: 1, explain: 'Something that will already be done by a future moment → future perfect: habremos terminado.' },
  { id: 'r4', skill: 'reading', level: 'C1', prompt: 'What is the speaker\'s position?', text: 'Por mucho que insistas, no pienso cambiar de opinión: la propuesta, tal y como está planteada, me parece inviable.', options: ['They are open to persuasion', 'They refuse to change their mind: the proposal as it stands is unworkable', 'They think the proposal is excellent', 'They want more time to decide'], answer: 1, explain: '"Por mucho que insistas" = however much you insist; "inviable" = unworkable.' },
  { id: 'r5', skill: 'reading', level: 'C2', prompt: 'How did the director react?', text: 'Lejos de amilanarse ante las críticas, la directora redobló la apuesta y, con una sorna que desarmó a los presentes, zanjó la cuestión.', options: ['She was intimidated and withdrew', 'She doubled down and closed the matter with disarming sarcasm', 'She apologised to everyone present', 'She postponed the decision'], answer: 1, explain: '"Amilanarse" = to be intimidated; "redoblar la apuesta" = to double down; "sorna" = sarcasm; "zanjar" = to settle.' },
  { id: 'l5', skill: 'listening', level: 'C1', listen: true, prompt: 'What does the speaker mean?', text: 'No me vengas con excusas; si de verdad te importara, habrías llamado.', options: ['They accept the apology', 'They reject the excuses: if the other person really cared, they would have called', 'They are asking for a phone number', 'They promise to call later'], answer: 1, explain: '"No me vengas con excusas" = don\'t give me excuses; an unreal condition with habrías llamado.' },
  { id: 'l6', skill: 'listening', level: 'C2', listen: true, prompt: 'What is the speaker saying?', text: 'Ni que decir tiene que, de haberlo sabido, habríamos actuado de otra manera.', options: ['They did know and acted accordingly', 'Obviously, had they known, they would have acted differently', 'They refuse to say what they knew', 'They acted the same way as always'], answer: 1, explain: '"Ni que decir tiene" = it goes without saying; "de haberlo sabido" = had we known.' },
];
