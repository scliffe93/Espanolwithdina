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

Six short videos (about 50 to 80 seconds each, with sound) sit at the top of the student guide (`#/guide?for=student`), each with a Download button: getting started, lessons, homework, practising alone, feedback and progress, and invoices. Each video file also has a direct link: `<site>/guides/videos/<name>.mp4`.

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
