import { motion } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';
import { DINA_CARD_LINE, DINA_VIEWBOX, DinaArt } from '../components/Dina';
import { Icon } from '../components/Icon';
import { CITY_ORDER, CITY_THEMES } from '../data/cityThemes';
import { FOOTBALL, footballWords } from '../data/football';
import { EMAIL_SHOT, PITCH } from '../data/pitch';
import type { CityId } from '../data/storyTypes';
import { navigate } from '../lib/router';
import { Penalty } from './games/Penalty';

// ───────────────────────────────────────────────────────────────
// The pitch page: a stand-alone page for a prospective tutor or language school, personalised
// from the link in the outreach email — #/pitch?to=Laura&school=Academia%20Sol&city=valencia&shot=hablas
// Their name on the brand card, the real penalty game for their city, a sample week, what the
// tutor sees, prices, and one ask: a thirty-minute walkthrough. No account, nothing sent anywhere.
// ───────────────────────────────────────────────────────────────

const BRAND = { terracotta: '#C2593A', terracottaDark: '#963F26', cream: '#FBF6EE', olive: '#5E7149', gold: '#C9A24B', ink: '#1E1B18' };

function clean(v: string | null, max: number): string {
  return (v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** The personalisation carried by the link, validated: free text is trimmed and capped, the city must exist, the shot must be one of the email's three forms. */
export function pitchParams(params: URLSearchParams): { to: string; school: string; city: CityId; shot: string } {
  const to = clean(params.get('to'), 40);
  const school = clean(params.get('school'), 60);
  const cityParam = clean(params.get('city'), 20).toLowerCase() as CityId;
  const city: CityId = CITY_ORDER.includes(cityParam) ? cityParam : 'madrid';
  const shot = clean(params.get('shot'), 20).toLowerCase();
  return { to, school, city, shot: (EMAIL_SHOT.options as readonly string[]).includes(shot) ? shot : '' };
}

/** The app's brand card with the prospect's name where Dina's is. */
function MockBrand({ name }: { name: string }) {
  const size = 104;
  const dinaH = (size * DINA_VIEWBOX.h) / DINA_VIEWBOX.w;
  const cardTop = Math.round(dinaH * DINA_CARD_LINE);
  return (
    <div className="relative w-72 max-w-full" style={{ paddingTop: cardTop }} data-testid="pitch-brand">
      <div className="absolute top-0 z-0" style={{ right: 12 }} aria-hidden><DinaArt size={size} expression="beam" animate={false} /></div>
      <div className="relative z-10 rounded-3xl p-5 text-left shadow-soft ring-1" style={{ background: BRAND.cream, boxShadow: `0 1px 0 ${BRAND.gold}55, 0 10px 24px -14px ${BRAND.terracottaDark}66`, ['--tw-ring-color' as string]: `${BRAND.gold}66` }}>
        <span className="block font-display italic" style={{ color: BRAND.olive, fontSize: 14 }}>Learning with</span>
        <span className="block break-words font-display font-semibold tracking-tight" style={{ color: BRAND.terracotta, fontSize: name.length > 14 ? 26 : 34, lineHeight: 1 }}>{name}<span style={{ color: BRAND.gold }}>.</span></span>
        <span className="mt-2 block h-px w-12" style={{ background: BRAND.gold }} aria-hidden />
        <span className="mt-2 block font-display text-[13px] italic leading-snug" style={{ color: BRAND.ink }} lang="es">Tu vida en español empieza aquí</span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: BRAND.olive }}>Your Spanish life starts here</span>
      </div>
    </div>
  );
}

const SAMPLE_WEEK = [
  { day: 'Mon', title: 'Verb gym: querer, poder (present)', note: 'Consolidate what we did in the lesson', done: true },
  { day: 'Wed', title: 'Penalty Shoot-out: querer, poder', note: 'A fast one: beat the keeper with the right forms', game: true },
  { day: 'Fri', title: 'Ser o Estar game', note: 'The same decision, faster' },
  { day: 'Sat', title: 'Storyline: Café La Plaza', note: 'Your next chapter. Speak the replies out loud.' },
];

