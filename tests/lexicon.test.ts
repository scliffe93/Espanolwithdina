import { describe, expect, it } from 'vitest';
import { conjugateSimple } from '../src/data/conjugation';
import { ENTRIES, LEXICON } from '../src/data/lexicon';
import { VERBS, VERB_BY_INF, conjugate, personsForTense } from '../src/data/verbs';

describe('the wider verb bank', () => {
  it('has well-formed entries at every level and no duplicates', () => {
    expect(LEXICON.length).toBeGreaterThan(300);
    const infs = new Set<string>();
    for (const v of LEXICON) {
      expect(infs.has(v.inf), v.inf).toBe(false);
      infs.add(v.inf);
      expect(v.present, v.inf).toHaveLength(6);
      for (const f of v.present) expect(f, v.inf).toMatch(/^[a-záéíóúñü]+$/);
      expect(v.gerund, v.inf).toMatch(/(ando|iendo|yendo)$/);
      expect(v.participle, v.inf).toMatch(/(ado|ido|ído|to|cho)$/);
      expect(v.en.length, v.inf).toBeGreaterThan(2);
    }
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) expect(LEXICON.filter((v) => v.level === level).length, level).toBeGreaterThan(20);
    expect(ENTRIES.length).toBe(LEXICON.length);
  });
  it('is merged into VERBS after the hand-written verbs, which keep their examples', () => {
    expect(VERBS.length).toBeGreaterThan(340);
    expect(VERB_BY_INF.hablar.examples.length).toBeGreaterThan(0);
    expect(VERB_BY_INF.mantener.examples).toEqual([]);
    expect(VERB_BY_INF.mantener.frequencyRank).toBeGreaterThan(VERB_BY_INF.hablar.frequencyRank);
    expect(VERB_BY_INF.cerrar.level).toBe('A1');
    expect(VERB_BY_INF.zozobrar.level).toBe('C2');
  });
  it('generates the right present forms for the tricky ones', () => {
    const p = (inf: string) => VERB_BY_INF[inf].present.join(' ');
    expect(p('cerrar')).toBe('cierro cierras cierra cerramos cerráis cierran');
    expect(p('seguir')).toBe('sigo sigues sigue seguimos seguís siguen');
    expect(p('elegir')).toBe('elijo eliges elige elegimos elegís eligen');
    expect(p('construir')).toBe('construyo construyes construye construimos construís construyen');
    expect(p('conducir')).toBe('conduzco conduces conduce conducimos conducís conducen');
    expect(p('caer')).toBe('caigo caes cae caemos caéis caen');
    expect(p('mantener')).toBe('mantengo mantienes mantiene mantenemos mantenéis mantienen');
    expect(p('proponer')).toBe('propongo propones propone proponemos proponéis proponen');
    expect(p('enviar')).toBe('envío envías envía enviamos enviáis envían');
    expect(p('vencer')).toBe('venzo vences vence vencemos vencéis vencen');
    expect(p('distinguir')).toBe('distingo distingues distingue distinguimos distinguís distinguen');
    expect(p('dormir')).toBe('duermo duermes duerme dormimos dormís duermen');
    expect(VERB_BY_INF.caer.gerund).toBe('cayendo');
    expect(VERB_BY_INF.caer.participle).toBe('caído');
    expect(VERB_BY_INF.proponer.participle).toBe('propuesto');
    expect(VERB_BY_INF.intervenir.gerund).toBe('interviniendo');
    expect(VERB_BY_INF.sentir.gerund).toBe('sintiendo');
    expect(VERB_BY_INF.seguir.group).toBe('stem-e-i');
    expect(VERB_BY_INF.conducir.group).toBe('irregular-yo');
  });
  it('conjugates bank verbs in every tense through the app entry point', () => {
    const c = (inf: string, t: Parameters<typeof conjugate>[1], p: number) => conjugate(VERB_BY_INF[inf], t, p, 'spain');
    expect(c('mantener', 'preterite', 2)).toBe('mantuvo');
    expect(c('mantener', 'future', 0)).toBe('mantendré');
    expect(c('mantener', 'imperative', 1)).toBe('mantén');
    expect(c('contradecir', 'future', 0)).toBe('contradiré');
    expect(c('contradecir', 'imperative', 1)).toBe('contradice');
    expect(c('sobresalir', 'imperative', 1)).toBe('sobresal');
    expect(c('atraer', 'preterite', 0)).toBe('atraje');
    expect(c('caer', 'preterite', 2)).toBe('cayó');
    expect(c('enviar', 'subjunctive', 0)).toBe('envíe');
    expect(c('atenuar', 'subjunctive', 2)).toBe('atenúe');
    expect(c('huir', 'preterite', 2)).toBe('huyó');
    expect(c('elegir', 'subjunctive', 0)).toBe('elija');
    expect(c('distinguir', 'subjunctive', 0)).toBe('distinga');
    expect(c('apaciguar', 'preterite', 0)).toBe('apacigüé');
    expect(c('zaherir', 'preterite', 2)).toBe('zahirió');
    expect(c('aducir', 'preterite', 5)).toBe('adujeron');
    expect(c('poseer', 'imperfect-subjunctive', 3)).toBe('poseyéramos');
    expect(c('tener', 'imperative', 1, )).toBe('ten');
    expect(conjugate(VERB_BY_INF.hablar, 'imperative', 1, 'argentina')).toBe('hablá');
    expect(conjugate(VERB_BY_INF.hablar, 'preterite', 1, 'argentina')).toBe('hablaste');
    expect(c('gustar', 'conditional', 0)).toBe('me gustaría');
    expect(c('hablar', 'imperative', 0)).toBe('');
    expect(personsForTense('imperative', 'spain')).toEqual([1, 2, 3, 4, 5]);
    expect(personsForTense('imperative', 'mexico')).toEqual([1, 2, 3, 5]);
    expect(personsForTense('preterite', 'mexico')).toEqual([0, 1, 2, 3, 5]);
  });
  it('every bank verb conjugates in every simple tense without blanks (except yo commands)', () => {
    for (const v of VERBS) {
      for (const tense of ['preterite', 'imperfect', 'future', 'conditional', 'subjunctive', 'imperfect-subjunctive', 'imperative'] as const) {
        for (const p of [0, 1, 2, 3, 4, 5]) {
          const f = conjugateSimple(v, tense, p);
          if (tense === 'imperative' && (p === 0 || v.pronominal)) expect(f, `${v.inf} ${tense} ${p}`).toBe('');
          else expect(f, `${v.inf} ${tense} ${p}`).toMatch(/^[a-záéíóúñü]+( [a-záéíóúñü]+)*$/);
        }
      }
    }
  });
});
