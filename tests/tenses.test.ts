import { describe, expect, it } from 'vitest';
import { conjugateSimple, imperative, patternYo, regularGerund, regularParticiple, regularPresentForms, type ConjugableVerb } from '../src/data/conjugation';
import { VERB_BY_INF } from '../src/data/verbs';

const v = (inf: string, group: ConjugableVerb['group'] = 'regular', present?: string[]): ConjugableVerb => ({ inf, group, present: present ?? VERB_BY_INF[inf]?.present ?? regularPresentForms(inf, group) });
const all = (verb: ConjugableVerb, tense: Parameters<typeof conjugateSimple>[1]) => [0, 1, 2, 3, 4, 5].map((p) => conjugateSimple(verb, tense, p));

describe('preterite', () => {
  it('regular, spelling changes and vowel stems', () => {
    expect(all(v('hablar'), 'preterite')).toEqual(['hablé', 'hablaste', 'habló', 'hablamos', 'hablasteis', 'hablaron']);
    expect(all(v('comer'), 'preterite')).toEqual(['comí', 'comiste', 'comió', 'comimos', 'comisteis', 'comieron']);
    expect(all(v('vivir'), 'preterite')).toEqual(['viví', 'viviste', 'vivió', 'vivimos', 'vivisteis', 'vivieron']);
    expect(conjugateSimple(v('buscar'), 'preterite', 0)).toBe('busqué');
    expect(conjugateSimple(v('pagar'), 'preterite', 0)).toBe('pagué');
    expect(conjugateSimple(v('empezar', 'stem-e-ie'), 'preterite', 0)).toBe('empecé');
    expect(conjugateSimple(v('jugar', 'stem-u-ue'), 'preterite', 0)).toBe('jugué');
    expect(all(v('leer'), 'preterite')).toEqual(['leí', 'leíste', 'leyó', 'leímos', 'leísteis', 'leyeron']);
    expect(all(v('oír', 'irregular'), 'preterite')).toEqual(['oí', 'oíste', 'oyó', 'oímos', 'oísteis', 'oyeron']);
    expect(all(v('construir'), 'preterite')).toEqual(['construí', 'construiste', 'construyó', 'construimos', 'construisteis', 'construyeron']);
  });
  it('-ir stem changers in the third persons', () => {
    expect(all(v('pedir', 'stem-e-i'), 'preterite')).toEqual(['pedí', 'pediste', 'pidió', 'pedimos', 'pedisteis', 'pidieron']);
    expect(all(v('dormir', 'stem-o-ue'), 'preterite')).toEqual(['dormí', 'dormiste', 'durmió', 'dormimos', 'dormisteis', 'durmieron']);
    expect(conjugateSimple(v('sentir', 'stem-e-ie'), 'preterite', 2)).toBe('sintió');
    expect(conjugateSimple(v('preferir', 'stem-e-ie'), 'preterite', 5)).toBe('prefirieron');
    expect(conjugateSimple(v('volver', 'stem-o-ue'), 'preterite', 2)).toBe('volvió'); // -er verbs do not change
  });
  it('strong and fully irregular preterites, including compounds', () => {
    expect(all(v('tener', 'irregular'), 'preterite')).toEqual(['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron']);
    expect(all(v('hacer', 'irregular-yo'), 'preterite')).toEqual(['hice', 'hiciste', 'hizo', 'hicimos', 'hicisteis', 'hicieron']);
    expect(all(v('decir', 'irregular'), 'preterite')).toEqual(['dije', 'dijiste', 'dijo', 'dijimos', 'dijisteis', 'dijeron']);
    expect(all(v('traer', 'irregular-yo'), 'preterite')).toEqual(['traje', 'trajiste', 'trajo', 'trajimos', 'trajisteis', 'trajeron']);
    expect(all(v('ser', 'irregular'), 'preterite')).toEqual(['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron']);
    expect(all(v('ir', 'irregular'), 'preterite')).toEqual(['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron']);
    expect(all(v('dar', 'irregular'), 'preterite')).toEqual(['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron']);
    expect(all(v('ver', 'irregular-yo'), 'preterite')).toEqual(['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron']);
    expect(conjugateSimple(v('estar', 'irregular'), 'preterite', 3)).toBe('estuvimos');
    expect(conjugateSimple(v('poder', 'stem-o-ue'), 'preterite', 0)).toBe('pude');
    expect(conjugateSimple(v('poner', 'irregular-yo'), 'preterite', 2)).toBe('puso');
    expect(conjugateSimple(v('saber', 'irregular'), 'preterite', 1)).toBe('supiste');
    expect(conjugateSimple(v('querer', 'stem-e-ie'), 'preterite', 5)).toBe('quisieron');
    expect(conjugateSimple(v('venir', 'irregular'), 'preterite', 0)).toBe('vine');
    expect(conjugateSimple(v('conducir'), 'preterite', 5)).toBe('condujeron');
    expect(conjugateSimple(v('mantener', 'irregular'), 'preterite', 2)).toBe('mantuvo');
    expect(conjugateSimple(v('suponer', 'irregular-yo'), 'preterite', 0)).toBe('supuse');
    expect(conjugateSimple(v('conocer', 'irregular-yo'), 'preterite', 0)).toBe('conocí'); // not strong
  });
});

