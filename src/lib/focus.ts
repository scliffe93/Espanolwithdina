import type { AppState, ErrorCategory, Region } from '../types';
import { TENSE_BY_ID, VERB_BY_INF, type Tense } from '../data/verbs';
import { allVerbMastery, consistency, deckHealth, errorBreakdown, skillBreakdown, tenseMastery } from './analytics';

// ───────────────────────────────────────────────────────────────
// "What to concentrate on": the learner's own results turned into
// plain sentences. For each area it says what is happening (with
// their numbers and their own mistakes), why it happens, how to fix
// it step by step, what to practise in the app and what to ask in
// the next lesson. Everything is worked out on the device from what
// they have actually done; nothing is invented.
// ───────────────────────────────────────────────────────────────

export interface FocusArea {
  id: string;
  title: string;
  /** One sentence with their numbers. */
  summary: string;
  /** Their own slips: what they wrote and what it should have been. */
  examples: { wrong: string; right: string; note?: string }[];
  /** Why this happens: the rule, in two or three sentences. */
  explain: string;
  /** How to improve, in order. */
  steps: string[];
  /** Something to say or ask in the next lesson. */
  ask: string;
  practise?: { label: string; href: string };
  /** Is it getting better or worse compared with the four weeks before. */
  trend?: 'better' | 'worse' | 'same';
  /** Higher = more important. Used for ordering only. */
  weight: number;
}

