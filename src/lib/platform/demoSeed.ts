import type { AppState, ErrorCategory } from '../../types';
import { blankProfile } from '../../data/profileOptions';
import { scenesForCity } from '../../data/story';
import { VERBS, personsForRegion, verbKey } from '../../data/verbs';
import { VOCAB, vocabKey } from '../../data/vocab';
import { newlyUnlocked } from '../achievements';
import { classifyVerbError, regularPresent } from '../answer';
import { addActiveSeconds, addSpeakingAttempt, addToDeck, applyTechnique, completeLesson, completeScene, defaultState, recordAttempt } from '../state';
import { DEMO_STUDENT_IDS, DEMO_TEACHER_ID, type Booking, type Feedback, type Homework, type PlatformData, type Person } from './types';
import { addMinutes, zonedToUtcIso } from './time';

// ───────────────────────────────────────────────────────────────
// Demonstration data for the prototype: Dina (teacher), Sam and Anneka.
// Their learning progress is produced by replaying plausible study
// sessions through the app's REAL reducers (recordAttempt, completeScene…),
// so every statistic on the dashboards is genuinely computed — it is
// simply computed over fictional activity, and labelled as such.
// Everything is relative to "now", so the demo always looks current.
// ───────────────────────────────────────────────────────────────

export const DEMO_PEOPLE: Person[] = [
  { id: DEMO_TEACHER_ID, username: 'Dina', firstName: 'Dina', role: 'teacher', demo: true },
  { id: DEMO_STUDENT_IDS.sam, username: 'Sam', firstName: 'Sam', role: 'student', demo: true },
  { id: DEMO_STUDENT_IDS.anneka, username: 'Anneka', firstName: 'Anneka', role: 'student', demo: true },
];

/** Small deterministic PRNG so the demo is identical on every device. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const dayAt = (now: number, daysAgo: number, hour: number) => {
  const d = new Date(now - daysAgo * DAY);
  d.setHours(hour, 10, 0, 0);
  return d.getTime();
};

interface Plan {
  seed: number;
  name: string;
  gender: 'm' | 'f';
  city: AppState['profile'] extends infer P ? (P extends { city: infer C } ? C : never) : never;
  levels: AppState['profile'] extends infer P ? (P extends { levels: infer L } ? L : never) : never;
  interests: string[];
  startedDaysAgo: number;
  /** Which of the last N days were study days (0 = today). */
  studyDays: number[];
  minutesPerDay: [number, number];
  accuracy: number;
  verbCount: number;
  chapters: number;
  weakCategory: ErrorCategory;
  speakingPerDay: [number, number];
  hintsRate: number;
  dailyMinutes: number;
  difficulties: string[];
}

