# 4. Teacher platform and student accounts

The running of the teaching business inside the app.

## Built
- Roles: student, teacher, admin. Secure accounts with sync across devices and recovery codes.
- Teacher: today view, calendar and bookings, students and profiles, level access per student, move-up suggestions.
- Money: invoices for taught lessons, PDF and email, lesson packages with a balance, per-student pricing, students can say an invoice is paid.
- Student: home, calendar export, feedback (including lesson summaries and whiteboards), journey.
- Admin: accounts, roles, password resets, activity.
- Phone notifications, daily reminders, lesson briefs sent to the teacher beforehand.

## Where
`src/screens/teach/`, `src/screens/student/`, `src/lib/platform/` (types, backend, cloudBackend), `supabase/functions/_shared/account-core.ts`.

## Check
`npx vitest run`, and the platform demo script. See `docs/PLATFORM.md` and `docs/ACCOUNTS.md`.

## Open
- Nothing outstanding from recent sessions.
