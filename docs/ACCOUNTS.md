# Learning with Dina — accounts & cross-device sync

Learners sign up with **a username, a password and their first name**. No email address is needed. Progress saves automatically and follows them to any device.

## How it works

```
Browser (GitHub Pages)                      Supabase (free tier)
──────────────────────                      ─────────────────────────────────────────
IndexedDB  ── always saved first ──┐        Edge Function "account" (Deno)
  guest copy  (key "state")        │  HTTPS   • /register /login /logout /me
  account copy (key "state:u:<id>")├────────► • /recover /change-password /recovery-code
Sync engine (src/lib/account.tsx)  │  Bearer  • /progress  GET / PUT (versioned)
  • uploads ≤ 1× per 20 s          │  token   • /delete-account
  • merges on conflict (409)       │                │ server-side DB connection
  • offline → "not yet synced"     │                ▼
                                   │        Postgres: lwd_users, lwd_sessions,
                                   │        lwd_progress, lwd_attempts
                                   │        (RLS on, no public policies)
```

### Why a custom Edge Function rather than Supabase Auth

Supabase Auth signs people in with an email address or phone number. Username-only sign-in would mean inventing fake email addresses, and you asked for that not to happen. Instead, a small account service (`supabase/functions/_shared/account-core.ts`) does the authentication itself, using established building blocks:

| Concern | How it's handled |
|---|---|
| Password storage | **Argon2id** (`hash-wasm`) with OWASP parameters (19 MiB, t=2, p=1) and a random salt per password. Plaintext is never stored or logged. |
| Sessions | 256-bit random tokens. Only their SHA-256 hash is stored. Remember Me lasts 30 days; otherwise 24 hours. Logging out deletes the session. |
| Recovery | An 80-bit recovery code (e.g. `7KQ2-M9XD-4RTP-H3VB`) is shown once at sign-up and stored only as a SHA-256 hash. Each code works once, and using it issues a new one and signs out every device. There are no security questions. |
| Brute force | Five failed logins or recovery attempts per username every 15 minutes, and 30 per network address. Unknown usernames are checked against a dummy hash and get the same error message, so usernames can't be discovered by guessing. |
| Access control | Every query is scoped to the user id resolved from the session token. Row Level Security is enabled on every table with no public policies, so Supabase's public API keys can't read or write anything. |
| Conflicts | Each upload names the version it was based on. A stale upload is refused (409) and the newer copy comes back. The app merges the two (`src/lib/merge.ts`): completed chapters and achievements are combined, each spaced-repetition card keeps its latest review, per-day counters keep the larger value, and settings keep the most recent edit. Nothing is silently overwritten. |
| Transport | HTTPS only, an allow-list of origins (CORS), a 2 MB request limit and `no-store` responses. Production builds include a Content-Security-Policy that limits network connections to the site itself and the account API. |
| Secrets | **There are none in the frontend.** The browser only ever holds the learner's own session token. The function uses Supabase's built-in database connection, so no service-role key is copied anywhere. |

### What's synced

Everything in the learner's progress:
- profile, proficiency and placement results
- story progress in every city, relationships and choices
- vocabulary and verb mastery, including spaced-repetition schedules
- tense practice, mistakes, study time and history
- achievements, streak data and arcade records
- preferences, goals, teacher details and the "continue learning" position

**Voice recordings stay on the device that made them** (audio is large and personal).

## Setup (about 15 minutes, free)

You need a free Supabase account and the Supabase CLI. Nothing here activates a paid plan.

1. **Create a project** at https://supabase.com/dashboard.
   - Choose a region near your learners (e.g. *West EU (London)* or *Central EU (Frankfurt)*).
   - Keep the database password it generates somewhere safe; it's never needed in the app.
2. **Install and link the CLI** from this repository's folder:
   ```bash
   npm install -g supabase        # or: brew install supabase/tap/supabase
   supabase login
   supabase link --project-ref <your-project-ref>   # shown in Project Settings → General
   ```
