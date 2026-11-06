# Learning with Dina — teaching platform (prototype)

A teacher dashboard for Dina and individual dashboards for her students, built into the existing app. The prototype runs entirely in the browser (demo mode) so it can be shown to Dina without any server.

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
| Teacher role for real accounts (cloud) | **Not implemented yet** — see below. |

## Architecture

- `src/lib/platform/types.ts` — Booking, Homework, Feedback, Activity, Person.
- `src/lib/platform/backend.ts` — the `PlatformBackend` interface + `DemoBackend` (IndexedDB). Every method is scoped to the acting person: a student only ever sees their own records; the teacher sees her students'.
- `src/lib/platform/context.tsx` — who is acting (demo actor or signed-in role), switching between Dina/Sam/Anneka. Each student has their own full learning copy (`state:demo:sam`, `state:demo:anneka`), so acting as Sam runs the whole app on Sam's progress.
- `src/lib/platform/homework.ts` — maps homework to real activities (`?hw=<id>`) and records completion.
- `src/lib/platform/time.ts` — time-zone helpers (no library).
- `src/screens/teach/*` — Dina's screens. `src/screens/student/*` — student screens and the written/speaking homework runner. `src/screens/Demo.tsx` — the switcher.
- `src/lib/platform/cloudBackend.ts` — placeholder for the real-account implementation.

## Before real students can use it

1. **Cloud teacher role** (not built; the demo doesn't need it): a migration adding `role`/`teacher_id` to `lwd_users` and tables for bookings, homework, feedback and activity; endpoints on the account Edge Function with server-side authorisation (students only their rows, teacher only her students); `src/lib/platform/cloudBackend.ts` implemented over those endpoints; tests on PGlite like `tests/account-api.test.ts`. Estimated: one focused session. The UI already works against the `PlatformBackend` interface, so no screen changes are needed.
2. Dina's real account: register the username `Dina` as the teacher (via a `TEACHER_USERNAMES` secret in that design) with a strong password and her recovery code.
3. Supabase project configured as in `docs/ACCOUNTS.md` (free tier; nothing paid activated).
4. Optional: a notification service for reminders when the app is closed (would be a separate, possibly paid, service — not added).

## Costs

Nothing in this prototype costs anything to run (static site + browser storage). Real accounts use the Supabase free tier as documented in `docs/ACCOUNTS.md`.
