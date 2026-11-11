import type { Cefr } from '../types';
import type { VocabItem, VocabTheme } from './vocab';

// ───────────────────────────────────────────────────────────────
// Word packs by level, A1 to C2. A pack is ten words or phrases on one
// theme that a student adds to their memory deck (or that the teacher
// assigns as homework); they then come back through spaced repetition.
// The words register in the vocabulary bank, so chapters, the document
// builder and the games can use them too.
// ───────────────────────────────────────────────────────────────

export interface VocabPack { id: string; title: string; es: string; level: Cefr; theme: VocabTheme; ids: string[] }

type W = [id: string, es: string, en: string, gender?: 'm' | 'f', note?: string];
const pack = (id: string, title: string, es: string, level: Cefr, theme: VocabTheme, words: W[]): { pack: VocabPack; items: VocabItem[] } => ({
  pack: { id, title, es, level, theme, ids: words.map((w) => `p-${w[0]}`) },
  items: words.map(([wid, es, en, gender, note]) => ({ id: `p-${wid}`, es, en, theme, level, ...(gender ? { gender } : {}), ...(note ? { trick: note } : {}) })),
});

const PACKS = [
  pack('a1-casa', 'At home', 'En casa', 'A1', 'home', [
    ['nevera', 'la nevera', 'the fridge', 'f', 'Nieve (snow) lives in the NEVEra.'], ['lavadora', 'la lavadora', 'the washing machine', 'f'], ['horno', 'el horno', 'the oven', 'm'], ['sofa', 'el sofá', 'the sofa', 'm'], ['almohada', 'la almohada', 'the pillow', 'f'],
    ['toalla', 'la toalla', 'the towel', 'f'], ['ducha', 'la ducha', 'the shower', 'f'], ['escalera', 'la escalera', 'the stairs / the ladder', 'f'], ['enchufe', 'el enchufe', 'the plug / the socket', 'm'], ['cortina', 'la cortina', 'the curtain', 'f'],
  ]),
  pack('a1-comida', 'Food basics', 'Comida básica', 'A1', 'food', [
    ['pan', 'el pan', 'the bread', 'm'], ['leche', 'la leche', 'the milk', 'f'], ['huevo', 'el huevo', 'the egg', 'm'], ['queso', 'el queso', 'the cheese', 'm'], ['pollo', 'el pollo', 'the chicken', 'm'],
    ['pescado', 'el pescado', 'the fish (to eat)', 'm', 'Pez swims; pescado is on the plate.'], ['manzana', 'la manzana', 'the apple', 'f'], ['arroz', 'el arroz', 'the rice', 'm'], ['aceite', 'el aceite', 'the oil', 'm'], ['sal', 'la sal', 'the salt', 'f'],
  ]),
  pack('a2-trabajo', 'At work', 'En el trabajo', 'A2', 'everyday', [
    ['entrevista', 'la entrevista', 'the interview', 'f'], ['sueldo', 'el sueldo', 'the salary', 'm'], ['jefe', 'el jefe / la jefa', 'the boss'], ['reunion', 'la reunión', 'the meeting', 'f'], ['horario', 'el horario', 'the timetable / working hours', 'm'],
    ['contrato', 'el contrato', 'the contract', 'm'], ['despacho', 'el despacho', 'the office (a room)', 'm'], ['empresa', 'la empresa', 'the company', 'f'], ['companero', 'el compañero / la compañera', 'the colleague'], ['vacante', 'la vacante', 'the vacancy', 'f'],
  ]),
  pack('a2-salud', 'Health', 'Salud', 'A2', 'everyday', [
    ['medico', 'el médico / la médica', 'the doctor'], ['receta', 'la receta', 'the prescription / the recipe', 'f'], ['dolor', 'el dolor', 'the pain', 'm'], ['fiebre', 'la fiebre', 'the fever', 'f'], ['cita', 'la cita', 'the appointment', 'f'],
    ['resfriado', 'el resfriado', 'the cold (illness)', 'm'], ['pastilla', 'la pastilla', 'the pill', 'f'], ['seguro', 'el seguro', 'the insurance', 'm'], ['urgencias', 'urgencias', 'A&E / the emergency department', 'f'], ['analisis', 'el análisis', 'the (blood) test', 'm'],
  ]),
  pack('b1-tramites', 'Paperwork and renting', 'Trámites y alquiler', 'B1', 'everyday', [
    ['empadronamiento', 'el empadronamiento', 'registering as a resident with the town hall', 'm'], ['cita-previa', 'la cita previa', 'the pre-booked appointment', 'f'], ['nie', 'el NIE', 'the foreigner identity number', 'm'], ['nomina', 'la nómina', 'the payslip', 'f'], ['fianza', 'la fianza', 'the deposit', 'f'],
    ['casero', 'el casero / la casera', 'the landlord / landlady'], ['comunidad', 'la comunidad de vecinos', 'the residents’ association / service charge', 'f'], ['recibo', 'el recibo', 'the receipt / the bill', 'm'], ['tramite', 'el trámite', 'the procedure / the paperwork', 'm'], ['plazo', 'el plazo', 'the deadline / the instalment', 'm'],
  ]),
  pack('b1-opinion', 'Giving opinions', 'Dar opiniones', 'B1', 'social', [
    ['de-acuerdo', 'estar de acuerdo', 'to agree'], ['sin-embargo', 'sin embargo', 'however'], ['ademas', 'además', 'besides / furthermore'], ['en-cambio', 'en cambio', 'on the other hand'], ['por-lo-tanto', 'por lo tanto', 'therefore'],
    ['aunque', 'aunque', 'although / even if'], ['mientras-que', 'mientras que', 'whereas'], ['es-decir', 'es decir', 'that is to say'], ['a-pesar-de', 'a pesar de', 'in spite of'], ['en-mi-opinion', 'en mi opinión', 'in my opinion'],
  ]),
  pack('b2-economia', 'Work and money', 'Trabajo y economía', 'B2', 'everyday', [
    ['plantilla', 'la plantilla', 'the staff / the workforce', 'f'], ['despido', 'el despido', 'the dismissal / redundancy', 'm'], ['indemnizacion', 'la indemnización', 'the compensation / severance pay', 'f'], ['jornada', 'la jornada laboral', 'the working day', 'f'], ['autonomo', 'el autónomo / la autónoma', 'the self-employed person'],
    ['cotizacion', 'la cotización', 'the social security contribution', 'f'], ['impuesto', 'el impuesto', 'the tax', 'm'], ['hipoteca', 'la hipoteca', 'the mortgage', 'f'], ['ahorro', 'el ahorro', 'the saving(s)', 'm'], ['inversion', 'la inversión', 'the investment', 'f'],
  ]),
  pack('b2-sentimientos', 'Feelings and character', 'Sentimientos y carácter', 'B2', 'social', [
    ['ternura', 'la ternura', 'tenderness', 'f'], ['rencor', 'el rencor', 'resentment / a grudge', 'm'], ['verguenza', 'la vergüenza', 'shame / embarrassment', 'f'], ['orgullo', 'el orgullo', 'pride', 'm'], ['pereza', 'la pereza', 'laziness', 'f'],
    ['timidez', 'la timidez', 'shyness', 'f'], ['envidia', 'la envidia', 'envy', 'f'], ['alivio', 'el alivio', 'relief', 'm'], ['anoranza', 'la añoranza', 'longing / homesickness', 'f'], ['esperanza', 'la esperanza', 'hope', 'f'],
  ]),
  pack('b2-conectores', 'Advanced connectors', 'Conectores avanzados', 'B2', 'social', [
    ['no-obstante', 'no obstante', 'nevertheless'], ['en-cuanto-a', 'en cuanto a', 'as for / regarding'], ['dado-que', 'dado que', 'given that'], ['puesto-que', 'puesto que', 'since / because'], ['con-el-fin-de', 'con el fin de', 'with the aim of'],
    ['a-menos-que', 'a menos que', 'unless (+ subjunctive)'], ['siempre-y-cuando', 'siempre y cuando', 'provided that (+ subjunctive)'], ['en-caso-de-que', 'en caso de que', 'in case (+ subjunctive)'], ['por-consiguiente', 'por consiguiente', 'consequently'], ['a-su-vez', 'a su vez', 'in turn'],
  ]),
  pack('c1-academico', 'Formal and academic', 'Lenguaje formal y académico', 'C1', 'reading', [
    ['planteamiento', 'el planteamiento', 'the approach / the way a problem is posed', 'm'], ['hipotesis', 'la hipótesis', 'the hypothesis', 'f'], ['enfoque', 'el enfoque', 'the focus / the approach', 'm'], ['indole', 'la índole', 'the nature / the kind', 'f'], ['matiz', 'el matiz', 'the nuance', 'm'],
    ['sesgo', 'el sesgo', 'the bias', 'm'], ['premisa', 'la premisa', 'the premise', 'f'], ['desenlace', 'el desenlace', 'the outcome / the ending', 'm'], ['pauta', 'la pauta', 'the guideline / the pattern', 'f'], ['vigencia', 'la vigencia', 'validity / being in force', 'f'],
  ]),
  pack('c1-idioms', 'Everyday idioms', 'Expresiones idiomáticas', 'C1', 'social', [
    ['en-las-nubes', 'estar en las nubes', 'to have one’s head in the clouds'], ['tomar-el-pelo', 'tomar el pelo', 'to pull someone’s leg'], ['pelos-lengua', 'no tener pelos en la lengua', 'to be outspoken'], ['pan-comido', 'ser pan comido', 'to be a piece of cake'], ['meter-la-pata', 'meter la pata', 'to put one’s foot in it'],
    ['tirar-la-toalla', 'tirar la toalla', 'to throw in the towel'], ['hasta-las-narices', 'estar hasta las narices', 'to be fed up'], ['ojo-de-la-cara', 'costar un ojo de la cara', 'to cost an arm and a leg'], ['dar-en-el-clavo', 'dar en el clavo', 'to hit the nail on the head'], ['echar-una-mano', 'echar una mano', 'to lend a hand'],
  ]),
  pack('c1-sociedad', 'Society and politics', 'Sociedad y política', 'C1', 'everyday', [
    ['brecha', 'la brecha', 'the gap (e.g. wage, digital)', 'f'], ['desempleo', 'el desempleo', 'unemployment', 'm'], ['precariedad', 'la precariedad', 'job insecurity', 'f'], ['desigualdad', 'la desigualdad', 'inequality', 'f'], ['ciudadania', 'la ciudadanía', 'citizenship / the citizens', 'f'],
    ['sufragio', 'el sufragio', 'suffrage / the vote', 'm'], ['soberania', 'la soberanía', 'sovereignty', 'f'], ['vivienda', 'la vivienda', 'housing / a dwelling', 'f'], ['reto', 'el reto', 'the challenge', 'm'], ['coyuntura', 'la coyuntura', 'the current situation / the juncture', 'f'],
  ]),
  pack('c2-matices', 'Shades of language', 'Matices del lenguaje', 'C2', 'reading', [
    ['eufemismo', 'el eufemismo', 'the euphemism', 'm'], ['ironia', 'la ironía', 'irony', 'f'], ['ambiguedad', 'la ambigüedad', 'ambiguity', 'f'], ['retintin', 'el retintín', 'a sarcastic tone', 'm'], ['perogrullada', 'la perogrullada', 'a platitude / a truism', 'f'],
    ['muletilla', 'la muletilla', 'a filler word / a verbal tic', 'f'], ['barbarismo', 'el barbarismo', 'a barbarism (a word misused or borrowed badly)', 'm'], ['cursileria', 'la cursilería', 'tackiness / affectation', 'f'], ['circunloquio', 'el circunloquio', 'a circumlocution', 'm'], ['sorna', 'la sorna', 'mocking sarcasm', 'f'],
  ]),
  pack('c2-refranes', 'Proverbs', 'Refranes y dichos', 'C2', 'social', [
    ['mas-vale-tarde', 'más vale tarde que nunca', 'better late than never'], ['caballo-regalado', 'a caballo regalado no le mires el diente', 'don’t look a gift horse in the mouth'], ['no-hay-mal', 'no hay mal que por bien no venga', 'every cloud has a silver lining'], ['mucho-abarca', 'quien mucho abarca poco aprieta', 'don’t bite off more than you can chew'], ['madruga', 'a quien madruga Dios le ayuda', 'the early bird catches the worm'],
    ['boca-cerrada', 'en boca cerrada no entran moscas', 'silence is golden (lit. flies don’t enter a closed mouth)'], ['cria-cuervos', 'cría cuervos y te sacarán los ojos', 'raise crows and they will peck your eyes out (ingratitude)'], ['habito-monje', 'el hábito no hace al monje', 'clothes don’t make the man'], ['ojos-que-no-ven', 'ojos que no ven, corazón que no siente', 'out of sight, out of mind'], ['pajaro-en-mano', 'más vale pájaro en mano que ciento volando', 'a bird in the hand is worth two in the bush'],
  ]),
  pack('c2-culto', 'Literary register', 'Registro culto', 'C2', 'reading', [
    ['pesquisa', 'la pesquisa', 'an inquiry / an investigation', 'f'], ['albur', 'el albur', 'chance / a risk', 'm'], ['desazon', 'la desazón', 'unease', 'f'], ['denuedo', 'el denuedo', 'boldness / daring', 'm'], ['querencia', 'la querencia', 'fondness / a homing instinct', 'f'],
    ['ensimismamiento', 'el ensimismamiento', 'absorption in one’s own thoughts', 'm'], ['zozobra', 'la zozobra', 'anxiety / anguish', 'f'], ['desasosiego', 'el desasosiego', 'restlessness / disquiet', 'm'], ['parsimonia', 'la parsimonia', 'unhurried calm / slowness', 'f'], ['ecuanimidad', 'la ecuanimidad', 'equanimity', 'f'],
  ]),
];

export const VOCAB_PACKS: VocabPack[] = PACKS.map((p) => p.pack);
export const PACK_BY_ID: Record<string, VocabPack> = Object.fromEntries(VOCAB_PACKS.map((p) => [p.id, p]));
export const PACK_ITEMS: VocabItem[] = PACKS.flatMap((p) => p.items);