describe('imperfect, future and conditional', () => {
  it('imperfect', () => {
    expect(all(v('hablar'), 'imperfect')).toEqual(['hablaba', 'hablabas', 'hablaba', 'hablábamos', 'hablabais', 'hablaban']);
    expect(all(v('comer'), 'imperfect')).toEqual(['comía', 'comías', 'comía', 'comíamos', 'comíais', 'comían']);
    expect(all(v('ser', 'irregular'), 'imperfect')).toEqual(['era', 'eras', 'era', 'éramos', 'erais', 'eran']);
    expect(all(v('ir', 'irregular'), 'imperfect')).toEqual(['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban']);
    expect(all(v('ver', 'irregular-yo'), 'imperfect')).toEqual(['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían']);
    expect(conjugateSimple(v('oír', 'irregular'), 'imperfect', 0)).toBe('oía');
  });
  it('future and conditional with irregular stems and compounds', () => {
    expect(all(v('hablar'), 'future')).toEqual(['hablaré', 'hablarás', 'hablará', 'hablaremos', 'hablaréis', 'hablarán']);
    expect(all(v('tener', 'irregular'), 'future')).toEqual(['tendré', 'tendrás', 'tendrá', 'tendremos', 'tendréis', 'tendrán']);
    expect(conjugateSimple(v('hacer', 'irregular-yo'), 'future', 2)).toBe('hará');
    expect(conjugateSimple(v('decir', 'irregular'), 'conditional', 0)).toBe('diría');
    expect(conjugateSimple(v('poder', 'stem-o-ue'), 'conditional', 3)).toBe('podríamos');
    expect(conjugateSimple(v('querer', 'stem-e-ie'), 'future', 5)).toBe('querrán');
    expect(conjugateSimple(v('salir', 'irregular-yo'), 'future', 1)).toBe('saldrás');
    expect(conjugateSimple(v('venir', 'irregular'), 'conditional', 4)).toBe('vendríais');
    expect(conjugateSimple(v('saber', 'irregular'), 'future', 0)).toBe('sabré');
    expect(conjugateSimple(v('poner', 'irregular-yo'), 'future', 2)).toBe('pondrá');
    expect(conjugateSimple(v('mantener', 'irregular'), 'future', 0)).toBe('mantendré');
    expect(conjugateSimple(v('oír', 'irregular'), 'future', 0)).toBe('oiré');
    expect(all(v('vivir'), 'conditional')).toEqual(['viviría', 'vivirías', 'viviría', 'viviríamos', 'viviríais', 'vivirían']);
  });
});

