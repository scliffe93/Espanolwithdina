import { describe, expect, it } from 'vitest';
import { BOOT, FAMILIES, familyRound, regularForm, stemForm } from '../src/data/families';
import { VERB_BY_INF } from '../src/data/verbs';

describe('verb families', () => {
  it('changes the stem inside the boot and nowhere else', () => {
    const yo: Record<string, string> = { querer: 'quiero', pensar: 'pienso', empezar: 'empiezo', entender: 'entiendo', cerrar: 'cierro', preferir: 'prefiero', sentir: 'siento', perder: 'pierdo', despertar: 'despierto', comenzar: 'comienzo',
      poder: 'puedo', dormir: 'duermo', volver: 'vuelvo', encontrar: 'encuentro', contar: 'cuento', recordar: 'recuerdo', costar: 'cuesto', almorzar: 'almuerzo', mover: 'muevo', morir: 'muero',
      pedir: 'pido', servir: 'sirvo', repetir: 'repito', vestir: 'visto', medir: 'mido' };
    const stems = FAMILIES.filter((f) => f.where === 'boot');
    expect(stems.flatMap((f) => f.verbs).map((v) => v.inf).sort()).toEqual(Object.keys(yo).sort());
    for (const f of stems) for (const v of f.verbs) {
      expect(stemForm(v.inf, f.id as 'e-ie', 0), v.inf).toBe(yo[v.inf]);
      for (const p of [3, 4]) expect(stemForm(v.inf, f.id as 'e-ie', p), v.inf).toBe(regularForm(v.inf, p));
      for (const p of BOOT) expect(stemForm(v.inf, f.id as 'e-ie', p)).not.toBe(regularForm(v.inf, p));
    }
    expect([0, 1, 2, 3, 4, 5].map((p) => stemForm('poder', 'o-ue', p))).toEqual(['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden']);
    expect([0, 1, 2, 3, 4, 5].map((p) => stemForm('pedir', 'e-i', p))).toEqual(['pido', 'pides', 'pide', 'pedimos', 'pedís', 'piden']);
    expect([0, 1, 2, 3, 4, 5].map((p) => stemForm('pensar', 'e-ie', p))).toEqual(['pienso', 'piensas', 'piensa', 'pensamos', 'pensáis', 'piensan']);
  });
  it('agrees with the app’s own verbs wherever a verb is in both', () => {
    for (const f of FAMILIES) for (const v of f.verbs) {
      const known = VERB_BY_INF[v.inf]; if (!known) continue;
      if (f.where === 'yo') expect(known.present[0], v.inf).toBe(v.yo);
      else for (let p = 0; p < 6; p++) expect(stemForm(v.inf, f.id as 'e-ie', p), `${v.inf} ${p}`).toBe(known.present[p]);
    }
  });
  it('deals a full round of answerable questions', () => {
    let s = 7; const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (const only of [undefined, 'e-ie', 'go'] as const) {
      const qs = familyRound(10, rng, only);
      expect(qs.length, String(only)).toBe(10);
      for (const q of qs) {
        if (q.kind === 'sort') { expect(q.options).toContain(q.family); expect(new Set(q.options).size).toBe(q.options.length); }
        if (q.kind === 'same') { expect(q.answer.length).toBeGreaterThan(1); expect(q.model.inf).not.toBe(q.verb.inf); }
        if (q.kind === 'boot') { expect(q.options).toHaveLength(2); expect(q.options).toContain(q.answer); expect(q.options[0]).not.toBe(q.options[1]); }
      }
    }
    expect(familyRound(10, rng, undefined, false).every((q) => q.kind !== 'boot' || q.person !== 4)).toBe(true);
  });
});
