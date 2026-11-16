# Learning with Dina — teaching platform

A teacher dashboard for Dina and individual dashboards for her students, built into the existing app. It runs in two modes:

- **Real accounts** (once Supabase is configured as in `docs/ACCOUNTS.md`): Dina logs in with her own account and is the teacher; every other account is her student. Lessons, homework, feedback and activity are saved on the server and appear on every device each person logs in on.
- **Demonstration** (always available, no server): Dina, Sam and Anneka with sample data in this browser's IndexedDB.

## Lesson debrief → weekly plan (how homework is set)

After each lesson Dina opens the student → **Lesson debrief & week plan**: tenses and verbs covered, themes, optional storyline chapter, a note for the student, what to fix (verb endings, accents, stem changes, irregular verbs, ser vs estar, vocabulary, listening, speaking, pronunciation, spelling, confidence), up to three goals and minutes a day. **Generate the week's plan** turns that into real activities spread Monday–Sunday, tailored with the student's own data (their weakest verbs, their next chapter, their interests, e.g. the football games). Dina removes or moves items, then **Send**: the student gets "This week with Dina" on their home page (the note, the goals, the tasks day by day). The next debrief opens with last week's evidence (done, on time, average score, recurring slips).

The app then adapts on its own (`supabase/functions/_shared/adapt.ts`, the same rule on the server and in the demo): under 60% on a plan task adds a shorter re-try two days later; 90%+ on a verb drill adds a stretch task in the next tense. One follow-up per task, never for a re-try itself. Spaced repetition continues to drive reviews.

Guides for Dina and for students are in the app under **How to use** (`#/guide`).

## Homework from the teacher's own material

In **Assign homework → From a document or text**, or from the plan step of a lesson debrief (**Add exercises from a document or text**), the teacher drops in a PDF, a Word file (.docx) or a text file, or pastes a text. The text is read in the browser (`src/lib/extractText.ts`: pdf.js and the .docx zip, loaded on demand; nothing is uploaded). The app splits it into sentences, spots every verb form it can conjugate (the whole bank, all ten tenses, including two-word forms) and the vocabulary it knows, and shows what it found. It then builds a set from the document's own sentences (`src/lib/material.ts`): gap-fills on the verbs (the tenses the teacher ticks; verbs above the student's level ceiling skipped), sentence building, dictation, vocabulary meaning, plus the teacher's own questions. The teacher sets the count, previews, regenerates and assigns. The student does them in the app (`src/screens/student/MaterialRunner.tsx`); verb and vocabulary answers feed their spaced repetition; every answer, including the open questions, reaches the marking sheet. The set is stored inside the homework record (an excerpt of the text, never the whole document). Tests: `tests/material.test.ts`; browser check: `scripts/material-e2e.cjs`.

## Tenses

Ten tenses are drilled: present, present progressive, present perfect, preterite, imperfect, commands, future, conditional, present subjunctive and imperfect subjunctive, each with the level it is recommended from (A1 to B2). The 41 hand-written verbs keep their examples and memory tricks; a further 335 verbs from A1 to C2 are generated from the conjugation rules (`src/data/conjugation.ts`, `src/data/lexicon.ts`). Tests: `tests/tenses.test.ts`, `tests/lexicon.test.ts`.

## Grammar drills, word packs and placement to C2

Five grammar drills sit in the verb gym and in the homework templates, each with the level it is recommended from: ser vs estar (A1), por vs para (A2), preterite vs imperfect (B1), subjunctive or indicative (B1), if-sentences (B2, with C1 items). Every item is a real sentence with one gap, the right form, the forms a learner would pick instead, the English and the reason (`src/data/grammar.ts`). Slips feed the debrief as *prepositions* or *tense choice*, and those tags add the matching drill to the generated week plan.

Fifteen word packs of ten words each run from A1 to C2 (`src/data/vocabPacks.ts`): at home, food, work, health, paperwork and renting, giving opinions, work and money, feelings, advanced connectors, academic language, idioms, society and politics, shades of language, proverbs and literary register. A student adds a pack from the Memory page (or learns it at once); the teacher assigns a pack as homework; the week plan adds one at the student's level when vocabulary needs work. Packs above a student's level ceiling are hidden. The placement assessment now has C1 and C2 questions in every skill, so it can place a learner up to C2. Tests: `tests/grammar.test.ts`, `tests/engine.test.ts`; browser check: `scripts/content-e2e.cjs`.