function buildStudent(plan: Plan, now: number): AppState {
  const r = rng(plan.seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  let s: AppState = {
    ...defaultState(),
    onboardingDone: true,
    profile: {
      ...blankProfile(),
      name: plan.name,
      gender: plan.gender,
      city: plan.city as never,
      region: 'spain',
      citiesVisited: [plan.city as never],
      destinationCity: plan.city === 'valencia' ? 'Valencia' : 'Madrid',
      destinationCountry: 'España',
      proficiencySelf: plan.levels.vocabulary === 'A1' ? 'few-words' : 'basic',
      interests: plan.interests as never,
      reasons: ['relocation', 'friends'],
      socialGoals: ['friends'],
      activities: ['stories', 'games', 'speaking'],
      difficulties: plan.difficulties as never,
      dailyMinutes: plan.dailyMinutes,
      hasTeacher: true,
      levels: plan.levels as never,
      levelSource: 'assessment',
      createdAt: now - plan.startedDaysAgo * DAY,
    },
    teacher: { name: 'Dina', email: '' },
  };
  const persons = personsForRegion('spain');
  const verbs = [...VERBS].sort((a, b) => a.frequencyRank - b.frequencyRank).slice(0, plan.verbCount);
  const scenes = scenesForCity(plan.city as never);
  const themeVocab = VOCAB.filter((v) => ['arrival', 'home', 'cafe', 'social', 'everyday'].includes(v.theme)).slice(0, 36);
  let chaptersDone = 0;

  const studyDays = [...plan.studyDays].sort((a, b) => b - a); // oldest first
  studyDays.forEach((daysAgo, idx) => {
    const t0 = dayAt(now, daysAgo, 18 + Math.floor(r() * 3));
    const minutes = plan.minutesPerDay[0] + Math.floor(r() * (plan.minutesPerDay[1] - plan.minutesPerDay[0]));
    s = addActiveSeconds(s, minutes * 60, false, t0);
    s = addActiveSeconds(s, Math.floor(minutes * 60 * 0.18), true, t0 + 1000);

    // A chapter roughly every 5 study days
    if (chaptersDone < plan.chapters && idx % 5 === 2 && scenes[chaptersDone]) {
      const sc = scenes[chaptersDone];
      s = completeScene(s, sc.id, 0.6 + r() * 0.35, Object.fromEntries(sc.cast.map((c) => [c, 8 + Math.floor(r() * 10)])), chaptersDone === 1 ? { register: 'usted', homeTown: 'Londres' } : {}, t0 + 5 * 60_000);
      s = addToDeck(s, sc.vocab.map(vocabKey), t0 + 6 * 60_000);
      chaptersDone++;
    }
    // Vocabulary added gradually
    if (idx % 2 === 0) s = addToDeck(s, themeVocab.slice(idx * 2, idx * 2 + 3).map((v) => vocabKey(v.id)), t0 + 2000);

    // Verb drills: 8–16 attempts, accuracy per plan, weakest category dominates mistakes
    const attempts = 8 + Math.floor(r() * 9);
    for (let i = 0; i < attempts; i++) {
      const v = verbs[Math.floor(r() * Math.min(verbs.length, 6 + idx * 2))];
      const person = persons[Math.floor(r() * persons.length)];
      const key = verbKey(v.inf, 'present', person);
      const at = t0 + (3 + i) * 60_000;
      const ok = r() < plan.accuracy;
      if (ok) s = recordAttempt(s, { key, grade: r() < plan.hintsRate ? 1 : 2, exerciseType: pick(['type', 'choice', 'context', 'match']), verb: v.inf, tense: 'present' }, at);
      else {
        const given = v.group === 'regular' ? v.present[(person + 1) % 6] : regularPresent(v.inf, person);
        let category = classifyVerbError(v, 'present', person, given);
        if (r() < 0.35) category = plan.weakCategory;
        s = recordAttempt(s, { key, grade: 0, exerciseType: pick(['type', 'choice', 'context']), verb: v.inf, tense: 'present', mistake: { expected: v.present[person], given, category, context: `Verb gym · ${v.inf}` } }, at);
      }
    }
    // Memory reviews (delayed recall data)
    const vocabCards = Object.keys(s.srs).filter((k) => k.startsWith('vocab:')).slice(0, 6);
    for (const key of vocabCards) {
      const at = t0 + (25 + vocabCards.indexOf(key)) * 60_000;
      if (r() < 0.3) s = applyTechnique(s, key, pick(['first-letters', 'origin', 'mnemonic', 'visual']), at - 30_000);
      s = recordAttempt(s, { key, grade: r() < plan.accuracy + 0.05 ? 2 : 0, exerciseType: 'review-vocab' }, at);
    }
    // Speaking
    const speaks = plan.speakingPerDay[0] + Math.floor(r() * (plan.speakingPerDay[1] - plan.speakingPerDay[0] + 1));
    for (let i = 0; i < speaks; i++) s = addSpeakingAttempt(s, t0 + (40 + i) * 60_000);
    s = completeLesson(s, t0 + 45 * 60_000);
    if (idx % 3 === 1) s = { ...s, games: { ...s.games, metro: { best: 600 + Math.floor(r() * 900), plays: 1 + Math.floor(idx / 3), lastAt: t0 + 50 * 60_000, bestCombo: 4 + Math.floor(r() * 8) } } };
  });

  // Achievements as the app itself would have unlocked them, stamped at the last study day
  const lastStudy = dayAt(now, studyDays[studyDays.length - 1] ?? 0, 19);
  s = { ...s, achievements: newlyUnlocked(s).map((a) => ({ id: a.id, at: lastStudy })) };
  const next = scenes[chaptersDone];
  s = { ...s, resume: next ? { route: `scene/${next.id}`, label: `${next.titleEs} — ${next.title}`, at: lastStudy } : undefined, meta: { profileAt: s.profile!.createdAt, changedAt: lastStudy } };
  return s;
}

export function buildSam(now: number): AppState {
  return buildStudent({
    seed: 42, name: 'Sam', gender: 'm', city: 'madrid',
    levels: { vocabulary: 'A2', grammar: 'A2', reading: 'A2', listening: 'A1', speaking: 'A1', verbs: 'A2' },
    interests: ['football', 'food', 'music'], startedDaysAgo: 42,
    studyDays: [0, 1, 2, 4, 5, 6, 8, 9, 11, 12, 13, 15, 16, 18, 19, 20, 22, 23, 25, 27, 29, 30, 33, 36, 39],
    minutesPerDay: [12, 28], accuracy: 0.82, verbCount: 24, chapters: 2, weakCategory: 'ser-estar', speakingPerDay: [1, 4], hintsRate: 0.15, dailyMinutes: 15,
    difficulties: ['ser-estar', 'listening'],
  }, now);
}

export function buildAnneka(now: number): AppState {
  return buildStudent({
    seed: 7, name: 'Anneka', gender: 'f', city: 'valencia',
    levels: { vocabulary: 'A1', grammar: 'A1', reading: 'A1', listening: 'A1', speaking: 'A1', verbs: 'A1' },
    interests: ['art', 'nature', 'reading'], startedDaysAgo: 16,
    studyDays: [1, 3, 6, 7, 10, 12, 14],
    minutesPerDay: [6, 14], accuracy: 0.64, verbCount: 10, chapters: 1, weakCategory: 'person-agreement', speakingPerDay: [0, 1], hintsRate: 0.4, dailyMinutes: 10,
    difficulties: ['verbs', 'speaking', 'confidence'],
  }, now);
}

/** Bookings, homework, feedback and activity for the demo workspace. */
export function buildWorkspace(now: number, zone = 'Europe/Madrid'): PlatformData {
  const iso = (t: number) => new Date(t).toISOString();
  const local = (daysFromNow: number, time: string) => {
    const d = new Date(now + daysFromNow * DAY);
    return zonedToUtcIso(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, time, zone);
  };
  const teacherId = DEMO_TEACHER_ID;
  const sam = DEMO_STUDENT_IDS.sam, anneka = DEMO_STUDENT_IDS.anneka;
  const mk = (b: Omit<Booking, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'>, id: string): Booking => ({ ...b, id, teacherId, createdAt: iso(now - 10 * DAY), updatedAt: iso(now - 10 * DAY) });

  const bookings: Booking[] = [
    mk({ studentId: sam, startsAt: local(-6, '18:00'), durationMin: 60, tz: zone, format: 'online', location: 'https://meet.jit.si/learning-with-dina-sam', topic: 'Ser vs estar in conversation', prepNotes: 'Review the apartment chapter; bring 3 sentences about your flat.', status: 'completed' }, 'demo-b1'),
    mk({ studentId: sam, startsAt: local(2, '18:00'), durationMin: 60, tz: zone, format: 'online', location: 'https://meet.jit.si/learning-with-dina-sam', topic: 'Ordering & small talk at the café', prepNotes: 'Sam will have finished the café chapter. Role-play ordering; introduce quedar.', status: 'scheduled' }, 'demo-b2'),
    mk({ studentId: anneka, startsAt: local(-7, '10:30'), durationMin: 45, tz: zone, format: 'in-person', location: 'Café del Centro, Calle Mayor 12 (demo address)', topic: 'First steps: greetings and ser', prepNotes: 'Keep it light — confidence first.', status: 'completed' }, 'demo-b3'),
    mk({ studentId: anneka, startsAt: local(1, '10:30'), durationMin: 45, tz: zone, format: 'in-person', location: 'Café del Centro, Calle Mayor 12 (demo address)', topic: 'Present tense of tener and querer', prepNotes: 'She mixes up person endings — use the metro game as a warm-up.', status: 'scheduled' }, 'demo-b4'),
    mk({ studentId: sam, startsAt: local(9, '18:00'), durationMin: 60, tz: zone, format: 'online', location: 'https://meet.jit.si/learning-with-dina-sam', topic: 'Weekend plans: ir a + infinitive', prepNotes: '', status: 'scheduled' }, 'demo-b5'),
  ];

  const hw = (h: Omit<Homework, 'id' | 'teacherId'>, id: string): Homework => ({ ...h, id, teacherId });
  const homework: Homework[] = [
    hw({ studentId: sam, activity: { kind: 'grammar', title: 'Ser or estar? drill', mode: 'ser-estar', verbs: ['ser', 'estar'] }, instructions: 'Do the ser/estar drill once. Aim for 80%+ and note the sentences you miss.', assignedAt: iso(now - 5 * DAY), dueAt: local(-2, '20:00'), status: 'submitted', result: { completedAt: iso(now - 2 * DAY - 3 * 3_600_000), score: 0.83, attempts: 12, correct: 10, summary: '10/12 correct · 2 ser/estar slips' } }, 'demo-h1'),
    hw({ studentId: sam, activity: { kind: 'story', title: 'Café La Plaza chapter', sceneId: 'cafe' }, instructions: 'Play the café chapter and record yourself ordering (Let me try).', assignedAt: iso(now - 2 * DAY), dueAt: local(3, '20:00'), status: 'assigned' }, 'demo-h2'),
    hw({ studentId: sam, activity: { kind: 'written', title: 'Describe your flat', prompt: 'Escribe 6–8 frases sobre tu piso: dónde está, cómo es y qué te gusta. Usa ser y estar.', minWords: 50 }, instructions: 'Short paragraph in Spanish. Don’t worry about mistakes — I’ll correct them.', assignedAt: iso(now - 6 * DAY), dueAt: local(-3, '20:00'), status: 'reviewed', result: { completedAt: iso(now - 4 * DAY), text: 'Mi piso está en Lavapiés. Es pequeño pero muy luminoso. Tiene dos habitaciones y un balcón. El metro está muy cerca. Me gusta mucho el barrio porque es muy animado. Mi vecina es muy simpática.', summary: '6 sentences · 48 words' }, feedback: { body: '¡Muy bien, Sam! Perfect use of ser (es pequeño, es animado) and estar (está en Lavapiés, está cerca). Next time try adding one sentence with "hay": "Hay muchos bares en mi calle."', at: iso(now - 3 * DAY) } }, 'demo-h3'),
    hw({ studentId: anneka, activity: { kind: 'listening', title: 'Metro Rush: tener, querer, ser', game: 'metro', verbs: ['tener', 'querer', 'ser'] }, instructions: 'Play two rounds. Listen to each form after you tap it.', assignedAt: iso(now - 4 * DAY), dueAt: local(-1, '20:00'), status: 'assigned' }, 'demo-h4'),
    hw({ studentId: anneka, activity: { kind: 'verbs', title: 'Present tense: tener & querer', verbs: ['tener', 'querer'], tense: 'present' }, instructions: 'One verb-gym session focused on these two verbs before our lesson.', assignedAt: iso(now - 1 * DAY), dueAt: local(1, '09:00'), status: 'assigned' }, 'demo-h5'),
  ];

  const fb = (f: Omit<Feedback, 'id' | 'teacherId'>, id: string): Feedback => ({ ...f, id, teacherId });
  const feedback: Feedback[] = [
    fb({ studentId: sam, kind: 'comment', body: 'Great energy in our last lesson — your questions in the café role-play sounded really natural.', createdAt: iso(now - 6 * DAY + 3_600_000) }, 'demo-f1'),
    fb({ studentId: sam, kind: 'correction', body: 'Remember: "estoy cansado" (how you feel) but "soy de Londres" (where you’re from). You said "estoy de Londres" twice.', createdAt: iso(now - 6 * DAY + 3_700_000) }, 'demo-f2'),
    fb({ studentId: sam, kind: 'recommendation', body: 'Before next lesson, 10 minutes of the ser/estar drill on two different days beats one long session.', createdAt: iso(now - 5 * DAY) }, 'demo-f3'),
    fb({ studentId: anneka, kind: 'comment', body: 'Lovely first lesson, Anneka. You already greet people with confidence!', createdAt: iso(now - 7 * DAY + 3_600_000) }, 'demo-f4'),
    fb({ studentId: anneka, kind: 'recommendation', body: 'Try the Metro Rush game for 5 minutes a day — it makes the verb endings automatic.', createdAt: iso(now - 7 * DAY + 3_700_000) }, 'demo-f5'),
  ];

  return { version: 1, people: DEMO_PEOPLE, bookings, homework, feedback, activity: [] };
}

export { addMinutes };