describe('present subjunctive', () => {
  it('from the yo stem, with boot and -ir changes and spelling', () => {
    expect(all(v('hablar'), 'subjunctive')).toEqual(['hable', 'hables', 'hable', 'hablemos', 'habléis', 'hablen']);
    expect(all(v('comer'), 'subjunctive')).toEqual(['coma', 'comas', 'coma', 'comamos', 'comáis', 'coman']);
    expect(all(v('tener', 'irregular'), 'subjunctive')).toEqual(['tenga', 'tengas', 'tenga', 'tengamos', 'tengáis', 'tengan']);
    expect(all(v('conocer', 'irregular-yo'), 'subjunctive')).toEqual(['conozca', 'conozcas', 'conozca', 'conozcamos', 'conozcáis', 'conozcan']);
    expect(all(v('querer', 'stem-e-ie'), 'subjunctive')).toEqual(['quiera', 'quieras', 'quiera', 'queramos', 'queráis', 'quieran']);
    expect(all(v('poder', 'stem-o-ue'), 'subjunctive')).toEqual(['pueda', 'puedas', 'pueda', 'podamos', 'podáis', 'puedan']);
    expect(all(v('pedir', 'stem-e-i'), 'subjunctive')).toEqual(['pida', 'pidas', 'pida', 'pidamos', 'pidáis', 'pidan']);
    expect(all(v('dormir', 'stem-o-ue'), 'subjunctive')).toEqual(['duerma', 'duermas', 'duerma', 'durmamos', 'durmáis', 'duerman']);
    expect(all(v('sentir', 'stem-e-ie'), 'subjunctive')).toEqual(['sienta', 'sientas', 'sienta', 'sintamos', 'sintáis', 'sientan']);
    expect(all(v('jugar', 'stem-u-ue'), 'subjunctive')).toEqual(['juegue', 'juegues', 'juegue', 'juguemos', 'juguéis', 'jueguen']);
    expect(all(v('empezar', 'stem-e-ie'), 'subjunctive')).toEqual(['empiece', 'empieces', 'empiece', 'empecemos', 'empecéis', 'empiecen']);
    expect(conjugateSimple(v('buscar'), 'subjunctive', 0)).toBe('busque');
    expect(conjugateSimple(v('llegar'), 'subjunctive', 3)).toBe('lleguemos');
    expect(conjugateSimple(v('hacer', 'irregular-yo'), 'subjunctive', 1)).toBe('hagas');
    expect(conjugateSimple(v('ver', 'irregular-yo'), 'subjunctive', 0)).toBe('vea');
    expect(conjugateSimple(v('oír', 'irregular'), 'subjunctive', 0)).toBe('oiga');
    expect(conjugateSimple(v('seguir', 'stem-e-i'), 'subjunctive', 0)).toBe('siga');
    expect(conjugateSimple(v('coger'), 'subjunctive', 0)).toBe('coja');
    expect(conjugateSimple(v('construir'), 'subjunctive', 3)).toBe('construyamos');
  });
  it('fully irregular subjunctives', () => {
    expect(all(v('ser', 'irregular'), 'subjunctive')).toEqual(['sea', 'seas', 'sea', 'seamos', 'seáis', 'sean']);
    expect(all(v('ir', 'irregular'), 'subjunctive')).toEqual(['vaya', 'vayas', 'vaya', 'vayamos', 'vayáis', 'vayan']);
    expect(all(v('estar', 'irregular'), 'subjunctive')).toEqual(['esté', 'estés', 'esté', 'estemos', 'estéis', 'estén']);
    expect(all(v('dar', 'irregular'), 'subjunctive')).toEqual(['dé', 'des', 'dé', 'demos', 'deis', 'den']);
    expect(all(v('saber', 'irregular'), 'subjunctive')).toEqual(['sepa', 'sepas', 'sepa', 'sepamos', 'sepáis', 'sepan']);
  });
});