const GUIDE: Record<ErrorCategory, { title: string; explain: string; steps: string[]; ask: string; practise?: { label: string; href: string } }> = {
  'person-agreement': {
    title: 'Matching the verb ending to the person',
    explain: 'In Spanish the ending of the verb says who is doing the action, so the pronoun is usually dropped. That makes the ending the important part: "hablo" is I, "hablas" is you, "habla" is he or she. When the ending belongs to a different person, the sentence says someone else did it.',
    steps: [
      'Before you answer, say who it is about out loud, then the verb: "nosotros… hablamos".',
      'Learn the endings as one line you can recite: -o, -as, -a, -amos, -áis, -an (and -o, -es, -e, -emos, -éis, -en).',
      'Do the Match exercises first in a session: they train exactly this link between person and ending.',
      'When you get one wrong, say the whole correct sentence aloud twice before moving on.',
    ],
    ask: 'Ask Dina to fire quick questions at you where only the person changes: "¿Y tú? ¿Y ellos?" It is the fastest way to make the endings automatic.',
    practise: { label: 'Practise verb endings', href: 'verbs?start=1&tense=present' },
  },
  accents: {
    title: 'Written accents',
    explain: 'An accent mark shows where the stress falls, and it can change the meaning or the tense: "hablo" is I speak, "habló" is he spoke; "esta" is this, "está" is is. Your answers were right apart from the accent, which means you know the word and only the writing habit is missing.',
    steps: [
      'Say the word aloud and notice which syllable is loudest. If it breaks the normal pattern, it needs an accent.',
      'Remember the two big groups: past tense for he/she and I (habló, comí, vivió) and the future (hablaré, comerás) nearly always carry one.',
      'On a phone, hold the vowel down to get á é í ó ú. The accent buttons under the answer box do the same.',
      'Read your answer once more before you tap Check and look only at the vowels.',
    ],
    ask: 'Ask Dina for a one-minute dictation of ten short words with and without accents, so you hear the difference.',
    practise: { label: 'Practise the preterite (lots of accents)', href: 'verbs?start=1&tense=preterite' },
  },
  'stem-change': {
    title: 'Stem-changing verbs',
    explain: 'Some verbs change the vowel in the middle when that vowel is stressed: e becomes ie (querer, quiero), o becomes ue (poder, puedo), e becomes i (pedir, pido). The change happens for yo, tú, él and ellos. It does not happen for nosotros and vosotros, because the stress moves to the ending there: queremos, podemos.',
    steps: [
      'Picture a boot drawn round yo, tú, él and ellos in the verb table. Inside the boot the vowel changes; outside it does not.',
      'Learn these verbs in pairs that show both sides: "quiero, queremos", "puedo, podemos", "pido, pedimos".',
      'Group them by type and practise one group at a time, not all mixed.',
      'When you meet a new verb, check its group on its card in the verb gym before you practise it.',
    ],
    ask: 'Ask Dina which stem-changing verbs you will need most for what you talk about, and practise those in conversation.',
    practise: { label: 'Practise stem-changing verbs', href: 'verbs?focus=querer,poder,pedir,pensar,dormir,volver&start=1' },
  },
  'irregular-yo': {
    title: 'Irregular "yo" forms',
    explain: 'A group of very common verbs is regular everywhere except the "I" form: tengo, hago, pongo, salgo, digo, vengo, traigo, oigo, and also sé, doy, veo, conozco. Because you use "I" more than any other person when you speak, these come up all the time.',
    steps: [
      'Learn the "-go" family as a chant: tengo, vengo, hago, pongo, salgo, digo, traigo, oigo.',
      'Make one true sentence about yourself with each: "Salgo de casa a las ocho."',
      'In the verb gym, add these verbs to your focus and do a session of typed answers.',
      'Notice that the rest of each verb is normal: only "yo" needs learning.',
    ],
    ask: 'Ask Dina to interview you about your day in the present tense. Nearly every answer starts with one of these forms.',
    practise: { label: 'Practise irregular "yo" verbs', href: 'verbs?focus=tener,hacer,poner,salir,decir,venir&start=1' },
  },
  'irregular-verb': {
    title: 'Irregular verbs',
    explain: 'The verbs used most are the irregular ones (ser, estar, ir, tener, hacer), because everyday use wore them into odd shapes. They cannot be worked out from a rule, so they have to be met often. The good news is that there are few of them and you will use them in every conversation.',
    steps: [
      'Take two or three verbs a week, not ten. Choose the ones in your slips below.',
      'Short and often beats long and rare: three minutes a day on the same few verbs.',
      'Say the six forms aloud in order once, then test yourself out of order.',
      'Use "Help me remember" on the ones that will not stick and write your own clue.',
    ],
    ask: 'Tell Dina which two verbs keep tripping you up and ask her to build the lesson conversation around them.',
    practise: { label: 'Practise your weakest verbs', href: 'verbs?start=1' },
  },
  'ser-estar': {
    title: 'Ser or estar',
    explain: 'Both mean "to be". Ser says what something is: identity, origin, job, character, time, and where an event takes place. Estar says how or where something is right now: location, mood, a state that can change. "Es aburrido" means he is boring; "está aburrido" means he is bored.',
    steps: [
      'Ask one question each time: am I saying what it is, or how or where it is at the moment?',
      'Learn the classic traps: location is estar ("está en Madrid"), but an event is ser ("la fiesta es en casa").',
      'Learn a few adjective pairs that change meaning: ser listo (clever) and estar listo (ready).',
      'Do the "Ser or estar" drill and read the reason after every answer, right or wrong.',
    ],
    ask: 'Ask Dina to describe a photo with you: who the people are (ser) and how and where they are (estar).',
    practise: { label: 'Do the ser or estar drill', href: 'verbs?mode=ser-estar' },
  },
  register: {
    title: 'Tú or usted',
    explain: 'Spanish has a friendly "you" (tú) and a respectful one (usted), and the verb changes with it: "¿Cómo estás?" and "¿Cómo está usted?". Usted takes the same verb form as he or she.',
    steps: [
      'Default to usted with older people, officials and strangers, and switch when they say "tutéame".',
      'Remember usted uses the él/ella form of the verb.',
      'Replay a story chapter and notice which form each character uses with whom.',
    ],
    ask: 'Ask Dina who she would use usted with in the country you are learning for. It varies a lot between Spain and Latin America.',
  },
  vocabulary: {
    title: 'Remembering words',
    explain: 'Words are forgotten on a curve: quickly at first, then more slowly each time you bring them back. A word needs to be recalled several times over days, not read many times in one sitting. The Memory page schedules those recalls for you.',
    steps: [
      'Do your Memory reviews before anything else. Two minutes a day is enough.',
      'When a word will not stick, use "Help me remember" and write a clue that is personal or silly.',
      'Say the word in a sentence about your own life as soon as you learn it.',
      'Learn words in sets that belong together (a café, the doctor) so they call each other up.',
    ],
    ask: 'Bring Dina the five words you keep missing and ask her to use them in the lesson so you hear them in real sentences.',
    practise: { label: 'Review your words', href: 'review' },
  },
  spelling: {
    title: 'Spelling slips',
    explain: 'These are answers where you knew the form and a letter went astray. Most are in the last two letters, typed in a hurry. They matter because in Spanish one letter in the ending can change who did it or when.',
    steps: [
      'Slow down for the final syllable and read it back before you tap Check.',
      'Watch the usual pairs: b and v, c and qu (busco, busqué), g and gu (pago, pagué), z and c (empiezo, empecé).',
      'Say the word as you type it. Spanish is spelled the way it sounds, so your ear will catch most slips.',
    ],
    ask: 'Ask Dina about the spelling changes in the past tense (-car, -gar, -zar verbs): one short explanation clears up a lot of these.',
  },
  auxiliary: {
    title: 'The helper verb: estar or haber',
    explain: 'Two-word tenses need the right helper. "I am speaking" uses estar with the -ando/-iendo form: estoy hablando. "I have spoken" uses haber with the -ado/-ido form: he hablado. The helper carries the tense and the person; the second word never changes.',
    steps: [
      'Learn the two helpers as their own little verbs: estoy, estás, está… and he, has, ha, hemos, habéis, han.',
      'Fix the pairing in your head: estar goes with -ando, haber goes with -ado.',
      'For each later tense, only haber changes: había hablado, habré hablado, habría hablado.',
    ],
    ask: 'Ask Dina to contrast three sentences about the same action: hablo, estoy hablando, he hablado.',
    practise: { label: 'Practise the present perfect', href: 'verbs?start=1&tense=perfect' },
  },
  voseo: {
    title: 'Vos forms',
    explain: 'In Argentina and Uruguay "vos" replaces "tú". The stress moves to the ending and the stem does not change: tú quieres becomes vos querés, tú puedes becomes vos podés, tú eres becomes vos sos.',
    steps: [
      'Take the infinitive, drop the r and add s with an accent: hablar, hablás; comer, comés; vivir, vivís.',
      'Remember there is no stem change with vos: podés, querés, tenés.',
      'Learn the one odd one: sos.',
    ],
    ask: 'Ask Dina to speak to you with vos for the whole lesson, and answer her the same way.',
  },
  other: {
    title: 'Sentence building',
    explain: 'These are slips in how the sentence is put together: word order, a missing "no", a small word in the wrong place. Spanish usually drops the subject pronoun and puts "no" directly before the verb.',
    steps: [
      'Read the model sentence aloud twice after a mistake, then cover it and say it from memory.',
      'In Build the sentence, find the verb first, then put "no" or the pronoun straight before it.',
      'Copy three model sentences a day into a notebook, changing one word to make them true for you.',
    ],
    ask: 'Ask Dina to give you sentences to turn negative and into questions. That practises word order directly.',
  },
};

