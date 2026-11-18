import { describe, expect, it } from 'vitest';
import { TOPICS, TOPIC_VOCAB, topicsOf } from '../src/data/topics';
import { LADDER_BY_ID, SENTENCE_STEPS, parseRung } from '../src/data/ladders';
import { VERB_BY_INF, parseExample } from '../src/data/verbs';
import { VOCAB_BY_ID } from '../src/data/vocab';
import { buildSession } from '../src/lib/exercises';
import { defaultState } from '../src/lib/state';
import { DemoBackend, type DemoStorage } from '../src/lib/platform/backend';
import { buildWorkspace, DEMO_PEOPLE } from '../src/lib/platform/demoSeed';
import { DEMO_STUDENT_IDS, DEMO_TEACHER_ID, type PlatformData } from '../src/lib/platform/types';

const state = { ...defaultState(), profile: { ...(defaultState().profile ?? {}), region: 'spain', activities: [] } } as never;
const squash = (s: string) => s.toLowerCase().replace(/[.,;]/g, '').replace(/\s+/g, ' ').trim();
let seed = 7; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

describe('topics a student loves', () => {
  it('every example sentence uses a verb the app knows, in the right form for its person', () => {
    for (const t of TOPICS) for (const [inf, list] of Object.entries(t.examples)) {
      expect(VERB_BY_INF[inf], `${t.id} ${inf}`).toBeTruthy();
      for (const e of list) expect(parseExample(e).answer, e.es).toBe(VERB_BY_INF[inf].present[e.person]);
    }
  });
  it('every growing sentence has five steps, each adding one part to the one before', () => {
    for (const t of TOPICS) for (const l of t.ladders) {
      expect(LADDER_BY_ID[l.id]).toBe(l);
      expect(VERB_BY_INF[l.verb], l.id).toBeTruthy();
      expect(l.rungs).toHaveLength(SENTENCE_STEPS.length);
      for (const r of l.rungs) expect(r.es.match(/\[/g), r.es).toHaveLength(1);
      for (let k = 1; k < l.rungs.length; k++) expect(squash(parseRung(l.rungs[k]).before + ' ' + parseRung(l.rungs[k]).after), `${l.id} step ${k + 1}`).toBe(squash(parseRung(l.rungs[k - 1]).plain));
    }
  });
  it('its words are cards the memory deck can show', () => {
    expect(TOPIC_VOCAB.length).toBeGreaterThan(40);
    for (const w of TOPIC_VOCAB) expect(VOCAB_BY_ID[w.id]).toBe(w);
    expect(new Set(TOPIC_VOCAB.map((w) => w.id)).size).toBe(TOPIC_VOCAB.length);
  });
  it('a golfer who loves old cars gets sentences about golf and cars, and nobody else does', () => {
    const about = (topics?: string[]) => {
      let themed = 0, sentences = 0, ladders = 0;
      const mine = new Set(topicsOf(topics ?? ['golf', 'tennis', 'classic-cars']).flatMap((t) => Object.values(t.examples).flat().map((e) => e.es)));
      for (let n = 0; n < 30; n++) for (const e of buildSession({ state, tense: 'present', sentence: 4, topics, rng })) {
        if (e.kind === 'context' || e.kind === 'build' || e.kind === 'fix' || e.kind === 'translate') { sentences++; if (mine.has(e.example.es)) themed++; }
        if (e.kind === 'extend' && e.rung === 0 && e.ladder.startsWith('tp-')) ladders++;
      }
      return { themed, sentences, ladders };
    };
    const julian = about(['golf', 'tennis', 'classic-cars']);
    expect(julian.themed / julian.sentences).toBeGreaterThan(0.5);
    expect(julian.ladders).toBeGreaterThan(12);
    const other = about(undefined);
    expect(other.themed).toBe(0);
    expect(other.ladders).toBe(0);
  });
  it('keeps to the verbs a teacher has released', () => {
    const allowed = new Set(['ser', 'estar', 'tener']);
    for (let n = 0; n < 20; n++) for (const e of buildSession({ state, tense: 'present', sentence: 5, topics: ['golf', 'classic-cars'], allowed, rng })) {
      if ('verb' in e) expect(allowed.has(e.verb), e.verb).toBe(true);
    }
  });
  it('other tenses end with a growing sentence about the topic', () => {
    let n = 0;
    for (let k = 0; k < 20; k++) if (buildSession({ state, tense: 'preterite', sentence: 3, topics: ['classic-cars'], rng }).some((e) => e.kind === 'extend' && e.ladder === 'tp-cars-pret')) n++;
    expect(n).toBeGreaterThan(8);
  });
});

describe('saving what a student loves', () => {
  it('the teacher sets topics, the student reads them, and other saves keep them', async () => {
    const store: DemoStorage & { saved: PlatformData } = { saved: buildWorkspace(Date.UTC(2026, 10, 9, 9)), loadData: async () => store.saved, saveData: async (d: PlatformData) => { store.saved = d; }, loadStudentState: async () => null };
    const dina = DEMO_PEOPLE.find((p) => p.id === DEMO_TEACHER_ID)!; const sam = DEMO_PEOPLE.find((p) => p.id === DEMO_STUDENT_IDS.sam)!;
    const teacher = new DemoBackend(dina, store.saved, store);
    await teacher.saveStudentSettings({ studentId: sam.id, maxLevel: 'A2', topics: ['golf', 'tennis', 'classic-cars', 'golf'] });
    expect((await new DemoBackend(sam, store.saved, store).studentSettings(sam.id))?.topics).toEqual(['golf', 'tennis', 'classic-cars']);
    // A later save from another control (the level, the sentence length) does not mention topics.
    await new DemoBackend(dina, store.saved, store).saveStudentSettings({ studentId: sam.id, maxLevel: 'B1', sentence: 3 });
    expect(await new DemoBackend(dina, store.saved, store).studentSettings(sam.id)).toMatchObject({ maxLevel: 'B1', sentence: 3, topics: ['golf', 'tennis', 'classic-cars'] });
    await new DemoBackend(dina, store.saved, store).saveStudentSettings({ studentId: sam.id, maxLevel: 'B1', topics: [] });
    expect((await new DemoBackend(dina, store.saved, store).studentSettings(sam.id))?.topics).toBeUndefined();
  });
});

import { matchTopics } from '../src/data/topics';
describe('what a student writes about themselves', () => {
  it('finds the topics the app has and lists what it has none for', () => {
    expect(matchTopics('I am a massive golf lover, love my tennis as well, and old cars like Jaguars. Also sailing and red wine')).toEqual({ topics: ['golf', 'tennis', 'classic-cars'], unmatched: ['sailing', 'red wine'] });
    expect(matchTopics('Me gusta el fútbol y cocinar')).toEqual({ topics: ['football', 'cooking'], unmatched: [] });
    expect(matchTopics('golfing, Tennis')).toEqual({ topics: ['golf', 'tennis'], unmatched: [] });
  });
  it('is not fooled by words that only contain a topic word', () => {
    expect(matchTopics('carpentry and scarves').topics).toEqual([]);
    expect(matchTopics('carpentry and scarves').unmatched).toEqual(['carpentry', 'scarves']);
    expect(matchTopics('')).toEqual({ topics: [], unmatched: [] });
    expect(matchTopics(undefined)).toEqual({ topics: [], unmatched: [] });
  });
});