const TUTOR_SHOTS = [
  { src: 'pitch/plan.png', w: 1120, h: 718, title: 'The two-minute debrief drafts the week', body: 'Tick what went well and what to work on; the week’s tasks appear with days and due times, editable before they go out.' },
  { src: 'pitch/tutor.png', w: 1120, h: 718, title: 'Today, before it happens', body: 'Lessons, homework due, who has gone quiet, and a nudge when an invoice is due.' },
  { src: 'pitch/analytics.png', w: 840, h: 808, title: 'Analytics and a PDF report per student', body: 'Accuracy by exercise type, mistakes by type, minutes, streaks and the trend over eight weeks. One click makes the parent report.' },
  { src: 'pitch/invoices.png', w: 1120, h: 752, title: 'Invoices and lesson packages', body: 'Taught lessons become a numbered PDF invoice in one click. Packages count down and warn you when a balance runs low.' },
];

export function PitchScreen({ params }: { params: URLSearchParams }) {
  const { to, school, city, shot } = useMemo(() => pitchParams(params), [params]);
  const theme = CITY_THEMES[city];
  const football = FOOTBALL[city];
  const [club, rival] = football.clubs;
  const words = footballWords(theme.variety);
  const brand = school || to;
  const whose = school ? `${school}’s` : 'your';
  const topRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<HTMLDivElement>(null);
  const shotOk = shot ? shot === EMAIL_SHOT.answer : null;

  useEffect(() => {
    const prev = document.title;
    document.title = to ? `${to}, this is your app · Learning with Dina` : 'Your own learning app · Learning with Dina';
    return () => { document.title = prev; };
  }, [to]);

  // Arriving from the email's penalty: land on the result, not the top of the page.
  useEffect(() => {
    if (shot) window.setTimeout(() => gameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
  }, [shot]);

  const subject = `Walkthrough for ${school || (to ? `${to}’s students` : 'my students')}`;
  const book = PITCH.bookingUrl || (PITCH.senderEmail ? `mailto:${PITCH.senderEmail}?subject=${encodeURIComponent(subject)}` : '');
  const toGame = () => gameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const BookButton = ({ dark = false }: { dark?: boolean }) =>
    book ? (
      <a className={dark ? 'btn bg-white text-ink hover:bg-cream-100' : 'btn-primary'} href={book} target={PITCH.bookingUrl ? '_blank' : undefined} rel={PITCH.bookingUrl ? 'noopener' : undefined} data-testid="pitch-book">
        <Icon name="calendar" size={18} /> Book a 30-minute walkthrough
      </a>
    ) : (
      <p className={`text-sm ${dark ? 'text-cream/90' : 'text-ink-soft'}`} data-testid="pitch-book">Reply to {PITCH.senderName}’s email and we will find thirty minutes for a walkthrough.</p>
    );

  return (
    <div ref={topRef} className="min-h-[100dvh] bg-cream-warm text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
        <button type="button" onClick={() => navigate('home')} className="text-left leading-none" aria-label="Learning with Dina, home">
          <span className="block font-display text-xs italic" style={{ color: BRAND.olive }}>Learning with</span>
          <span className="block font-display text-2xl font-semibold tracking-tight" style={{ color: BRAND.terracotta }}>Dina<span style={{ color: BRAND.gold }}>.</span></span>
        </button>
        <button type="button" className="ctrl" onClick={() => navigate('demo')} data-testid="pitch-demo">See the full demonstration <Icon name="arrowRight" size={14} /></button>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        {/* Hero */}
        <section className="grid items-center gap-8 py-8 md:grid-cols-[1.2fr_1fr] md:py-12">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <p className="eyebrow">{to ? `A page made for ${to}` : 'A page made for you'}</p>
            <h1 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl" data-testid="pitch-title">
              {to ? `Hi ${to}, ` : ''}this is what {school ? `${school}’s` : 'your'} own app could look like.
            </h1>
            <p className="mt-4 max-w-prose text-lg text-ink-soft">
              A Spanish-learning app in your name and colours, with your own tutor character. Homework that adapts to each lesson, games your students want to play, invoices and lesson packages built in. Dina’s copy is live with real students; yours would be set up in {PITCH.setupTime}.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <BookButton />
              <button type="button" className="btn-ghost" onClick={toGame}><Icon name="play" size={16} filled /> Take a penalty first</button>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="justify-self-center">
            <MockBrand name={brand || 'Dina'} />
            <p className="mt-3 text-center text-xs text-ink-mute">{brand ? 'Your name on the card, your character behind it.' : 'Your name would go where Dina’s is.'}</p>
          </motion.div>
        </section>

        {/* The penalty */}
        <section ref={gameRef} className="scroll-mt-4 py-6">
          <div className="card overflow-hidden">
            <div className="bg-olive p-5 text-white sm:p-6">
              <p className="eyebrow !text-white/80">Tanda de penaltis · Take a penalty</p>
              <h2 className="mt-1 font-display text-3xl font-semibold">{whose === 'your' ? 'Your' : `${school}’s`} students in {theme.name} would play for {club.name}</h2>
              <p className="mt-2 max-w-prose text-sm text-white/90">
                Every correct verb form beats {rival.short}’s {words.keeper}. The Spanish changes with the city too: here a penalty is “{words.penalty}” and the fans are “{words.fans}”.
              </p>
              {shot && (
                <p className={`mt-4 rounded-2xl p-4 text-base font-semibold ${shotOk ? 'bg-saffron text-ink' : 'bg-white text-ink'}`} role="status" data-testid="pitch-shot-result">
                  {shotOk
                    ? <>¡GOL! <i>{EMAIL_SHOT.pronoun} {EMAIL_SHOT.answer}</i>. You beat the keeper from your inbox. Now try a full round.</>
                    : <>¡Parada! You shot “{shot}”; it was “{EMAIL_SHOT.answer}” ({EMAIL_SHOT.pronoun} + {EMAIL_SHOT.verb}, {EMAIL_SHOT.en}). The keeper read it. Have another go below.</>}
                </p>
              )}
            </div>
            <div className="p-4 sm:p-6">
              <Penalty city={city} region={theme.variety} onExit={() => topRef.current?.scrollIntoView({ behavior: 'smooth' })} />
              <p className="mt-4 text-center text-xs text-ink-mute">This is the real game your students would get, with their city’s club. The score stays in your browser; nothing is sent anywhere.</p>
            </div>
          </div>
        </section>

        {/* What students see */}
        <section className="py-8">
          <p className="eyebrow">Los alumnos · The students</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">What {whose} students would see</h2>
          <p className="mt-2 max-w-prose text-ink-soft">The week you set after the lesson, on their phone, installed like an app. Every task is a game or a scene, and the result reaches you the moment they finish.</p>
          <div className="mt-6 grid items-start gap-6 md:grid-cols-[1.4fr_1fr]">
            <div className="card overflow-hidden" data-testid="pitch-plan">
              <div className="bg-saffron-50 p-5">
                <p className="eyebrow">Esta semana con {brand || 'Dina'} · This week with {brand || 'Dina'}</p>
                <p className="mt-1 text-sm">Great lesson today. Ser and estar are nearly there, so this week is short daily practice, then the café chapter so you can order like a local.</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {['Use ser and estar correctly when speaking', 'Present tense: querer, poder'].map((g) => <li key={g} className="rounded-full bg-white px-3 py-1 text-xs font-semibold">{g}</li>)}
                </ul>
              </div>
              <div className="p-5">
                <div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold">1/4 done</span><span className="text-ink-mute">this week</span></div>
                <ul className="grid gap-2">
                  {SAMPLE_WEEK.map((h) => (
                    <li key={h.day} className={`flex items-center gap-3 rounded-2xl p-3 text-sm ${h.done ? 'bg-olive-50' : 'bg-cream-100'}`}>
                      <span className="w-9 shrink-0 rounded-lg bg-white px-1.5 py-1 text-center text-xs font-bold">{h.day}</span>
                      <div className="min-w-0 flex-1"><p className="font-semibold">{h.title}</p><p className="text-xs text-ink-mute">{h.note}</p></div>
                      {h.done ? <Icon name="check" size={16} className="text-olive" aria-label="done" /> : h.game ? <button type="button" className="btn-dark !py-1.5 !text-xs" onClick={toGame}>Start</button> : null}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-mute">Written by the tutor in two minutes after the lesson. During the week the app adds a shorter retry under 60% and a stretch task over 90%.</p>
              </div>
            </div>
            <figure className="justify-self-center">
              <img src="pitch/phone.png" alt="The student app on a phone: the next lesson and this week’s homework" width={520} height={1125} loading="lazy" className="w-56 rounded-[28px] shadow-lift ring-1 ring-ink/10" />
              <figcaption className="mt-2 text-center text-xs text-ink-mute">Seven games, seven city storylines, verbs and spaced review.</figcaption>
            </figure>
          </div>
        </section>

        {/* What the tutor sees */}
        <section className="py-8">
          <p className="eyebrow">El profesor · The tutor</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">What you would see</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {TUTOR_SHOTS.map((s) => (
              <figure key={s.src} className="card overflow-hidden">
                <img src={s.src} alt={s.title} width={s.w} height={s.h} loading="lazy" className="w-full border-b border-ink/10 bg-cream-100 object-cover" />
                <figcaption className="p-5"><p className="font-display text-xl font-semibold">{s.title}</p><p className="mt-1 text-sm text-ink-soft">{s.body}</p></figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-4 max-w-prose text-sm text-ink-soft">If there is more than one tutor, an admin seat sits over everything: every account and everyone’s activity in one view. Branded PDF how-to guides for you and for students are included.</p>
        </section>

        {/* How it starts */}
        <section className="py-8">
          <p className="eyebrow">Cómo empieza · How it starts</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">Three steps, no technical work on your side</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ['A thirty-minute walkthrough', 'With your students’ names loaded, so you see a real week plan for one of them.'],
              [`Your copy, in ${PITCH.setupTime}`, 'Your name, colours and character; your tutor and admin accounts; the guides; your first students loaded.'],
              ['Your first debrief', 'After your next lesson you tick what went well and what to work on, and the week appears.'],
            ].map(([t, b], i) => (
              <li key={t} className="card p-5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-terracotta font-display text-lg font-semibold text-white" aria-hidden>{i + 1}</span>
                <p className="mt-3 font-display text-xl font-semibold">{t}</p>
                <p className="mt-1 text-sm text-ink-soft">{b}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Pricing */}
        <section className="py-8">
          <p className="eyebrow">Precios · Pricing</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">Simple pricing</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-5">
              <p className="eyebrow">Set-up</p>
              <p className="mt-1 font-display text-4xl font-semibold">{PITCH.setupFee}</p>
              <p className="text-sm text-ink-mute">one-off</p>
              <ul className="mt-3 grid gap-1 text-sm text-ink-soft">{['Your name, colours and character', 'Tutor, admin and student seats', 'Branded PDF guides', 'Onboarding call, first students loaded'].map((l) => <li key={l}>{l}</li>)}</ul>
            </div>
            {PITCH.tiers.map((t) => (
              <div key={t.name} className={`card p-5 ${t.popular ? 'ring-2 ring-terracotta' : ''}`}>
                <div className="flex items-center justify-between gap-2"><p className="eyebrow">{t.name}</p>{t.popular && <span className="rounded-full bg-saffron px-2.5 py-0.5 text-[11px] font-bold">Most popular</span>}</div>
                <p className="mt-1 font-display text-4xl font-semibold">{t.price}</p>
                <p className="text-sm text-ink-mute">{t.per}</p>
                <ul className="mt-3 grid gap-1 text-sm text-ink-soft">{t.lines.map((l) => <li key={l}>{l}</li>)}</ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-mute">Annual plans: two months free. Thirty-day money-back on the subscription.</p>
        </section>

        {/* The ask */}
        <section className="py-8">
          <div className="rounded-4xl bg-ink p-6 text-cream sm:p-10">
            <p className="eyebrow !text-cream/70">El siguiente paso · Next step</p>
            <h2 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">See it with {whose} students’ names in it.</h2>
            <p className="mt-3 max-w-prose text-cream/90">Thirty minutes, your real students loaded, and you watch the week plan appear for one of them. If it is not for you, you have lost half an hour and gained a free penalty shoot-out.</p>
            <div className="mt-6"><BookButton dark /></div>
          </div>
          <p className="mt-6 text-center text-xs text-ink-mute">
            {to ? `Made for ${to} by ${PITCH.senderName}. ` : `Made by ${PITCH.senderName}. `}
            This page runs on your device: the game keeps its score in your browser and nothing is sent anywhere. <button type="button" className="font-semibold text-olive underline-offset-2 hover:underline" onClick={() => navigate('privacy')}>Privacy</button>
          </p>
        </section>
      </main>
    </div>
  );
}
