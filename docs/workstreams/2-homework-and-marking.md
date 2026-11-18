# 2. Homework and marking

Setting homework, the student doing it, and the teacher going through it answer by answer.

## Built
- Homework from the app's own exercises, from the teacher's material (PDF, Word, pasted text), or from a lesson's tasks.
- Marking sheet: Right and Wrong buttons on every answer, notes, corrections, and a chip when a wrong answer looks like a slight spelling slip.
- The sheet expands to the whole window and each row opens to full detail.
- Every homework type explains itself when reviewed: what was asked, the original sentence for fix-the-mistake, build-a-sentence and fill-the-gap, and what was paired in matching.
- Lesson debrief feeding an adaptive weekly plan; writing sent to the teacher; Sunday recap.

## Where
`src/screens/teach/HomeworkReview.tsx`, `src/screens/student/`, `src/lib/exercises.ts`, `src/lib/material.ts`, `src/lib/platform/plan.ts`, `supabase/functions/_shared/adapt.ts`.

## Check
`npx vitest run tests/spelling-slip.test.ts tests/lesson-homework.test.ts`, then `scripts/marking-e2e.cjs` and `scripts/material-e2e.cjs`.

## Open
- Dina's view on the Right/Wrong flow after using it on real homework.
