# 1. Lesson room

Plan a lesson, teach it live on a shared screen, and give the student something to keep afterwards.

## Built
- Plans made by hand, or from an uploaded PDF, Word file or pasted text. The builder turns a classroom plan into timed stages with interactive parts; the teacher reviews before it is ready.
- A library of plans filed by level, with topics and a "pending review" status. Plans belong to no student until taught.
- Teaching: choose who (one student, several, or a named group) and the wording (English, both, Spanish) each time.
- Present view: coloured parts, lesson clock, full screen, arrow keys, private teacher notes, whiteboard.
- Group lessons: everyone answers, and the teacher is told when all are in.
- Student side: follows the teacher's part, own notes, lesson notes to revisit.
- Ending a lesson: summary and whiteboard published to the student's Feedback; words and verbs used are offered and released only when ticked.
- Tasks from a lesson can be sent as homework. A Word template explains the plan format.

## Where
`src/screens/room/` (TeacherRoom, StudentRoom, Blocks, Whiteboard, useLesson), `src/lib/platform/lessonAdapt.ts`, `lessonExtras.ts`, `lessonImport.ts`, `lessonHomework.ts`, `src/lib/pdfLayout.ts`, `src/lib/extractText.ts`, `supabase/functions/_shared/lesson.ts`, `public/guides/lesson-plan-template.docx`.

## Check
`npx vitest run tests/lesson-*.test.ts`, then the browser scripts `scripts/room-e2e.cjs`, `room-demo-e2e.cjs`, `library-e2e.cjs`, `library-cloud-e2e.cjs`, `group-e2e.cjs`, `extras-e2e.cjs`.

## Open
- Not yet tried in a real lesson over Zoom, on an iPad, or with a pen.
- Confirm a student can join a lesson on the live site since the join fix.
- The builder is rule-based and suits plans shaped like the sample; other layouts need more review.
- Group lessons suit about six or fewer. The whiteboard holds about 250 strokes.
- Spanish instruction phrases need Dina's proofread.