## Marking (going through the work the student sent)

Every activity done as homework keeps its answers (`HomeworkResult.items`, up to 60: the prompt, the student's answer, the right answer and the app's diagnosis of the slip): the verb gym, the games, memory reviews and storyline chapters. In **Homework → open an item**, the teacher sees the answers one by one, can accept an answer the app rejected (or the reverse), leave a note on any answer, give a mark (%) and/or a grade, and, for written and spoken work, add **corrections**: quote the student's words (or select them in the text and press *Use selection*), say what they should be, tag the type of slip and add a reason. Saving marks the homework reviewed (`Homework.marking`). The student sees the mark, their own words with the corrections highlighted, and the notes on their answers (`src/screens/student/Marked.tsx`). The tagged slips of the last 14 days, plus the app's own diagnoses, appear at the top of the next **lesson debrief** and pre-tick *what to fix* (`markedSlips` in `src/lib/platform/marking.ts`). Tests: `tests/marking.test.ts`; browser check: `scripts/marking-e2e.cjs`.

## Level access (what a student can open)

From a student's profile the teacher sets a **level ceiling** (A1 to C2, or none) with an optional note. It is saved as a platform record of kind `student` (one row per student, `student-<id>`, teacher-written, readable by that student only). In the student's own app, tenses above the ceiling are locked in the verb gym, the app never picks verbs above it, and levels above it cannot be self-selected in the profile or at onboarding. The automatic stretch task (next tense after a 90%+ score) is never created above the ceiling, on the server and in the demo alike. **Homework the teacher assigns always opens**, whatever the ceiling; the assignment form and the debrief flag when a chosen tense is above it. Logic: `src/lib/platform/level.ts`, `src/lib/platform/useLevelAccess.ts`, `src/screens/teach/LevelAccess.tsx`; tests: `tests/level.test.ts`, `tests/plan.test.ts`, `tests/platform-api.test.ts`; browser check: `scripts/level-e2e.cjs`.

## Gradual release (verbs and words in blocks)

So a student is not faced with every verb and word on day one, the teacher can release content a block at a time. On the student's profile, in the level-access card, **Release in blocks** turns it on and releases the two starter blocks. From then on **Next verbs** and **Next words** release the next block in teaching order, and **Choose blocks** shows every block by level (A1 to C2) to release or lock individually; the eye icon lists what a block contains. **Turn off** opens everything within the level again and remembers the released blocks.

A verb block is twelve verbs of one level, most frequent first (34 blocks); a word block is one ten-word pack (15 packs). Blocks are defined in `src/data/blocks.ts`. While it is on, the student's verb gym, verb games and word-pack list only use released blocks. Homework the teacher assigns always opens, and words already in a student's deck stay there if a pack is locked again. The choice is stored on the student's settings row (`stepped`, `unlocked`), so it needs no backend change. Covered by `tests/blocks.test.ts` and `scripts/release-e2e.cjs`.

## Phone notifications

Students and the teacher can turn on notifications per device (the prompt on their home screen, or the account page). It uses standard Web Push, so it needs no app store: on Android and desktop it works in the browser; on iPhone and iPad the person first adds the app to the Home Screen (Share, then Add to Home Screen) and turns notifications on from there. The app shows those steps when it detects an iPhone that has not done so.

What is sent, all triggered on the server when the record is saved:

- To the student: new homework (a weekly plan of several items is one notification), homework marked, new feedback, a lesson booked, moved or cancelled, new verb or word blocks released, a new invoice, and a payment confirmed.
- To the teacher: a student handed in homework, or reported an invoice as paid.

How it works: `src/lib/push.ts` subscribes the device and posts the subscription to `push/subscribe`; the server stores it in `lwd_push` (one row per device, removed on opt-out, log-out, account deletion, or when the push service reports it gone). `supabase/functions/_shared/webpush.ts` encrypts each message for the device (RFC 8291) and signs it with the server's VAPID key (RFC 8292) using WebCrypto only. `public/sw.js` shows the notification and opens the right screen when it is tapped. Only Apple, Google, Mozilla and Microsoft push hosts are accepted as endpoints.