3. **Create the tables** (applies every file in `supabase/migrations/`: accounts, and the teaching platform's `lwd_platform` table + `role` column):
   ```bash
   supabase db push
   ```
4. **Allow your website to call the API**:
   ```bash
   supabase secrets set ALLOWED_ORIGINS=https://scliffe93.github.io
   ```
   Add more origins separated by commas, e.g. a custom domain.
   Then name the teacher's account (default `dina`; comma-separate several):
   ```bash
   supabase secrets set TEACHER_USERNAMES=dina
   ```
   Whoever registers or logs in with that username is the teacher; everyone else is a student. See `docs/PLATFORM.md`.
5. **Deploy the account function**. It handles its own login, so Supabase's JWT check is off:
   ```bash
   supabase functions deploy account --no-verify-jwt
   ```
6. **Check it responds**:
   ```bash
   curl -H "Origin: https://scliffe93.github.io" https://<your-project-ref>.supabase.co/functions/v1/account/health
   # → {"ok":true}
   ```
7. **Point the app at it.** In GitHub, go to **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   - Name: `LWD_API_URL`
   - Value: `https://<your-project-ref>.supabase.co/functions/v1/account`

   Then re-run the **Deploy VIVA to Pages** workflow (or push any commit). This URL is public, not a secret.

Until step 7 is done, the live app works exactly as before (local-only). Its account page explains that online accounts aren't switched on yet.

If the function logs show database connection errors, set `LWD_DB_URL` to the **Transaction pooler** connection string (Project Settings → Database), with `supabase secrets set LWD_DB_URL=...`, and redeploy.

## Costs and limits (check https://supabase.com/pricing — figures change)

- **Free plan:**
  - Allowances: 500 MB database, 500,000 Edge Function invocations a month, and a few GB of bandwidth.
  - **Free projects pause after about a week with no activity.** A paused project needs a click in the dashboard to wake it, and learners can't sync until it's awake; their progress stays safe on their devices meanwhile.
- **Typical usage:** a learner's progress document is usually 20–300 KB, so 500 MB holds roughly 2,000–10,000 learners. Uploads are rate-limited to at most one every 20 seconds while studying, about 60–150 requests a day for an active learner. That keeps several hundred daily learners inside the free invocation allowance.
- **When you'd pay:** if you outgrow the free limits or don't want pausing, the **Pro plan** is about **US$25 a month** per organisation, with much higher limits and no pausing. Nothing upgrades automatically; Supabase asks before charging, and this project activates no paid service.

## Running it locally

```bash
TEACHER_USERNAMES=dina npx tsx server/dev-server.ts 8787 memory   # account API on http://localhost:8787/account (Postgres in WASM)
VITE_LWD_API_URL=http://localhost:8787/account npm run dev
```

## Tests

- `npm test` runs the unit tests, which include **18 account-API security tests** and **6 teaching-platform API tests** on a real Postgres engine (PGlite) with the production migrations, and **5 merge tests**.
- `node scripts/platform-real-e2e.cjs <outDir>` is the real-account platform test (12 checks): Dina registers as the teacher, adds a student, books a lesson (an overlap is refused), assigns homework; the student logs in on another browser with the temporary password and sees both; everything survives a reload.
- `node scripts/accounts-e2e.cjs` is the cross-device test. It needs the API on :8787 and an API-configured build on :4173. It covers:
  - signing up on a phone with existing progress
  - logging in on a fresh laptop and continuing learning
  - offline learning, then syncing on reconnect
  - offline edits on two devices, then merging
  - the recovery code
  - a second learner on the same device
  - duplicate usernames and wrong passwords

The Supabase entry point (`supabase/functions/account/index.ts`) is a thin wrapper around the tested core. **It hasn't been deployed or run on Supabase itself from this environment**, so do steps 6–7 above and log in once from the live site to confirm.
