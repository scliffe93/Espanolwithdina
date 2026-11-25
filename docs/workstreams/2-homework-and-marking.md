# 2. Homework and marking

Setting homework, the student doing it, and the teacher going through it answer by answer.

## Built
- Homework from the app's own exercises, from the teacher's material (PDF, Word, pasted text), or from a lesson's tasks.
- Marking sheet: Right and Wrong buttons on every answer, notes, corrections, and a chip when a wrong answer looks like a slight spelling slip.
- The sheet expands to the whole window and each row opens to full detail.
- Every homework type explains itself when reviewed: what was asked, the original sentence for fix-the-mistake, build-a-sentence and fill-the-gap, and what was paired in matching.
- Assign homework opens on two choices: the teacher's own homework (her PDFs, photos, Word and other files) or an activity from the list.
- Own homework: files marked as learning (an explanation) or questions (the work). The student reads them in the page (PDF, photos, Word and text are drawn; PowerPoint, Excel and old .doc are download only), types answers and hands in; it is marked like written homework. Learning with no questions has no deadline.
- Every file has a Download button. The teacher can also upload straight into a bank from the student page.
- Learning bank: every explanation shared with a student stays at `student/learning`, and on the teacher's student page under Homework, until the teacher removes it.
- Files live in a private Supabase Storage bucket (`lwd-files`); the Edge Function signs short-lived links. In the demo they stay on the device.
- Sheets are sized to the visible window and stop short of the bottom edge.
- Homework lists run by when it was handed in, latest first, and each item is named after the student's lesson nearest to that date ("Homework for lesson 5"); until handed in, the lesson nearest to when it was set (`lessonFor` in `src/lib/platform/homework.ts`).
- Lesson debrief feeding an adaptive weekly plan; writing sent to the teacher; Sunday recap.

## Where
`src/screens/teach/HomeworkReview.tsx`, `src/screens/teach/HomeworkAssignForm.tsx`, `src/components/Files.tsx`, `src/screens/student/Learning.tsx`, `src/screens/student/`, `src/lib/exercises.ts`, `src/lib/material.ts`, `src/lib/platform/plan.ts`, `supabase/functions/_shared/adapt.ts`.

## Check
`npx vitest run tests/spelling-slip.test.ts tests/lesson-homework.test.ts tests/files-api.test.ts`, then `scripts/marking-e2e.cjs`, `scripts/material-e2e.cjs` and `scripts/own-homework-e2e.cjs`.

## Open
- The file backend was deployed on 25 Nov 2026 (function v29, bucket `lwd-files`). The new routes answer correctly for a student. A teacher's real upload has not been watched yet: the signed-link calls to Storage in `supabase/functions/account/index.ts` first run when Dina uploads a file.
- Fixed in code on 25 Nov 2026, **not yet deployed**: a student opening a file on the live site was told "That file is not available". The live database stores each row as a JSON string, so the check for "does this student's homework or learning bank point at this file" never matched (`fileRefs` in `account-core.ts`). The same fault would have removed a file still in use when another record pointing at it was deleted. Needs a backend deploy.
- Files left behind when an upload is abandoned, or when a student account is deleted, are not cleaned up.
- Dina's view on the Right/Wrong flow after using it on real homework.