The VAPID key pair is created once by `scripts/supabase-setup.mjs` and stored as the `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` function secrets. Keep it: replacing it disconnects every device until each one turns notifications on again. Without the secrets the feature is simply off and the prompt stays hidden.

Not included yet: timed reminders (for example "lesson tomorrow"), which need a scheduled job. Covered by `tests/webpush.test.ts` (including the RFC 8291 test vector), `tests/push-api.test.ts` and `scripts/push-e2e.cjs`.

## Alignment with the DELE syllabus

DELE follows the Instituto Cervantes curriculum plan (Plan curricular del Instituto Cervantes, PCIC), which sets out grammar and vocabulary by level, A1 to C2.

**Verb forms: checked and aligned (12 November 2026).** Every tense in `TENSES` (`src/data/verbs.ts`) sits at the level the plan gives it, and the six forms the plan lists that the app lacked were added: the pluperfect and negative commands at B1, and the perfect subjunctive, pluperfect subjunctive, conditional perfect and future perfect at B2. Compound tenses are haber in the right tense plus the participle (`HABER_FORMS`); negative commands are "no" plus the present subjunctive. A test in `tests/tenses.test.ts` pins every tense to its level.

**Source.** The check used the level-by-level grammar programmes (A1 to C1) published by the Centro Complutense para la Enseñanza del Español (Universidad Complutense de Madrid), which set out the PCIC grammar inventory by level. The Cervantes site (cvc.cervantes.es) was redirecting every page to a maintenance notice that day, so the official text was not read directly. Re-check against it when it is back.

**Not yet checked.** Which verbs and which word packs sit at which level. That needs the PCIC vocabulary inventory ("Nociones específicas"), which is only on the Cervantes site. Until it is checked, describe the verb forms as DELE-aligned, not the vocabulary.

**Not included.** Practice in the format of the DELE papers.

## How-to videos for students

Seven short videos (about 45 to 85 seconds each, with sound) sit at the top of the student guide (`#/guide?for=student`), each with a Download button: getting started, lessons, homework, practising alone, feedback and progress, invoices, and exam practice. Each video file also has a direct link: `<site>/guides/videos/<name>.mp4`.

Dina and Toby guide each one, and they stay together:

- **Their own stage.** A panel slides in at the bottom of the screen and they stand on it, so they are not parked on top of the app's words. When the thing to look at is at the bottom (a tab, a button in a sheet) the stage moves to the top.
- **Dina** is a whole person. She walks on carrying Toby and waves, sways and looks about when idle, leans into her walk, nods and gestures as she talks, and points at the thing she is talking about. Her speech bubble pops out of her mouth as each line starts.
- **Toby** runs a step ahead of her, sits at her feet, and sometimes rides in her arms. For each step he dashes to the thing to look at and barks "¡Guau!" (with a bark sound) while it lights up, then runs back to her. He hops when it is tapped.

**How they are made.** They are recordings of the running app, made by `scripts/videos/student-videos.cjs` (its header says what to start first), so they can be re-made when a screen changes. The characters live in `scripts/videos/guide/`: `characters.ts` draws them, `rig.ts` moves them and `guide.ts` holds the stage and the choreography. Dina is one jointed drawing made for animation. Her head is the app's portrait shape for shape (the same face, hair, eyes, mouth and colours as `src/components/Dina.tsx`), so she is the same person in the videos and in the app; her body, arms and legs are drawn to match and move on joints. If the app's portrait changes, copy the changed shapes into `characters.ts`. The recorder steps the page one frame at a time, so the videos are a steady 30 frames a second however slow the computer is. Toby's bark is made from scratch in `voice.py`; no recording is used. Videos 2 to 6 use the demo workspace with its demo labels hidden; video 1 uses a real account on a local server.

**The voice.** `scripts/videos/voice.py` makes it with Piper, a free speech engine that runs on the computer (no account, no fee). The voice is Piper's `es_MX-claude-high`, a real Spanish voice (Apache 2.0 licence). Each line is turned into English sounds, every sound is swapped for the one a Spanish speaker would use (a tapped r, five pure vowels, b for v, d for "th", "es" before s + consonant), and the Spanish voice says the result; Spanish words such as "¡Hola!" are said as Spanish. The result is English with a generic Spanish accent, read in a calm, even way like a phone assistant (the `--steady` setting). It is a made-up voice, not a recording of a person, and it is not tied to any one country's accent.