describe('imperfect subjunctive and imperative', () => {
  it('imperfect subjunctive (-ra) from the ellos preterite', () => {
    expect(all(v('hablar'), 'imperfect-subjunctive')).toEqual(['hablara', 'hablaras', 'hablara', 'habláramos', 'hablarais', 'hablaran']);
    expect(all(v('tener', 'irregular'), 'imperfect-subjunctive')).toEqual(['tuviera', 'tuvieras', 'tuviera', 'tuviéramos', 'tuvierais', 'tuvieran']);
    expect(all(v('ser', 'irregular'), 'imperfect-subjunctive')).toEqual(['fuera', 'fueras', 'fuera', 'fuéramos', 'fuerais', 'fueran']);
    expect(all(v('decir', 'irregular'), 'imperfect-subjunctive')).toEqual(['dijera', 'dijeras', 'dijera', 'dijéramos', 'dijerais', 'dijeran']);
    expect(conjugateSimple(v('pedir', 'stem-e-i'), 'imperfect-subjunctive', 3)).toBe('pidiéramos');
    expect(conjugateSimple(v('leer'), 'imperfect-subjunctive', 0)).toBe('leyera');
  });
  it('affirmative commands', () => {
    expect(all(v('hablar'), 'imperative')).toEqual(['', 'habla', 'hable', 'hablemos', 'hablad', 'hablen']);
    expect(all(v('comer'), 'imperative')).toEqual(['', 'come', 'coma', 'comamos', 'comed', 'coman']);
    expect(all(v('vivir'), 'imperative')).toEqual(['', 'vive', 'viva', 'vivamos', 'vivid', 'vivan']);
    expect(all(v('pensar', 'stem-e-ie'), 'imperative')).toEqual(['', 'piensa', 'piense', 'pensemos', 'pensad', 'piensen']);
    expect(all(v('tener', 'irregular'), 'imperative')).toEqual(['', 'ten', 'tenga', 'tengamos', 'tened', 'tengan']);
    expect(all(v('ir', 'irregular'), 'imperative')).toEqual(['', 've', 'vaya', 'vamos', 'id', 'vayan']);
    expect(conjugateSimple(v('hacer', 'irregular-yo'), 'imperative', 1)).toBe('haz');
    expect(conjugateSimple(v('decir', 'irregular'), 'imperative', 1)).toBe('di');
    expect(conjugateSimple(v('poner', 'irregular-yo'), 'imperative', 1)).toBe('pon');
    expect(conjugateSimple(v('salir', 'irregular-yo'), 'imperative', 1)).toBe('sal');
    expect(conjugateSimple(v('ser', 'irregular'), 'imperative', 1)).toBe('sé');
    expect(conjugateSimple(v('venir', 'irregular'), 'imperative', 1)).toBe('ven');
    expect(conjugateSimple(v('mantener', 'irregular'), 'imperative', 1)).toBe('mantén');
    expect(conjugateSimple(v('suponer', 'irregular-yo'), 'imperative', 1)).toBe('supón');
    expect(conjugateSimple(v('jugar', 'stem-u-ue'), 'imperative', 2)).toBe('juegue');
    expect(conjugateSimple(v('buscar'), 'imperative', 5)).toBe('busquen');
    expect(conjugateSimple(v('oír', 'irregular'), 'imperative', 4)).toBe('oíd');
  });
  it('vos commands', () => {
    expect(imperative(v('hablar'), 1, true)).toBe('hablá');
    expect(imperative(v('comer'), 1, true)).toBe('comé');
    expect(imperative(v('venir', 'irregular'), 1, true)).toBe('vení');
    expect(imperative(v('ir', 'irregular'), 1, true)).toBe('andá');
    expect(imperative(v('tener', 'irregular'), 1, true)).toBe('tené');
  });
  it('gustar-type verbs', () => {
    const g = v('gustar');
    g.pronominal = true;
    expect(conjugateSimple(g, 'preterite', 0)).toBe('me gustó');
    expect(conjugateSimple(g, 'imperfect', 1)).toBe('te gustaba');
    expect(conjugateSimple(g, 'future', 3)).toBe('nos gustará');
    expect(conjugateSimple(g, 'conditional', 2)).toBe('le gustaría');
    expect(conjugateSimple(g, 'subjunctive', 5)).toBe('les guste');
    expect(conjugateSimple(g, 'imperative', 1)).toBe('');
  });
});

describe('present forms, gerunds and participles generated for the wider bank', () => {
  it('matches the hand-written bank for regular and stem-changing verbs', () => {
    for (const inf of ['hablar', 'comer', 'vivir', 'querer', 'poder', 'pedir', 'jugar', 'pensar', 'dormir', 'volver', 'entender', 'encontrar', 'empezar', 'conocer', 'salir', 'poner', 'hacer', 'traer', 'ver']) {
      const b = VERB_BY_INF[inf];
      const yo = ['salir', 'poner', 'hacer', 'traer', 'ver'].includes(inf) ? b.present[0] : undefined;
      expect(regularPresentForms(inf, b.group, yo), inf).toEqual(b.present);
      expect(regularGerund(inf, b.group), inf).toBe(b.gerund);
    }
    expect(regularParticiple('leer')).toBe('leído');
    expect(regularParticiple('hablar')).toBe('hablado');
    expect(regularGerund('leer', 'regular')).toBe('leyendo');
    expect(regularGerund('oír', 'irregular')).toBe('oyendo');
    expect(regularGerund('sentir', 'stem-e-ie')).toBe('sintiendo');
    expect(regularGerund('construir', 'regular')).toBe('construyendo');
  });
  it('pattern irregular yo forms', () => {
    expect(regularPresentForms('conocer', 'irregular-yo')[0]).toBe('conozco');
    expect(regularPresentForms('parecer', 'irregular-yo')[0]).toBe('parezco');
    expect(regularPresentForms('conducir', 'irregular-yo')[0]).toBe('conduzco');
    expect(regularPresentForms('coger', 'irregular-yo')).toEqual(['cojo', 'coges', 'coge', 'cogemos', 'cogéis', 'cogen']);
    expect(regularPresentForms('dirigir', 'irregular-yo')[0]).toBe('dirijo');
    expect(regularPresentForms('seguir', 'stem-e-i')).toEqual(['sigo', 'sigues', 'sigue', 'seguimos', 'seguís', 'siguen']);
    expect(regularPresentForms('construir', 'regular')).toEqual(['construyo', 'construyes', 'construye', 'construimos', 'construís', 'construyen']);
    expect(regularPresentForms('vencer', 'irregular-yo')[0]).toBe('venzo');
    expect(regularPresentForms('elegir', 'stem-e-i')).toEqual(['elijo', 'eliges', 'elige', 'elegimos', 'elegís', 'eligen']);
    expect(patternYo('hablar')).toBeNull();
  });
});

