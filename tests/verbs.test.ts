import { describe, expect, it } from 'vitest';
import { VERBS, conjugate, parseExample, VERB_BY_INF } from '../src/data/verbs';
import { regularPresent } from '../src/lib/answer';

describe('verb data integrity', () => {
  it('has at least 30 verbs including every required one', () => {
    const required = 'ser estar tener hacer ir venir querer poder saber conocer decir hablar comer beber vivir trabajar estudiar necesitar gustar salir poner dar ver llevar comprar pedir encontrar pensar dormir volver'.split(' ');
    for (const r of required) expect(VERB_BY_INF[r], r).toBeDefined();
    expect(VERBS.length).toBeGreaterThanOrEqual(30);
  });

  it('every verb has 6 non-empty present forms, gerund and participle', () => {
    for (const v of VERBS) {
      expect(v.present).toHaveLength(6);
      for (const f of v.present) expect(f.trim().length, v.inf).toBeGreaterThan(0);
      expect(v.gerund).toMatch(/(ando|iendo|yendo)$/);
      expect(v.participle).toMatch(/(ado|ido|ído|to|cho|sto)$/);
    }
  });

  it('regular verbs match the regular paradigm exactly', () => {
    for (const v of VERBS.filter((v) => v.group === 'regular' && !v.pronominal)) {
      v.present.forEach((f, p) => expect(f, `${v.inf} p${p}`).toBe(regularPresent(v.inf, p)));
    }
  });

  it('stem-changing verbs keep nosotros/vosotros regular (the "boot")', () => {
    for (const v of VERBS.filter((v) => v.group.startsWith('stem'))) {
      expect(v.present[3]).toBe(regularPresent(v.inf, 3));
      expect(v.present[4]).toBe(regularPresent(v.inf, 4));
      expect(v.present[0]).not.toBe(regularPresent(v.inf, 0));
    }
  });

  it('spot-checks well-known irregular forms', () => {
    const check: [string, number, string][] = [
      ['ser', 0, 'soy'], ['ir', 4, 'vais'], ['saber', 0, 'sé'], ['dar', 4, 'dais'], ['ver', 4, 'veis'],
      ['oír', 1, 'oyes'], ['decir', 2, 'dice'], ['conocer', 0, 'conozco'], ['jugar', 5, 'juegan'], ['pedir', 3, 'pedimos'],
    ];
    for (const [inf, p, f] of check) expect(VERB_BY_INF[inf].present[p]).toBe(f);
  });

  it('generates compound tenses with the right auxiliary', () => {
    expect(conjugate(VERB_BY_INF.hablar, 'progressive', 0)).toBe('estoy hablando');
    expect(conjugate(VERB_BY_INF.dormir, 'progressive', 2)).toBe('está durmiendo');
    expect(conjugate(VERB_BY_INF.hacer, 'perfect', 0)).toBe('he hecho');
    expect(conjugate(VERB_BY_INF.volver, 'perfect', 4)).toBe('habéis vuelto');
    expect(conjugate(VERB_BY_INF.gustar, 'perfect', 0)).toBe('me ha gustado');
  });

  it('every example blank matches the conjugation for its person', () => {
    for (const v of VERBS) {
      for (const ex of v.examples) {
        const { answer } = parseExample(ex);
        expect(answer, v.inf).toBeTruthy();
        if (ex.person >= 0) expect(answer.toLowerCase(), `${v.inf}: ${ex.es}`).toBe(v.present[ex.person].toLowerCase());
        else expect(answer, `${v.inf}: ${ex.es}`).toBe(v.inf);
      }
    }
  });
});

import { voseo, personsForRegion } from '../src/data/verbs';
describe('voseo (Buenos Aires)', () => {
  it('stresses the ending with no stem change, plus the four exceptions', () => {
    const want: Record<string, string> = {
      ser: 'sos', ir: 'vas', dar: 'das', ver: 'ves', estar: 'estás', tener: 'tenés', querer: 'querés', poder: 'podés',
      dormir: 'dormís', pedir: 'pedís', decir: 'decís', venir: 'venís', hablar: 'hablás', vivir: 'vivís', oír: 'oís',
      leer: 'leés', jugar: 'jugás', volver: 'volvés', pensar: 'pensás', saber: 'sabés', hacer: 'hacés', salir: 'salís', gustar: 'te gusta',
    };
    for (const [inf, f] of Object.entries(want)) expect(voseo(VERB_BY_INF[inf]), inf).toBe(f);
    expect(conjugate(VERB_BY_INF.tener, 'present', 1, 'argentina')).toBe('tenés');
    expect(conjugate(VERB_BY_INF.tener, 'present', 1, 'mexico')).toBe('tienes');
    expect(conjugate(VERB_BY_INF.hablar, 'progressive', 1, 'argentina')).toBe('estás hablando');
  });
  it('drops vosotros outside Spain', () => {
    expect(personsForRegion('spain')).toContain(4);
    for (const r of ['mexico', 'argentina', 'colombia'] as const) expect(personsForRegion(r)).not.toContain(4);
  });
});
