# Learning with Dina

**Tu vida en español empieza aquí · Your Spanish Life Starts Here**

*(Built on the VIVA learning engine — internal storage keeps the `viva` name so existing progress and backups keep working.)*

A Spanish-learning **progressive web app** with a tutor platform built in: an immersive storyline for learners (you land in Madrid, meet your guide Lucía, find your flat in Lavapiés, order your first *café con leche*), a verb engine with sixteen verb forms placed at the levels the DELE syllabus gives them, 376 verbs from A1 to C2, grammar drills and word packs by level, and, for the tutor, lessons, homework, marking, analytics and invoices.

**Free to run.** The learning app needs no account and no paid API; everything is stored on the device. The tutor platform uses a free Supabase project (see below).

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (verb data, SRS, scoring, time tracking, templating)
npm run build      # production build in dist/
npm run preview    # serve the build on http://localhost:4173
node scripts/e2e.cjs http://localhost:4173/   # full journey in Chromium + screenshots/ (needs `playwright`)
```

Requires Node 18+ (developed on Node 22).

## Publish it free with a shareable HTTPS URL

**GitHub Pages (included):**
1. Push to this branch (or merge to `main`).
2. In the repo, go to **Settings → Pages → Source** and choose **GitHub Actions**.
3. `.github/workflows/static.yml` tests, builds and publishes on every push to this branch or `main`, to `https://<user>.github.io/<repo>/`.

The build uses relative paths (`base: './'`) and hash routing, so it works on any sub-path without rewrites.

**Alternatives:**
- **Netlify / Cloudflare Pages / Vercel:** import the repo, use build command `npm run build` and output directory `dist`.
- **Netlify Drop:** run `npm run build` and drag the `dist/` folder onto app.netlify.com/drop.

Microphone recording and installing as an app both need HTTPS (or `localhost`), and all of these hosts provide it.

## Teaching platform

A teacher dashboard and dashboards for each student — lessons (week/month calendar, bookings with overlap prevention and time zones), a lesson debrief that becomes a week of homework, homework completed inside the app, **marking answer by answer with corrections quoted from the student's own words**, a **level ceiling per student** (A1 to C2), **homework built from the teacher's own documents** (PDF, Word or pasted text, read in the browser), analytics, invoices and lesson packages. Try it from `#/demo` as Dina, Sam or Anneka — no password in the demo; everything persists in the browser. See [`docs/PLATFORM.md`](docs/PLATFORM.md) for how each piece works, what is real vs sample data and what's needed before real students use it.

## Accounts & cross-device progress

Optional free accounts with a username and password (no email). Progress saves automatically, works offline, and continues on any device. There's also a **My Learning Journey** page and a personal welcome-back greeting. See [`docs/ACCOUNTS.md`](docs/ACCOUNTS.md) for the security design, Supabase setup steps (about 15 minutes, free tier) and costs. Until the account server is configured, the app runs local-only exactly as before.

## Dina, your tutor

An illustrated, animated Dina peeks out from behind the **Learning with Dina** logo (desktop sidebar, mobile header, welcome screen): playful entrance when the app opens, natural blinking, occasional broad smiles, a small wave, gentle head movement. Tap her and she greets you — “¡Hola! ¡Bienvenida a Learning with Dina!” (“Bienvenido” if you chose masculine agreement) — in an Argentinian Spanish voice when the device has one (es-AR, then other Latin American voices), with the greeting always shown as text too. Reduced-motion preferences turn the animation off; she still greets on tap.

Speech playback is hardened app-wide: waits for voices to load, keeps utterances referenced (Chrome GC cut-offs), pauses briefly after cancel (Chrome drops), resumes paused engines (Safari), splits long text at sentence boundaries, keeps desktop Chrome alive past its ~15 s limit, and always resolves (never hangs) via a duration-based safety net.

## What's in the MVP

