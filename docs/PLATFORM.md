# Learning with Dina — teaching platform

A teacher dashboard for Dina and individual dashboards for her students, built into the existing app. It runs in two modes:

- **Real accounts** (once Supabase is configured as in `docs/ACCOUNTS.md`): Dina logs in with her own account and is the teacher; every other account is her student. Lessons, homework, feedback and activity are saved on the server and appear on every device each person logs in on.
- **Demonstration** (always available, no server): Dina, Sam and Anneka with sample data in this browser's IndexedDB.

## Lesson debrief → weekly plan (how homework is set)

After each lesson Dina opens the student → **Lesson debrief & week plan**: tenses and verbs covered, themes, optional storyline chapter, a note for the student, what to fix (verb endings, accents, stem changes, irregular verbs, ser vs estar, vocabulary, listening, speaking, pronunciation, spelling, confidence), up to three goals and minutes a day. **Generate the week's plan** turns that into real activities spread Monday–Sunday, tailored with the student's own data (their weakest verbs, their next chapter, their interests, e.g. the football games). Dina removes or moves items, then **Send**: the student gets "This week with Dina" on their home page (the note, the goals, the tasks day by day). The next debrief opens with last week's evidence (done, on time, average score, recurring slips).

The app then adapts on its own (`supabase/functions/_shared/adapt.ts`, the same rule on the server and in the demo): under 60% on a plan task adds a shorter re-try two days later; 90%+ on a verb drill adds a stretch task in the next tense. One follow-up per task, never for a re-try itself. Spaced repetition continues to drive reviews.

Guides for Dina and for students are in the app under **How to use** (`#/guide`).

## Level access (what a student can open)

From a student's profile the teacher sets a **level ceiling** (A1 to C2, or none) with an optional note. It is saved as a platform record of kind `student` (one row per student, `student-<id>`, teacher-written, readable by that student only). In the student's own app, tenses above the ceiling are locked in the verb gym, the app never picks verbs above it, and levels above it cannot be self-selected in the profile or at onboarding. The automatic stretch task (next tense after a 90%+ score) is never created above the ceiling, on the server and in the demo alike. **Homework the teacher assigns always opens**, whatever the ceiling; the assignment form and the debrief flag when a chosen tense is above it. Logic: `src/lib/platform/level.ts`, `src/lib/platform/useLevelAccess.ts`, `src/screens/teach/LevelAccess.tsx`; tests: `tests/level.test.ts`, `tests/plan.test.ts`, `tests/platform-api.test.ts`; browser check: `scripts/level-e2e.cjs`.

## Invoicing

The teacher bills lessons from **Invoices**: settings once (business name, currency, rate per 60 minutes, days until due, numbering prefix, how students pay), then **New invoice** offers the taught, not-yet-billed lessons of a student plus free lines, with a running total. Invoices are numbered `PREFIX-YYYY-NNNN`, saved as records of kind `invoice` (students read only their own; drafts are hidden from them), can be sent (visible in the student's app), emailed (mailto summary), downloaded as a branded PDF (`src/lib/invoicePdf.ts`), marked paid, voided (sent) or deleted (drafts). Money-owed banners appear on the teacher's Today and the student's home. No online payment is built in; payment instructions print on every invoice. Logic and tests: `src/lib/platform/invoicing.ts`, `tests/invoicing.test.ts`, `scripts/invoices-e2e.cjs`.

**Lesson packages**: the teacher defines packages (lessons, minutes, price, validity) in the same settings and sells one to a student, which writes a `credit` record and its invoice (sent or paid). Taught lessons from the purchase date that are not billed individually consume credits in date order (`src/lib/platform/packages.ts`); the balance can go negative. Balances show on the Students page, the profile (Lessons tab, with Sell a package), the student's home and invoices pages; Today flags students down to one lesson. Tests: `tests/packages.test.ts`.

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