export const TENSE_USE: Record<Tense, string> = {
  present: 'It covers what you do, what is true and what is happening around now.',
  progressive: 'It is for what is happening at this very moment: estoy comiendo.',
  perfect: 'It links the past to now: what you have done today, this week or ever.',
  preterite: 'It is for finished actions at a definite time: ayer comí, el año pasado fui.',
  imperfect: 'It describes how things used to be or what was going on in the background: cuando era niño, hacía sol.',
  imperative: 'It is how you tell or ask someone to do something: ven, espera, pase.',
  future: 'It says what will happen, and also makes a guess about now: ¿dónde estará?',
  conditional: 'It says what would happen and makes requests polite: me gustaría, ¿podrías…?',
  subjunctive: 'It follows wishes, doubts, feelings and "que" after another person: quiero que vengas.',
  pluperfect: 'It is the past before the past: what had already happened when something else did.',
  'negative-imperative': 'It tells someone not to do something, and uses the subjunctive form: no hables.',
  'imperfect-subjunctive': 'It is the subjunctive in the past and in "if" sentences: si tuviera tiempo…',
  'perfect-subjunctive': 'It is a wish or doubt about something that has already happened: espero que hayas llegado.',
  'pluperfect-subjunctive': 'It is for what might have been: si hubiera sabido…',
  'conditional-perfect': 'It says what would have happened: habría ido.',
  'future-perfect': 'It says what will have happened by a certain time: habré terminado.',
};

