# 6. Reliability and backend

Keeping the live app working, and finding out quickly when it is not.

## Built
- Supabase Edge Function `account` and the `lwd_platform` table; one-command setup and deploy script.
- GitHub Pages deploys on push.
- Report-a-problem button on every screen.
- Self-repair: on an error the app redraws, then refreshes, then reports what it tried.
- Requests retried; open tabs notice a new version and update themselves.
- Fixed: students unable to join a lesson on the live database; blank question after switching apps; other apps in the background no longer interrupt.

## Where
`supabase/functions/`, `server/dev-server.ts`, `scripts/supabase-setup.mjs`, `src/lib/cloud.ts`, `src/lib/diagnostics.ts`, `src/components/ReportIssue.tsx`, `UpdateWatcher.tsx`, `ErrorBoundary.tsx`, `public/sw.js`, `.github/workflows/static.yml`.

## Check
`npx vitest run tests/lesson-api.test.ts`, then `scripts/selfrepair-e2e.cjs` and `scripts/report-e2e.cjs`.

## Rules
- Backend deploys happen only when the owner asks in that message.
- Access tokens are never pasted into chat or committed.

## Open
- The update notice has not been seen working on the live site.