**Using Dina's own voice instead.** Each video has a script at `scripts/videos/voice-recordings/<video>/script.txt`, one numbered line per file. Record each line as `l0.m4a`, `l1.m4a` and so on (mp3 and wav also work), save them in that folder and re-run the recorder: those lines use the recording, and each step lasts as long as its recording.

To set the voice up: `python -m venv scripts/videos/voice-env/venv`, `pip install piper-tts` into it, and put `es_MX-claude-high.onnx` and its `.json` (from the `rhasspy/piper-voices` collection on Hugging Face) in `scripts/videos/voice-env/model/`. Or point `PIPER_PYTHON` and `PIPER_MODEL` at them.

## Invoicing

The teacher bills lessons from **Invoices**: settings once (business name, currency, rate per 60 minutes, days until due, numbering prefix, how students pay), then **New invoice** offers the taught, not-yet-billed lessons of a student plus free lines, with a running total. Invoices are numbered `PREFIX-YYYY-NNNN`, saved as records of kind `invoice` (students read only their own; drafts are hidden from them), can be sent (visible in the student's app), emailed (mailto summary), downloaded as a branded PDF (`src/lib/invoicePdf.ts`), marked paid, voided (sent) or deleted (drafts). Money-owed banners appear on the teacher's Today and the student's home. No online payment is built in; payment instructions print on every invoice. Logic and tests: `src/lib/platform/invoicing.ts`, `tests/invoicing.test.ts`, `scripts/invoices-e2e.cjs`.

**Lesson packages**: the teacher defines packages (lessons, minutes, price, validity) in the same settings and sells one to a student, which writes a `credit` record and its invoice (sent or paid). Taught lessons from the purchase date that are not billed individually consume credits in date order (`src/lib/platform/packages.ts`); the balance can go negative. Balances show on the Students page, the profile (Lessons tab, with Sell a package), the student's home and invoices pages; Today flags students down to one lesson. Tests: `tests/packages.test.ts`.

### Students reporting a payment

On an unpaid invoice the student can tap **I've paid this**, choose how they paid and add a note. That flags the invoice for the teacher (on her home screen and on the invoice itself, with the method and note) and sends her a notification. It never changes the invoice's status or amount: the invoice stays "to pay" until the teacher checks her account and uses **Mark paid**, which starts from the method the student gave. The student is notified when a new invoice is sent and when the teacher confirms payment. Server route `platform/invoices/report-paid`; the notice is stored on the invoice as `paymentReported`. Covered by `tests/payment-report.test.ts`, `tests/push-api.test.ts` and `scripts/payment-report-e2e.cjs`.

## Administrator

The usernames in the `ADMIN_USERNAMES` secret (default `admin`) sit above the teacher. The **Admin** page is the brain of the system: **Overview** (usage, platform minutes per day, the teacher's activity in the last 30 days, and everyone's week: last active, minutes today and this week, accuracy, streak, homework pending/overdue, next lesson, top slip), **Activity** (a feed of everything that happened: logins, chapters, games, practice, reviews, homework, lessons, the teacher's notes and plans, filterable by person and type) and **Accounts**, which lists every account with last activity, lessons and homework counts; changes a person's role between student and teacher (signs them out so they return with the new role); resets a password (new temporary password and recovery code, shown once); removes an account (everything cascades); and shows platform usage (accounts, active in 7 days / 24 h, records, progress saves). The admin also gets the full teacher dashboards. Admin rights cannot be granted or removed through the API. Tests: `tests/admin-api.test.ts`, `scripts/admin-e2e.cjs`.

## Real accounts

- **Who is the teacher**: the account(s) named in the `TEACHER_USERNAMES` secret of the Edge Function (default `dina`). Dina registers (or logs in) with that username and gets the teacher dashboard: Today, Calendar, Students, Homework.
- **Adding students**: Students → **Add a student** creates the student's account (first name, username, optional password). The login details and recovery code are shown once for Dina to pass on; the student can change the password in their settings. Anyone who registers on the app themselves also appears in Dina's list (one teacher, all learners are her students).
- **What is saved where**: bookings, homework (with results), feedback and the activity feed live in the `lwd_platform` table; each learner's progress stays in `lwd_progress` and keeps syncing as before. The server scopes every request by role — a student only ever receives their own rows, the teacher her students' — and Row Level Security with no policies keeps the public API keys out entirely (`supabase/migrations/20261107000000_lwd_platform.sql`, `supabase/functions/_shared/account-core.ts`, `src/lib/platform/cloudBackend.ts`).
- **Overlap prevention** is enforced on the server as well as in the app.
- **Offline**: the learning app keeps working offline; the lessons/homework screens need a connection and say so.
- **Front page**: the app opens on *Lessons with Dina* (`#/home`): continue as whoever is signed in, quick-pick anyone who has used this device (password still required), create an account or log in, learn without an account, or try the demo. `#/demo` is an alias.
- **Tests**: `tests/platform-api.test.ts` (6 tests on real Postgres) and `scripts/platform-real-e2e.cjs` (12 browser checks of the whole flow).

## Try the demo

Open the app → **Teacher demo** on the welcome screen (or `#/demo`). Choose:

- **Dina** — teacher dashboard: Today, Calendar (week/month), Students, Homework.
- **Sam** — Madrid, A2, going well.
- **Anneka** — Valencia, A1, needs more support.

No passwords in the demo. The yellow **Demo · name** pill switches between them. Everything you do (book, reschedule, cancel, assign, complete, review, feedback) is saved in this browser's IndexedDB and survives reloads; **Reset demo data** on the demo page restores the sample data.

The 9-step demonstration (Dina → Sam → book → assign → as Sam see both → complete → back to Dina, updated → Anneka independently) is automated in `scripts/platform-e2e.cjs` and passes (16 checks).

## What is real and what is sample data

| | Status |
|---|---|
| Dina, Sam, Anneka | Fictional. Clearly marked **Demo data** on every screen. |
| Their lessons, homework, feedback | Sample data seeded on first use; changes you make persist on the device. |
| Their learning statistics | **Genuinely computed** by the app's real analytics — but over fictional study sessions replayed through the real tracking (`src/lib/platform/demoSeed.ts`). |
| Homework completion | **Real**: a homework item launches the actual lesson, verb session, game or review; its result (score, attempts, summary) is recorded and shown to Dina. Written/speaking homework uses a real editor and the real recorder (recordings stay on the device). |
| Booking rules | Real: overlap prevention, time-zone-aware scheduling (stored in UTC, shown in each viewer's zone, scheduling zone remembered). |
| Reminders | Real, but **in-app only**: 24 h / 1 h lesson reminders and homework deadlines appear while the app is open. Nothing can notify someone when the app is closed — that would need a separate notification service (not added; none activated). |
| Real learner accounts | Existing username/password accounts and cross-device sync are unchanged (see `docs/ACCOUNTS.md`). |
| Teacher role for real accounts (cloud) | **Implemented** (see "Real accounts" above); needs the Supabase setup in `docs/ACCOUNTS.md`. |

## Architecture

- `src/lib/platform/types.ts` — Booking, Homework, Feedback, Activity, Person.
- `src/lib/platform/backend.ts` — the `PlatformBackend` interface + `DemoBackend` (IndexedDB). Every method is scoped to the acting person: a student only ever sees their own records; the teacher sees her students'.
- `src/lib/platform/context.tsx` — who is acting (demo actor or signed-in role), switching between Dina/Sam/Anneka. Each student has their own full learning copy (`state:demo:sam`, `state:demo:anneka`), so acting as Sam runs the whole app on Sam's progress.
- `src/lib/platform/homework.ts` — maps homework to real activities (`?hw=<id>`) and records completion.
- `src/lib/platform/time.ts` — time-zone helpers (no library).
- `src/screens/teach/*` — Dina's screens. `src/screens/student/*` — student screens and the written/speaking homework runner. `src/screens/Demo.tsx` — the switcher.
- `src/lib/platform/cloudBackend.ts` — the real-account implementation over the Edge Function's `platform/*` endpoints.

## Before real students can use it

1. Supabase project configured as in `docs/ACCOUNTS.md` (free tier; nothing paid activated), including the `TEACHER_USERNAMES` secret and the `LWD_API_URL` repository variable for the GitHub Pages build.
2. Dina registers the username `dina` with a strong password and keeps her recovery code; then adds her students from the Students page.
3. Optional: a notification service for reminders when the app is closed (would be a separate, possibly paid, service — not added).

## Costs

Nothing in this prototype costs anything to run (static site + browser storage). Real accounts use the Supabase free tier as documented in `docs/ACCOUNTS.md`.

## When something goes wrong (troubleshooting)

- **A page that fails** no longer goes blank. It shows "This page hit a problem" with three buttons: try again, go to the start, or refresh the app. Progress is not lost.
- **Settings → Troubleshooting** has "Test the voice", "Refresh the app" (fetches a clean copy of the app and keeps all progress; the first thing to try when something looks stuck or out of date), and a list of recent problems with "Copy report" and "Send to Dina". The report holds the problems and the device type only: no name, password or answers. It stays on the device unless the learner sends it. The code is `src/lib/diagnostics.ts`, `src/components/ErrorBoundary.tsx` and `src/components/Troubleshooting.tsx`.
- **Verb gym.** A session is always a full 12 questions (it used to stop at 8 to 11), "Keep going: 12 more" starts the next one from the results screen, and a session left half-way (the phone reloading the app, switching tabs) is offered again with "Carry on". `tests/verb-sessions.test.ts` builds thousands of sessions and fails if any exercise could not be answered; `scripts/verbs-e2e.cjs` plays whole sessions in a phone-sized browser.
- **The voice.** The app used to stop the voice every time it saved anything (an answer, the practice timer, a pop-up), which cut words off half-way; it now stops only when the learner moves to another page. A line the phone silently drops is said again once; a line is no longer spoken on top of the "correct" chime; and a voice that will not start is recorded in the troubleshooting list.

## Speaking answers, daily reminders, lesson briefs and problem reports

- **Say your answer.** In the verb gym, typed questions have a microphone button. The phone listens once and what it heard is checked like a typed answer (a pronoun said first, capitals and full stops are ignored). It appears only where the browser can do speech recognition; in Chrome and Safari the audio is processed by the browser maker's service, as the Settings page already says.
- **Daily reminder and streak.** A learner picks a time (Settings or Account, under Notifications; the home page offers it once notifications are on). The server sends one notification a day at that time in their own time zone, unless they have already practised that day, and it names their streak. The streak also shows on the student home page.
- **The brief before each lesson.** On the teacher's home page every scheduled lesson has "Before this lesson": days practised, minutes and accuracy since the previous lesson, what keeps going wrong (with the forms that were missed), the state of the homework and what to do in the lesson. The same summary is on each student's profile, and it is sent to the teacher's phone 24 hours before the lesson starts (straight away if the lesson is booked later than that). One function writes all three: `supabase/functions/_shared/brief.ts`.
- **Problems go to the administrator.** While someone is logged in, a page that fails, a script error or a voice that will not play is sent to the server and listed under Admin, Problems, grouped, with who it happened to, the page, the device and the app version. A page that stops also notifies the administrator's phone, at most once an hour. A report never holds a password or answers; one device can send at most 30 a day; reports are deleted with the account.
- **Phone menu.** Four tabs and "Más" (More), which opens a sheet with everything else, so the bar never wraps.

**How the timed notifications run.** The database's own scheduler (pg_cron with pg_net) calls `cron/tick` on the function every ten minutes with a shared secret. `scripts/supabase-setup.mjs` creates the secret and the schedule once; the secret lives only as the `CRON_SECRET` function secret and inside the scheduled job. Each tick is safe to repeat: a reminder goes out once a day per person and a brief once per lesson time. Tables: `lwd_reminders` and `lwd_reports` (migration `20261115000000`). Tests: `tests/timed-api.test.ts`, `tests/heard.test.ts`, `scripts/upgrades-e2e.cjs`.

## What to concentrate on, and the detail behind the trends

- **For the student, before a lesson.** The student home page and My journey have "What to concentrate on": up to five areas worked out from their own results, most important first. Each opens to full sentences: what is happening (with their numbers and whether it is improving), their own wrong answers next to the right ones, why it happens, how to improve step by step, what to say or ask in the lesson, and a button that starts practice on exactly that. Areas come from the kinds of mistake they make, their weakest tense, a gap between recognising and producing a form, listening, how regularly they practise, overdue reviews and whether they speak answers. `src/lib/focus.ts` holds the logic and the wording; `tests/focus.test.ts` and `scripts/focus-e2e.cjs` cover it.
- **Trends open up.** On My journey, each trend (minutes, accuracy, words) opens to every week as a bar with its number and a few sentences on what it means against their goal. Each common slip opens to its full explanation, and each tense opens to what the tense is for, how they are doing and which verbs to work on.

## The grid drill and the arcade

- **Grid drill (verb gym).** "Grid drill: fill in the table" shows several verbs side by side, one row per person, in the chosen tense. Each column heading gives the verb, its meaning and a label: Regular, Stem change or Irregular, with a line at the top saying what the labels mean. A grid always mixes regular and irregular verbs where it can. In "My weak spots" the forms the learner is unsure of are blank and the rest are filled in; "Everything" blanks the whole table. The table is checked in one go, the right form appears under each miss, and "Try the ones I missed" brings back just those. Three verbs fit a phone; four or five can be chosen. `src/screens/VerbGrid.tsx`, `scripts/grid-e2e.cjs`.
- **Games that suit the learner.** Each game now says what it practises (Verbs, Words, Listening, Grammar, Speaking), which ways of learning it suits and which difficulties it helps with (`src/screens/games/registry.ts`). The arcade shows "Picked for you" with the reason, taken from what the learner said they enjoy, find hard and are interested in, and chips filter the list by skill. Football games rank high for football fans and lower for everyone else.
- **Three more games,** so every way of learning has one: Pairs (match words to meanings, the board refills; visual), Quick Keys (type the verb form, accepted the moment it is right; writing) and Say It (say the form aloud; speaking, shown only where the browser can listen).
- **Smoother play.** Answers used to be saved after every tap, which redrew the whole app mid-game; they are now saved together a moment later and always when a game pauses, ends or is left. Moving parts (the Metro train, the falling ser/estar card, the timer bars) use transforms, which a phone draws smoothly. `scripts/games-e2e.cjs` plays the games in a phone-sized browser.

## Levels: games that unlock, moving up, and less English

- **The level a learner is working at** is the teacher's ceiling if she has set one, otherwise the level she last confirmed, otherwise the learner's own (`useLevelAccess().level`). Games and the app's wording follow it.
- **Games by level.** Every game has a `minLevel` (`src/screens/games/registry.ts`). The arcade lists only the games of the learner's level and below: higher ones are not shown at all. When the teacher moves the learner up, that level's games appear at the top marked "Just unlocked" until they have been played. Homework a teacher sets always opens. Four quick-fire grammar games open as the learner rises: Por o Para (A2), Two Pasts and Subjunctive? (B1), What If (B2). The verb games (Metro Rush, Quick Keys, Say It) bring in the tenses of the learner's level and never one above it (`src/screens/games/level.ts`).
- **Moving up.** `src/lib/levelUp.ts` looks at five signs at the learner's level: the level's own tenses are secure, enough verbs known well, enough words remembered, 80% right over four weeks, and regular practice. The student sees them as a checklist ("On the way to A2") on their home page and My journey. When all five are in place the teacher gets "Ready to move up" on her home page and, on the student's profile, the suggestion with the evidence and two buttons: "Move up to A2" and "Not yet" (which silences it for three weeks). The app only suggests; nothing changes until the teacher confirms, and she can also move a student up before the app suggests it. The student is then told "Dina has moved you up".
- **Less English as the level rises.** `src/lib/i18n.tsx` moves the app's own words into Spanish in stages: at A2 the buttons (Continuar, Comprobar, Escuchar, Jugar) and the menu; at B1 headings, labels and the names of exercises and tenses; from B2 short instructions too. Grammar explanations and feedback on mistakes stay in English at every level. The learner can override it in Settings ("Language of the app itself").
- **Both genders in the row labels.** Verb tables say "él / ella" and "ellos / ellas", never just "él".

Tests: `tests/levels.test.ts`, `scripts/levels-e2e.cjs`.

## Exam practice, writing the teacher marks, and the weekly recap

- **Exam practice (`#/dele`).** Twelve tasks written in the style of the DELE, three per level from A1 to B2: a text with three-option questions, a recording heard at most twice (read by the device's Spanish voice, script hidden until the answers are checked) and a writing task with the exam's word range. Each runs against the real exam's clock, is scored against its 60% pass mark and explains every answer by pointing at the text. A student sees the papers of their level and below; the teacher sees them all. These are our own tasks, not official or past papers, and the page says so. Speaking is left to lessons. Content: `src/data/dele.ts` (checked by `tests/dele.test.ts`).
- **Writing the teacher marks.** Written homework with a word target, and marking with corrections laid over the student's own words, already existed. Two things are new: the exam writing tasks can be set as homework from the assign form ("Exam practice: A2 writing"), and a student who writes one on their own can press "Send to Dina to mark". It arrives in her homework list as handed-in work (server route `platform/writing`, at most five a day) and her marking comes back to the student like any other.
- **Weekly recap (`#/recap`, "My week" in the menu).** As well as the week's numbers it now says what got better against last week in sentences, what slipped, and what to take to the next lesson (the top three areas from "What to concentrate on"), with progress toward the next level. With a daily reminder on, Sunday's reminder is the recap notice.

Browser test: `scripts/dele-e2e.cjs`.

## The lesson room

A place to run a lesson: the teacher plans it beforehand, shares her screen on Zoom (or any call) and puts each part up when she is ready; the student, on their own phone or tablet, sees only what she has opened, their screen follows hers, and their answers appear on hers.

- **Where.** Teacher: **Lesson room** in the menu (`#/teach/room`). Student: a green **Your lesson is open · Join** card appears on their home page by itself when she starts, and their phone is notified. Afterwards the opened parts stay on their home page as **Notes from your lessons**.
- **Planning (the Plan tab).** A lesson is a list of parts: an explanation, an open question, a fill-the-gap sentence, a multiple-choice question, or a word list. She can add, edit, reorder, duplicate and delete them, and write private notes. Everything saves by itself, so she can prepare days ahead. **Draft it from their week** writes a first version from the student's own results: a warm-up, their hardest point explained with their own mistakes, gap exercises on the exact forms they missed, the verbs to recycle and a wrap-up.
- **From a plan she already has.** "Upload a plan (Word, PDF or text)" or "Paste it instead" turns her own lesson plan into the parts of a lesson by reading its shape: a heading starts a part; a sentence with ___ becomes fill-the-gap (the answer in [square brackets] after it, or on an "Answers:" line); a question followed by a) b) c) becomes multiple choice (a star marks the right one); a line ending in "?" becomes an open question; lines like "la playa = the beach" become a word list; everything else is an explanation. It follows rules and invents nothing (`src/lib/platform/lessonImport.ts`, `tests/lesson-import.test.ts`). The file is read on her device. A scanned page or a photo has no text to read. She checks the result on the Plan tab, which says what was made and whether any answers are missing.
- **An example lesson.** "Open an example lesson" makes a finished seven-part lesson to try the room with.
- **Presenting (the Present tab).** Large type, made to be screen-shared. The list on the left opens or closes each part for the student; the part on screen says "Only you can see this" until she presses **Show it to Sam**. **Open all** and **Close all** do the lot. A chip shows whether the student is in the lesson. For gap and choice parts she can show the answer. Her notes stay folded away unless she opens them.
- **What the student can and cannot see.** Only opened parts. Never her notes. The right answer to a part only after they have answered it or she has shown it. This is enforced on the server (`studentView` in `supabase/functions/_shared/lesson.ts`), not just hidden on the page, and it applies to everything the server sends a student.
- **How the two devices stay in step.** Each asks the server every two seconds while the lesson is running (five when it is not). The plan is written only by the teacher and the student's answers only by the server on the student's behalf (two separate records), so neither can overwrite the other. The student's record is changed one field at a time, so a check-in that crosses with an answer cannot wipe it. No extra service is used.
- **Code and tests.** `src/screens/room/`, `src/lib/platform/lessonDraft.ts`, server route `platform/lessons/sync`. `tests/lesson-api.test.ts` covers the rules on a real database; `scripts/room-e2e.cjs` runs a whole lesson with a teacher laptop and a student phone at once (25 checks); `scripts/room-demo-e2e.cjs` covers the demo.

## Smaller changes

- Students are no longer offered the teacher's guide, and "How to use" sits at the bottom of their menu, below "Tú".
- **My week** shows the last finished week by default, with a button for the week in progress. On Sunday the week just ending is published as the review. It also shows lessons with Dina that week and how many the student has had in all.

