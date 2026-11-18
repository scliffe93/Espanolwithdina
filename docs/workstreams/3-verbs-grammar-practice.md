# 3. Verbs, grammar and practice

What the student practises on their own: verbs, sentences, words, games and the city stories.

## Built
- Verb gym with a structured front page, full sessions, grid drill, and 335 verbs from A1 to C2 across the tenses.
- Verb families: stem-change groups that change the same way, with a game.
- Growing sentences and "from words to sentences": a 1 to 5 scale the teacher sets per student, so practice moves from single words to longer sentences with linking words.
- Gradual release: the teacher releases verbs and word packs a block at a time, or verb by verb.
- Word packs A1 to C2, memory review, placement to C2, exam practice in the style of the DELE.
- Arcade games picked by level; six city storylines.
- Students see one consistent level on every screen.
- Personal practice: the teacher ticks what a student loves (golf, tennis, classic cars and more) and their sentences, growing sentences and new words come from it.

## Where
`src/screens/Verbs.tsx`, `VerbFamilies.tsx`, `src/data/` (verbs, families, ladders, vocab, blocks, topics), `src/lib/exercises.ts`, `src/lib/platform/level.ts`, `useLevelAccess.ts`, `src/screens/teach/ReleaseBlocks.tsx`, `LevelAccess.tsx`.

## Check
`npx vitest run tests/ladders.test.ts tests/families.test.ts`, then `scripts/verbs-e2e.cjs`, `families-e2e.cjs`, `sentence-e2e.cjs`, `release-e2e.cjs`, `level-shown-e2e.cjs`.

## Open
- The Spanish written for ladders, families and topics needs Dina's proofread.
- Topics only personalise the verb gym and memory cards so far, not grammar drills, games or city stories. A new topic has to be written in `src/data/topics.ts`.
- Banked words from lessons are a list; only those the app already has a card for become flashcards.