// ── Forms added to match the Instituto Cervantes curriculum plan (B1 and B2) ──
import { TENSES as ALL_TENSES, VERBS as ALL_VERBS, VERB_BY_INF as BY_INF, conjugate as conj, personsForTense as personsFor, type Tense as T } from '../src/data/verbs';
import { buildSession as session } from '../src/lib/exercises';
import { defaultState as blank } from '../src/lib/state';
import { classifyVerbError as diagnose } from '../src/lib/answer';

describe('compound tenses and negative commands', () => {
  const forms = (inf: string, t: T) => [0, 1, 2, 3, 4, 5].map((p) => conj(BY_INF[inf], t, p, 'spain'));
  it('conjugates haber in each tense and keeps the participle, irregular ones included', () => {
    expect(forms('hablar', 'pluperfect')).toEqual(['había hablado', 'habías hablado', 'había hablado', 'habíamos hablado', 'habíais hablado', 'habían hablado']);
    expect(forms('hacer', 'future-perfect')).toEqual(['habré hecho', 'habrás hecho', 'habrá hecho', 'habremos hecho', 'habréis hecho', 'habrán hecho']);
    expect(forms('decir', 'conditional-perfect')).toEqual(['habría dicho', 'habrías dicho', 'habría dicho', 'habríamos dicho', 'habríais dicho', 'habrían dicho']);
    expect(forms('ver', 'perfect-subjunctive')).toEqual(['haya visto', 'hayas visto', 'haya visto', 'hayamos visto', 'hayáis visto', 'hayan visto']);
    expect(forms('poner', 'pluperfect-subjunctive')).toEqual(['hubiera puesto', 'hubieras puesto', 'hubiera puesto', 'hubiéramos puesto', 'hubierais puesto', 'hubieran puesto']);
    expect(conj(BY_INF['gustar'], 'pluperfect', 0, 'spain')).toBe('me había gustado');
  });
  it('builds negative commands from the present subjunctive, with no yo form', () => {
    expect(forms('hablar', 'negative-imperative')).toEqual(['', 'no hables', 'no hable', 'no hablemos', 'no habléis', 'no hablen']);
    expect(forms('tener', 'negative-imperative').slice(1)).toEqual(['no tengas', 'no tenga', 'no tengamos', 'no tengáis', 'no tengan']);
    expect(forms('ir', 'negative-imperative').slice(1)).toEqual(['no vayas', 'no vaya', 'no vayamos', 'no vayáis', 'no vayan']);
    expect(forms('pedir', 'negative-imperative')[1]).toBe('no pidas');
    expect(personsFor('negative-imperative', 'spain')).not.toContain(0);
    expect(conj(BY_INF['gustar'], 'negative-imperative', 1, 'spain')).toBe('');
  });
  it('places every tense at the level the curriculum plan gives it', () => {
    const level = Object.fromEntries(ALL_TENSES.map((t) => [t.id, t.minLevel]));
    expect(level).toEqual({
      present: 'A1',
      progressive: 'A2', perfect: 'A2', preterite: 'A2', imperfect: 'A2', imperative: 'A2',
      future: 'B1', conditional: 'B1', subjunctive: 'B1', pluperfect: 'B1', 'negative-imperative': 'B1',
      'imperfect-subjunctive': 'B2', 'perfect-subjunctive': 'B2', 'pluperfect-subjunctive': 'B2', 'conditional-perfect': 'B2', 'future-perfect': 'B2',
    });
  });
  it('every verb has a form in every new tense, and sessions build with sensible wrong answers', () => {
    for (const t of ['pluperfect', 'future-perfect', 'conditional-perfect', 'perfect-subjunctive', 'pluperfect-subjunctive', 'negative-imperative'] as T[]) {
      for (const v of ALL_VERBS) for (const p of personsFor(t, 'spain')) { if (v.pronominal && t === 'negative-imperative') continue; expect(conj(v, t, p, 'spain'), `${v.inf} ${t} ${p}`).toMatch(/\S \S/); }
      const ex = session({ state: blank(), tense: t, rng: () => 0.37 });
      expect(ex.length).toBeGreaterThan(5);
    }
    expect(diagnose(BY_INF['hablar'], 'pluperfect', 0, 'habría hablado')).toBe('auxiliary');
    expect(diagnose(BY_INF['hablar'], 'pluperfect', 0, 'habías hablado')).toBe('person-agreement');
  });
});
