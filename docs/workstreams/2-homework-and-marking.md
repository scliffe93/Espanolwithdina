# 2. Homework and marking

Setting homework, the student doing it, and the teacher going through it answer by answer.

## Built
- Homework from the app's own exercises, from the teacher's material (PDF, Word, pasted text), or from a lesson's tasks.
- Marking sheet: Right and Wrong buttons on every answer, notes, corrections, and a chip when a wrong answer looks like a slight spelling slip.
- The sheet expands to the whole window and each row opens to full detail.
- Every homework type explains itself when reviewed: what was asked, the original sentence for fix-the-mistake, build-a-sentence and fill-the-gap, and what was paired in matching.
- Assign homework opens on two choices: the teacher's own homework (her PDFs or photos) or an activity from the list.
- Own homework: files marked as learning (an explanation) or questions (the work). The student reads them in the page, types answers and hands in; it is marked like written homework. Learning with no questions has no deadline.
- Learning bank: every explanation shared with a student stays at `student/learning`, and on the teacher's student page under Homework, until the teacher removes it.
- Files live in a private Supabase Storage bucket (`lwd-files`); the Edge Function signs short-lived links. In the demo they stay on the device.
- Sheets are sized to the visible window and stop short of the bottom edge.
- Lesson debrief feeding an adaptive weekly plan; writing sent to the teacher; Sunday recap.

## Where
`src/screens/teach/HomeworkReview.tsx`, `src/screens/teach/HomeworkAssignForm.tsx`, `src/components/Files.tsx`, `src/screens/student/Learning.tsx`, `src/screens/student/`, `src/lib/exercises.ts`, `src/lib/material.ts`, `src/lib/platform/plan.ts`, `supabase/functions/_shared/adapt.ts`.

## Check
`npx vitest run tests/spelling-slip.test.ts tests/lesson-homework.test.ts tests/files-api.test.ts`, then `scripts/marking-e2e.cjs`, `scripts/material-e2e.cjs` and `scripts/own-homework-e2e.cjs`.

## Open
- File uploads need the backend deployed (migration `20261119000000_lwd_files.sql` and the function). Until then real accounts get an error on upload. The Storage calls in `supabase/functions/account/index.ts` have not run against the live project yet: upload one PDF and open it as a student after deploying.
- Files left behind when an upload is abandoned, or when a student account is deleted, are not cleaned up.
- Dina's view on the Right/Wrong flow after using it on real homework.