| Area | What works |
|---|---|
| **VIVA Discover** | Lucía (an animated, speaking guide) asks 14 conversational questions. You can answer by tapping options, typing, or recording a voice note, with playback and delete. Where the browser supports it, speech recognition transcribes typed-answer questions. |
| **Level & assessment** | Start from zero, pick a CEFR level from A1 to C2, or take the placement (vocabulary, grammar, reading, listening spoken by the browser, and verbs, up to C2). Each skill gets its own level, and you can override any of them. A teacher can set a ceiling on what a student opens. |
| **My Spanish DNA** | An editable profile: interests, reasons, region, social goals, daily goal, preferred activities, difficulties, grammatical gender, levels and voice notes. |
| **Madrid world** | An illustrated, animated map whose sky follows your local time of day. It has 3 playable chapters (*La llegada*, *El piso nuevo*, *Café La Plaza*) and 5 locked future locations. |
| **Branching conversations** | 5 recurring characters, relationship meters, and choices rated natural, OK or "learning moment". Each choice gets explanatory feedback with an error category. Some replies are typed or spoken in free form ("Soy de…"). Branches change with your interests, dating goal and grammatical gender. |
| **VIVA Speak** | Every line has Listen again, Slow it down, What does that mean?, Explain the grammar, Help me remember, Let me try (record and replay) and Compare pronunciation (the guide, then your recording). |
| **Verb engine** | 376 verbs from A1 to C2: 41 hand-written with examples and memory tricks, the rest generated from the conjugation rules with only their exceptions written down. Ten tenses: present, present progressive, present perfect, preterite, imperfect, commands, future, conditional, present and imperfect subjunctive, each recommended from a level. Nine exercise types plus five grammar drills (ser vs estar, por vs para, preterite vs imperfect, subjunctive or not, if-sentences). Mastery is tracked per verb, tense and person. Mistakes are diagnosed (stem change, irregular *yo*, person agreement, accents, auxiliary, a verb treated as regular…), re-queued in the same session and scheduled for spaced repetition. |
| **VIVA Memory** | SM-2-style spaced repetition, plus fifteen word packs of ten words from A1 to C2 that a learner adds to their deck or a teacher assigns. "Help me remember" gives progressive hints: a letter clue, then a pattern, a **real etymology** (clearly labelled), an **invented** mnemonic, a visual or story prompt, then your own association, and finally the answer. VIVA measures which techniques lead to recall **12+ hours later** and offers the best ones first. |
| **Regional Spanish** | Spain or Mexico. This changes vocabulary (*coche/carro*, *móvil/celular*…), whether *vosotros* is drilled, the guide's voice, and regional notes such as *coger* in Mexico. |
| **VIVA Momentum** | A daily goal, an optional streak, a rotating weekly challenge, 13 achievements tied to real events, mastery milestones, relationship progress and a weekly recap. |
| **Active-time analytics** | A timer that only counts on learning screens, while the tab is visible and focused and you've interacted in the last 45 seconds, or while audio is playing. It never credits more than 2 s per tick, so sleep and timer throttling can't inflate it. |
| **Coach** | Rules-based recommendations that show their evidence, e.g. *"You're still mixing up ser and estar — let's practise through the conversation about your apartment."* |
| **My Spanish Teacher** | Saved teacher details and a weekly report built from real data. Includes a professional PDF with vector charts, an **Email my teacher** button (an encoded `mailto:` with recipient, subject and summary), and copy to clipboard. |
| **Privacy & data** | Export to JSON (optionally with audio), import, and delete everything. Installable as a PWA with an offline cache. |

## Known limitations (honest list)

- **Local-only storage.** Clearing site data or browsing privately erases progress, and progress doesn't sync across devices. Use **Export** regularly.
- **Speech synthesis** quality depends on the OS. Some devices have no Spanish voice, so the guide falls back to the default voice. Chrome and Edge (with online voices) and Safari on Apple devices sound best.
- **Speech recognition** works in Chrome, Edge and Safari but not Firefox. In Chrome and Edge the audio goes to the browser vendor's service. Typing always works instead.
- **No pronunciation scoring.** There's no validated free in-browser method, so VIVA shows only which words the recogniser picked up, labelled as *not a score*, and lets you compare by ear.
- **Speaking level** in the placement is an estimate. Speaking can't be tested reliably in the browser.
- **The PDF isn't attached to the email.** `mailto:` can't carry attachments; download it and attach it yourself.
- **Content scope.** The storyline has 3 Madrid chapters (plus Valencia). The 335 generated verbs have no example sentences yet, so they appear in the conjugation, choice, listen and match exercises but not in the sentence-based ones. Verb forms follow the Instituto Cervantes curriculum plan by level; the vocabulary levels have not yet been checked against it (see docs/PLATFORM.md).

See [`docs/PLAN.md`](docs/PLAN.md) for the product plan, design system, architecture and roadmap.

## Screenshots

![Six cities, six themes](docs/screenshots/cities.png)

| | |
|---|---|
| ![Arcade](docs/screenshots/30-arcade.png) | ![Metro Rush](docs/screenshots/31-game-metro.png) |

| | |
|---|---|
| ![Welcome](docs/screenshots/01-welcome-desktop.png) | ![Madrid map](docs/screenshots/09-world-desktop.png) |
| ![Conversation feedback](docs/screenshots/07-scene-feedback.png) | ![Mobile](docs/screenshots/22-scene-mobile.png) |
