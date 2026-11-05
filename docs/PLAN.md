# VIVA — Product, design & architecture

## 1. Product

**Promise:** Learning Spanish should feel like building a new life abroad, not doing homework.
**For:** adults relocating (or dreaming of it) who want to speak naturally, build relationships and reach fluency.

### Principles → how they show up
| Principle | Implementation |
|---|---|
| Immersion before dashboards | The default screen is the living map of Madrid. Stats sit one tab away. |
| Personalisation changes content | Interests drive Marta's invitations, dating unlocks a branch, region changes vocabulary, *vosotros* and voice, gender changes agreement, preferred activities tilt the exercise mix, measured recall reorders memory aids, and difficulties raise coach priorities. |
| Verbs + real conversation | Every chapter ends by pointing to its verbs. Dialogue errors and drill errors share one taxonomy. |
| Motivation rewards real progress | No points. Rewards come from unlocking places, relationships, mastery, delayed recall and consistency. |
| Accurate teacher reporting | Reports read the same per-day records the app writes. Nothing is estimated except the clearly labelled speaking level. |
| No false AI claims | The coach is rules-based and shows its evidence. A `CoachProvider` interface marks where an opt-in AI provider could plug in later. |

### User journey (first session)
Welcome → VIVA Discover (14 questions with Lucía) → level (zero / CEFR / placement) → My Spanish DNA → **Land in Madrid**: *La llegada* chapter → completion (relationships, words added to the deck) → practise the chapter's verbs → map shows *El piso nuevo* unlocked → progress saved automatically.

### Curriculum
- **A1:** ser/estar, greetings, register (tú/usted), the present tense of 41 core verbs (regular, stem-changing, irregular *yo*, irregular), gustar, ir a + infinitive, ordering, directions.
- **A2:** present progressive and present perfect (already in the verb gym), quedar and making plans, *acabar de*.
- **Roadmap:** preterite, imperfect, future, conditional, imperative, present and past subjunctive, compound tenses, plus new chapters (market, gym, office, health centre, tapas bar) and new regions (Argentina, Colombia).

## 2. Design system
- **Mood:** contemporary Mediterranean — sun-warmed plaster, terracotta, saffron, olive and azulejo blue on cream. Adult and editorial, never childish.
- **Type:** *Fraunces* (display serif, optical sizing) with *Inter* (UI). Both are self-hosted, so they work offline and need no third-party requests.
- **Tokens:** `tailwind.config.js` (colours, radii, shadows) and component classes in `src/index.css` (`btn-*`, `card`, `chip`, `ctrl`, `input`, `eyebrow`).
- **Characters:** one parametric SVG component (`Character.tsx`) with skin, hair style, clothing and accessories. It has natural irregular blinking, breathing, syllable-like mouth movement while the voice speaks, head nods and tilts, and wave and thinking gestures.
- **Motion:** Motion for transitions and micro-interactions. `prefers-reduced-motion` turns off ambient animation, and CSS caps all durations.
- **Charts:** single-hue magnitude bars with recessive grids, hover tooltips and hidden data tables. Status is never shown by colour alone: icons and text always accompany it. Terracotta and olive aren't distinguishable under protanopia, which was checked with a palette validator.
- **Accessibility:** semantic roles (radio, checkbox, dialog, progressbar), visible focus rings, a skip link, labelled icon buttons and `lang="es"` on Spanish inputs.

## 3. Architecture

```
src/
  types.ts              domain model (AppState persisted as one document)
  data/                 verbs (41), vocab (+regional variants), story (3 scenes), assessment, profile options
  lib/
    state.ts            pure reducers: recordAttempt, addToDeck, completeScene, applyTechnique…
    srs.ts              SM-2-style scheduler + mastery levels
    answer.ts           normalisation, accent-tolerant checking, error diagnosis taxonomy
    exercises.ts        adaptive session builder (9 exercise types) + ser/estar bank
    analytics.ts        week summaries, verb mastery, streaks
    timeTracker.ts      pure active-time rules (unit-tested)
    coach.ts            rules-based CoachProvider
    achievements.ts, challenges.ts
    report.ts           teacher report model, email text, RFC 6068 mailto
    pdf.ts              jsPDF report with vector charts (lazy-loaded)
    db.ts               IndexedDB (idb): state + audio blobs, export/import/wipe
    speech.ts           speech synthesis (voice picking per region) + recognition
    store.tsx           React context, debounced persistence, achievement detection, active timer
    template.ts         {name} / {g:masc|fem} dialogue templating
  components/           Character, SceneBackdrop, SpeakControls, HelpMeRemember, BarChart, UI kit
  screens/              Onboarding, Level/Assessment, Profile (DNA + data), World, ScenePlayer,
                        Verbs, Review, Progress, Recap, Teacher, Privacy
```

**Extension points**
- **Cloud sync:** everything is one serialisable `AppState` plus keyed audio blobs (`db.ts`). A sync adapter can wrap `loadState` and `saveState`.
- **AI:** implement `CoachProvider` (`lib/coach.ts`); conversation partners could sit behind the same scene-node interface. All of this would be opt-in.
- **Content:** scenes are data (`data/story.ts`). New tenses are a `conjugate()` branch plus validated forms.

## 3b. Cities & arcade (v0.2)
- `src/data/cityThemes.ts` — six city identities (palette → CSS variables consumed by Tailwind tokens, skyline landmarks, map geography, transit style, local menu). `applyCityTheme()` re-themes the whole app live.
- `src/data/cities/*.ts` — one self-registering story file per city (3 chapters each), validated by `tests/stories.test.ts` (graph reachability, cast, vocab, error-choice feedback, placeholders).
- Varieties: `spain | mexico | argentina | colombia`. Voseo is generated (`voseo()` in `verbs.ts`) and unit-tested; `conjugate()` defaults to the learner's active variety.
- `src/screens/games/` — GameShell (intro, countdown, HUD, pause, end screen, personal bests) + Metro Rush, Order Up!, ¿Sí o no?, Ser o Estar. All answers go through `recordAttempt` so games feed mastery, mistakes and spaced repetition. Swipe "wrong" cards are only unambiguous errors; ser/estar items with a valid alternative reading are flagged `ambiguous`.
- `src/lib/fx.ts` — Web Audio sound effects, canvas confetti, haptics (toggle in settings; reduced-motion respected).

## 4. Testing
- `npm test` runs 16 unit tests. They cover verb integrity (regular verbs match the paradigm, stem-changers keep the boot shape, every example's blank equals its conjugation), answer checking, error diagnosis, SRS intervals, assessment scoring, active-time rules and templating.
- `scripts/e2e.cjs` drives the full journey in Chromium: onboarding, placement, all 3 chapters (including deliberate mistakes), a verb session, a review, progress, teacher mailto and PDF download, a reload to confirm persistence, and mobile layouts with an overflow check. It also asserts there are no page or console errors.
- An independent native-level review of all Spanish content was carried out, and its 16 corrections were applied.