const verbOf = (context: string) => { const v = context.split('·').pop()?.trim() ?? ''; return VERB_BY_INF[v] ? v : ''; };

/** The areas this learner most needs to work on, most important first. An empty list means there is not enough practice to say yet. */
export function focusAreas(state: AppState, now = Date.now(), limit = 5, minCount = 2): FocusArea[] {
  const region: Region = state.profile?.region ?? 'spain';
  const since = now - 28 * 86_400_000;
  const areas: FocusArea[] = [];

  // 1. The kinds of mistake they make most, with their own examples.
  const recent = Object.values(state.days).flatMap((d) => d.mistakes).filter((m) => m.at >= since);
  for (const e of errorBreakdown(state, 28, now)) {
    if (e.count < minCount) continue;
    const g = GUIDE[e.category];
    const mine = recent.filter((m) => m.category === e.category);
    const seen = new Set<string>();
    const examples = mine.filter((m) => m.expected && m.given && m.given !== '(too slow)' && m.given.trim() !== m.expected.trim() && !seen.has(m.expected) && seen.add(m.expected)).slice(-4).reverse().map((m) => ({ wrong: m.given, right: m.expected, note: verbOf(m.context) || undefined }));
    const verbs = [...new Set(mine.map((m) => verbOf(m.context)).filter(Boolean))].slice(0, 4);
    const trend = e.previous === 0 ? undefined : e.count < e.previous * 0.8 ? 'better' : e.count > e.previous * 1.2 ? 'worse' : 'same';
    const tail = trend === 'better' ? `, down from ${e.previous} the month before, so it is improving` : trend === 'worse' ? `, up from ${e.previous} the month before` : '';
    areas.push({
      id: `err-${e.category}`, title: g.title, trend,
      summary: `This came up ${e.count} times in the last four weeks${tail}${verbs.length ? `. It shows most with ${verbs.join(', ')}` : ''}.`,
      examples, explain: g.explain, steps: g.steps, ask: g.ask,
      practise: verbs.length >= 2 && e.category !== 'ser-estar' && e.category !== 'vocabulary' ? { label: `Practise ${verbs.slice(0, 3).join(', ')}`, href: `verbs?focus=${verbs.join(',')}&start=1` } : g.practise,
      weight: e.count * (trend === 'better' ? 0.8 : trend === 'worse' ? 1.3 : 1) * (e.category === 'other' ? 0.5 : 1),
    });
  }

  // 2. The tense they are least sure of.
  const weakTense = tenseMastery(state, region).filter((t) => t.attempts >= 8 && t.accuracy !== null && t.accuracy < 0.72).sort((a, b) => a.accuracy! - b.accuracy!)[0];
  if (weakTense) {
    const weakVerbs = allVerbMastery(state, weakTense.id, region).filter((m) => m.attempts >= 2 && m.accuracy !== null).sort((a, b) => a.accuracy! - b.accuracy!).slice(0, 4);
    const pct = Math.round(weakTense.accuracy! * 100);
    areas.push({
      id: `tense-${weakTense.id}`, title: `The ${weakTense.label.toLowerCase()} (${TENSE_BY_ID[weakTense.id].es.toLowerCase()})`,
      summary: `You get ${pct}% right in this tense over ${weakTense.attempts} answers, lower than your other tenses${weakVerbs.length ? `. The verbs costing you most are ${weakVerbs.map((v) => v.inf).join(', ')}` : ''}.`,
      examples: [],
      explain: `${TENSE_USE[weakTense.id]} A tense feels hard for two different reasons: not being sure when to use it, and not being sure how to form it. Work out which one it is for you, because the fix is different.`,
      steps: [
        'Open one verb in the verb gym, choose this tense and read all six forms aloud. Look for the pattern in the endings.',
        `Do one session on this tense only, on the verbs above, with typed answers.`,
        'After each mistake, say the whole correct form with its pronoun twice.',
        'Then write three true sentences of your own in this tense. Using it for something real is what makes it stay.',
      ],
      ask: `Tell Dina the ${weakTense.label.toLowerCase()} is your weakest tense and ask whether your problem is choosing it or forming it. Ask for a short story or questions that need it.`,
      practise: { label: `Practise the ${weakTense.label.toLowerCase()}`, href: `verbs?${weakVerbs.length >= 2 ? `focus=${weakVerbs.map((v) => v.inf).join(',')}&` : ''}tense=${weakTense.id}&start=1` },
      weight: (0.75 - weakTense.accuracy!) * 40 + 3,
    });
  }

  // 3. Recognising a form but not producing it, and listening.
  const skills = skillBreakdown(state, 6);
  const by = (t: string) => skills.find((s) => s.type === t);
  const typed = by('type'), chosen = by('choice') ?? by('choose'), heard = by('listen');
  if (typed && chosen && chosen.accuracy - typed.accuracy >= 0.2) {
    areas.push({
      id: 'skill-recall', title: 'Producing the form, not just recognising it',
      summary: `You pick the right form ${Math.round(chosen.accuracy * 100)}% of the time when you see the options, but type it correctly ${Math.round(typed.accuracy * 100)}% of the time.`,
      examples: [],
      explain: 'Recognising a form and producing it are two different skills. Multiple choice trains the first; speaking and writing need the second. A gap between them is normal and it closes with practice where nothing is shown to you.',
      steps: [
        'Before you look at the options in a choice question, say your own answer first.',
        'Use the microphone or type the answer in the "Conjugate" questions and do not skip them.',
        'Cover the table on a verb card and recite the six forms from memory.',
        'Use "Help me remember" only after you have tried: the effort of trying is what builds recall.',
      ],
      ask: 'Ask Dina for more speaking time and fewer written exercises in the lesson: you already recognise the forms.',
      practise: { label: 'Start a session', href: 'verbs?start=1' },
      weight: (chosen.accuracy - typed.accuracy) * 30,
    });
  }
  if (heard && typed && heard.attempts >= 8 && heard.accuracy < 0.7 && heard.accuracy + 0.12 < Math.max(typed.accuracy, chosen?.accuracy ?? 0)) {
    areas.push({
      id: 'skill-listening', title: 'Hearing the difference between forms',
      summary: `In listening questions you get ${Math.round(heard.accuracy * 100)}% right, lower than when you read the same forms.`,
      examples: [],
      explain: 'Spanish endings are short and unstressed, so "habla", "hablan" and "hablas" can sound alike at speed. Your eyes know the forms; your ears need more time with them.',
      steps: [
        'Use the "Slower" button first, then listen again at normal speed.',
        'Repeat what you hear aloud before you choose. Saying it makes the ending clearer.',
        'On a verb card, tap each form to hear it and listen for the last sound only.',
        'Replay a story chapter with the translations hidden.',
      ],
      ask: 'Ask Dina to say pairs of sentences that differ only in the ending and tell her which one you heard.',
      practise: { label: 'Start a session', href: 'verbs?start=1' },
      weight: (0.75 - heard.accuracy) * 25,
    });
  }

  // 4. Habits: how often, reviews waiting, speaking.
  const c = consistency(state, 14, now);
  const everStudied = Object.values(state.days).some((d) => d.activeSeconds >= 60);
  if (everStudied && c.studyDays <= 3) {
    areas.push({
      id: 'habit-regular', title: 'Little and often',
      summary: `You practised on ${c.studyDays} of the last 14 days${c.minutes ? `, ${c.minutes} minutes in all` : ''}.`,
      examples: [],
      explain: 'Memory for a language fades between sessions, and a long gap means each session starts by relearning. Five minutes on most days keeps more than an hour once a week, because every return visit strengthens what is there.',
      steps: [
        'Pick one fixed moment in your day (the kettle, the bus) and tie five minutes of practice to it.',
        'Turn on the daily reminder under Notifications so the phone asks you at that time.',
        'On a busy day, do only your Memory reviews: two minutes still counts.',
      ],
      ask: 'Tell Dina honestly how much time you have each week. She can set homework that fits it.',
      practise: { label: 'Do five minutes now', href: 'verbs?start=1' },
      weight: (4 - c.studyDays) * 2.5,
    });
  }
  const deck = deckHealth(state, now);
  if (deck.overdue >= 8) {
    areas.push({
      id: 'habit-reviews', title: 'Words waiting to be reviewed',
      summary: `${deck.overdue} of your words are overdue for review.`,
      examples: [],
      explain: 'Each word is scheduled to come back just before you would forget it. When reviews pile up, words slip past that moment and have to be learned again.',
      steps: ['Clear the oldest reviews first, a few minutes at a time.', 'Do reviews before you learn anything new until the pile is gone.', 'After that, a couple of minutes a day keeps it at zero.'],
      ask: 'Ask Dina to recycle last month’s vocabulary in the lesson while you catch up.',
      practise: { label: 'Review now', href: 'review' },
      weight: Math.min(8, deck.overdue / 4),
    });
  }
  const spoken = Object.values(state.days).filter((d) => d.date >= new Date(now - 14 * 86_400_000).toISOString().slice(0, 10)).reduce((a, d) => a + d.speakingAttempts, 0);
  if (everStudied && c.studyDays >= 3 && spoken === 0) {
    areas.push({
      id: 'habit-speaking', title: 'Saying it out loud',
      summary: 'You have practised regularly but not spoken any answers in the last two weeks.',
      examples: [],
      explain: 'Knowing a form silently and being able to say it in conversation are different. Speaking needs the mouth and the ear to practise too, and it is what a lesson asks of you most.',
      steps: ['Tap the microphone on typed questions and say the answer.', 'Read every correct answer aloud once before you tap Continue.', 'In story chapters, answer by voice where you can.'],
      ask: 'Ask Dina to start the lesson with two minutes of quick spoken questions, before any explaining.',
      practise: { label: 'Start a session', href: 'verbs?start=1' },
      weight: 3,
    });
  }

  return areas.sort((a, b) => b.weight - a.weight).slice(0, limit);
}

/** Two or three sentences a learner can read before a lesson: what to tell the teacher. */
export function lessonPrep(areas: FocusArea[]): string {
  if (!areas.length) return '';
  const names = areas.slice(0, 3).map((a) => a.title.charAt(0).toLowerCase() + a.title.slice(1));
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Going into your next lesson, the ${names.length === 1 ? 'thing' : 'things'} to mention ${names.length === 1 ? 'is' : 'are'} ${list}.`;
}
