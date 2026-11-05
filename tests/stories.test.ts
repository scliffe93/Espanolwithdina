import { describe, expect, it } from 'vitest';
import { CHARACTERS, CITY_STORIES, INTEREST_YOU, SCENES, type Scene, type SceneNode } from '../src/data/story';
import { VOCAB_BY_ID } from '../src/data/vocab';

function targets(scene: Scene, n: SceneNode): string[] {
  const t: string[] = [];
  if (n.next) t.push(n.next);
  if (n.input) t.push(n.input.next);
  if (n.interestNext) t.push(n.interestNext);
  for (const c of n.choices ?? []) {
    if (c.next === '__branch') {
      expect(n.branchIf, `${scene.id}/${n.id}: __branch without branchIf`).toBeTruthy();
      t.push(n.branchIf!.then, n.branchIf!.else);
    } else t.push(c.next);
  }
  return t;
}

const ALLOWED_PLACEHOLDER = /\{(name|homeTown|g:[^|}]+\|[^}]+)\}/g;

describe('story integrity (all cities)', () => {
  it('scene ids are globally unique', () => {
    const ids = SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const story of CITY_STORIES) {
    describe(story.city, () => {
      it('has exactly chapters 1, 2, 3 chained by `requires`', () => {
        const sc = story.scenes;
        expect(sc.map((s) => s.chapter).sort()).toEqual([1, 2, 3]);
        const by = Object.fromEntries(sc.map((s) => [s.chapter, s]));
        expect(by[1].requires).toBeUndefined();
        expect(by[2].requires).toBe(by[1].id);
        expect(by[3].requires).toBe(by[2].id);
        for (const s of sc) {
          expect(s.city).toBe(story.city);
          expect(s.map.x).toBeGreaterThanOrEqual(10);
          expect(s.map.x).toBeLessThanOrEqual(90);
          expect(s.map.y).toBeGreaterThanOrEqual(15);
          expect(s.map.y).toBeLessThanOrEqual(85);
        }
      });

      for (const scene of story.scenes) {
        it(`${scene.id}: graph, cast, vocab, choices and templates are valid`, () => {
          expect(scene.nodes[scene.start], 'start node').toBeTruthy();
          for (const c of scene.cast) expect(CHARACTERS[c], `cast ${c}`).toBeTruthy();
          for (const v of scene.vocab) expect(VOCAB_BY_ID[v], `vocab ${v}`).toBeTruthy();
          for (const n of Object.values(scene.nodes)) {
            expect(n.speaker === 'narrator' || !!CHARACTERS[n.speaker], `${scene.id}/${n.id} speaker ${n.speaker}`).toBe(true);
            for (const t of targets(scene, n)) expect(scene.nodes[t], `${scene.id}/${n.id} → ${t}`).toBeTruthy();
            for (const v of n.vocab ?? []) expect(VOCAB_BY_ID[v], `${scene.id}/${n.id} vocab ${v}`).toBeTruthy();
            const hasExit = !!(n.next || n.choices?.length || n.input || n.choicesFrom || n.end);
            expect(hasExit, `${scene.id}/${n.id} is a dead end`).toBe(true);
            if (n.choices) {
              expect(n.choices.some((c) => c.quality === 'great'), `${scene.id}/${n.id} needs a great choice`).toBe(true);
              for (const c of n.choices) if (c.quality === 'off') {
                expect(c.feedback, `${scene.id}/${n.id} off choice needs feedback`).toBeTruthy();
                expect(c.category, `${scene.id}/${n.id} off choice needs category`).toBeTruthy();
              }
            }
            if (n.choicesFrom === 'interests') {
              expect(n.interestNext, `${scene.id}/${n.id} interestNext`).toBeTruthy();
              const inv = scene.nodes[n.interestNext!];
              expect(inv.variantFlag).toBe('interest');
              for (const k of Object.keys(INTEREST_YOU)) expect(inv.variants?.[k], `${scene.id}/${inv.id} invite for ${k}`).toBeTruthy();
            }
            const texts = [n.es, n.en, ...(n.choices ?? []).flatMap((c) => [c.es, c.en, c.feedback ?? ''])];
            for (const t of texts) expect(t.replace(ALLOWED_PLACEHOLDER, ''), `${scene.id}/${n.id} bad placeholder in "${t}"`).not.toMatch(/[{}]/);
          }
          // reachability
          const seen = new Set<string>([scene.start]);
          const queue = [scene.start];
          while (queue.length) for (const t of targets(scene, scene.nodes[queue.shift()!])) if (!seen.has(t)) { seen.add(t); queue.push(t); }
          for (const id of Object.keys(scene.nodes)) expect(seen.has(id), `${scene.id}/${id} unreachable`).toBe(true);
          expect([...seen].some((id) => scene.nodes[id].end), `${scene.id} has no reachable end`).toBe(true);
        });
      }
    });
  }
});
