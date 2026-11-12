import { Icon } from '../components/Icon';
import { PageHeader } from '../components/ui';
import { useAccount } from '../lib/account';
import { cloudConfigured } from '../lib/cloud';
import { usePlatform } from '../lib/platform/context';
import { navigate } from '../lib/router';

// How to use Learning with Dina: one guide for the teacher, one for students.

const TEACHER: { title: string; steps: string[] }[] = [
  { title: '1. Your account', steps: ['Create the account with the username "dina" (the teacher username). Keep your recovery code somewhere safe: it is the only way to reset your password without email.', 'Log in on any device: the Students, Calendar and Homework pages are the same everywhere.'] },
  { title: '2. Add your students', steps: ['Students → Add a student: first name, a username and (optionally) a password. If you leave the password empty the app makes a simple temporary one.', 'The login details and recovery code are shown once. Pass them on privately; students can change the password in their settings.', 'Anyone who registers on the app themselves also appears in your list automatically.'] },
  { title: '3. After each lesson: the debrief', steps: ['Open the student → Lesson debrief & week plan. Tick the tenses and verbs you covered, the themes you talked about, what to fix, and write a short note for the student.', 'Add up to three goals and the minutes a day to aim for, then Generate the week’s plan.', 'The plan is built from your notes and the student’s own data (the verbs they get wrong, their next storyline chapter, their interests). Remove or move anything, then Send.'] },
  { title: '4. How the app adapts during the week', steps: ['Under 60% on a task → a shorter re-try appears two days later.', '90% or more on a verb drill → a stretch task in the next tense.', 'Spaced repetition keeps bringing back the words and verbs the student forgets, in every game and review.'] },
  { title: '5. Lessons, homework and feedback', steps: ['Book lessons from Today, Calendar or the student’s profile; clashes are refused. Students see the time in their own time zone.', 'Homework → review each submission, read the written or spoken answer, and leave feedback. Students see it on their home page.', 'Feedback tab: comments, corrections and recommendations outside the weekly plan.'] },
  { title: '6. Invoices', steps: ['Invoices → Rates & payment details once: currency, rate for a 60-minute lesson, days until due, and how students pay (bank details or a payment link).', 'New invoice: pick the student, tick the lessons you have taught that are not yet billed, add any other line, then Save and send. The student sees it in their app at once; use Email or PDF as well if you like.', 'Mark paid when the money arrives. Overdue invoices show on your Today page.', 'Packages: define them under Rates & payment details, then Sell a package to a student (the invoice is created for you). Every lesson you teach from the purchase date uses one credit; the balance shows on the Students page, the profile and the student’s home page, and Today flags anyone down to their last lesson.'] },
  { title: '7. Progress and reports', steps: ['Journey and Analytics tabs: consistency, accuracy by exercise, mistakes by type with real examples, tenses, vocabulary, homework.', 'Download PDF report per student, or Class summary (CSV) from the Students page for a spreadsheet.'] },
];

const STUDENT: { title: string; steps: string[] }[] = [
  { title: '1. Log in', steps: ['Use the username and password Dina gave you (or create an account; Dina will see you). Save the recovery code it shows you.', 'Your progress saves automatically and follows you to any device. It also works offline.'] },
  { title: '2. Your home page: My lessons', steps: ['Next lesson, with the time in your time zone and the meeting link or address.', '"This week with Dina": her notes from the lesson, the goals, and the week’s tasks day by day. Tap Start on a task; it opens the real activity.', 'Her feedback on your homework appears here and on the Feedback page.'] },
  { title: '3. Doing the work', steps: ['Verb gym: type the forms; use "Help me remember" when something will not stick, it stays in your memory deck.', 'Games: Penalty Shoot-out (verbs), The Derby Quiz (football words of your city), Line-up (listening), Metro Rush, Order Up!, ¿Sí o no?, Ser o Estar.', 'Storyline chapters: live your city in Spanish; speak your replies out loud.', 'Written and speaking homework: write in the editor or record yourself; the recording stays on your device unless you share it.'] },
  { title: '4. The app adapts to you', steps: ['Score under 60% and a shorter re-try appears two days later. Score 90%+ on verbs and a stretch task appears.', 'Memory review brings back exactly the words you are about to forget. Ten minutes a day beats an hour once a week.'] },
  { title: '5. Invoices', steps: ['Dina’s invoices for your lessons appear under Invoices on your lessons pages, and a banner on your home page says when something is due.', 'Open an invoice to see how to pay and download the PDF. Use the invoice number as the payment reference.', 'If you buy a lesson package, your home page shows your lesson balance: used, left, booked, and the valid-until date.'] },
  { title: '6. Your journey', steps: ['My journey shows your level per skill, study days, trends and the slips you make most, all from what you actually did.', 'Settings: voice, speech speed, translations, your city and your account (change password, log out).'] },
];

/** Short guided videos for students, with a spoken voiceover: Dina and Toby walk through each task. Files live in public/guides/videos (made by scripts/videos). */
const VIDEOS: { file: string; title: string; about: string; seconds: number }[] = [
  { file: '1-getting-started', title: 'Getting started', about: 'Log in and put the app on your iPhone.', seconds: 53 },
  { file: '2-your-lessons', title: 'Your lessons', about: 'Your next lesson and what to prepare.', seconds: 37 },
  { file: '3-your-homework', title: 'Your homework', about: 'Find it, do it, read the feedback.', seconds: 38 },
  { file: '4-practise-on-your-own', title: 'Practise on your own', about: 'Verbs, word packs and games.', seconds: 58 },
  { file: '5-feedback-and-progress', title: 'Feedback and progress', about: 'What Dina said and how far you have come.', seconds: 48 },
  { file: '6-invoices', title: 'Invoices', about: 'What is due and how to say you have paid.', seconds: 52 },
];

function VideoGuides() {
  const base = `${import.meta.env.BASE_URL}guides/videos/`;
  return (
    <section className="card mb-4 p-5" data-testid="guide-videos">
      <p className="eyebrow">Vídeos · Watch how</p>
      <h2 className="mt-1 font-display text-2xl font-semibold">Dina and Toby show you</h2>
      <p className="mt-1 text-sm text-ink-soft">Six short videos, under a minute each, with sound. Dina talks you through each step and Toby shows you where to tap. Watch here or download one to keep or send on.</p>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {VIDEOS.map((v, i) => (
          <li key={v.file} className="flex min-w-0 flex-col overflow-hidden rounded-2xl bg-cream-100">
            <video className="aspect-[390/844] w-full bg-cream-200" controls playsInline preload="none" poster={`${base}${v.file}.jpg`} aria-label={`${v.title}: ${v.about}`} data-testid={`video-${i + 1}`}>
              <source src={`${base}${v.file}.mp4`} type="video/mp4" />
            </video>
            <div className="flex flex-1 flex-col gap-1 p-3">
              <p className="text-sm font-semibold leading-tight">{i + 1}. {v.title}</p>
              <p className="text-xs text-ink-mute">{v.about} · {v.seconds}s</p>
              <a className="ctrl mt-auto w-fit !py-1.5 !text-xs" href={`${base}${v.file}.mp4`} download={`Learning-with-Dina-${v.file}.mp4`} data-testid={`video-download-${i + 1}`}><Icon name="download" size={12} /> Download</a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Guide() {
  const { me } = usePlatform();
  const account = useAccount();
  const forced = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('for');
  const teacher = forced ? forced === 'teacher' : me?.role === 'teacher';
  const sections = teacher ? TEACHER : STUDENT;
  const other = teacher ? 'student' : 'teacher';
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Cómo se usa · How to use" title={teacher ? 'Guide for Dina' : 'Guide for students'} subtitle={teacher ? 'From adding a student to sending the week’s plan after each lesson.' : 'Logging in, this week’s tasks, and how the app adapts to you.'} />
      {!teacher && <VideoGuides />}
      <div className="grid gap-4">
        {sections.map((s) => (
          <section key={s.title} className="card p-5">
            <h2 className="font-display text-2xl font-semibold">{s.title}</h2>
            <ol className="mt-2 grid gap-1.5 text-sm text-ink-soft">{s.steps.map((st, i) => <li key={i} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-olive" /> <span>{st}</span></li>)}</ol>
          </section>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => navigate(teacher ? 'teach' : account.session ? 'student' : cloudConfigured ? 'account?mode=login' : 'home')}>{teacher ? 'Go to Today' : account.session ? 'Go to my lessons' : 'Log in'} <Icon name="arrowRight" size={16} /></button>
        <button className="ctrl" onClick={() => navigate(`guide?for=${other}`)}>Read the {other} guide</button>
        <a className="ctrl" href={`${import.meta.env.BASE_URL}guides/${teacher ? 'teacher' : 'student'}-guide.pdf`} target="_blank" rel="noreferrer"><Icon name="download" size={14} /> Download this guide as a PDF</a>
      </div>
    </div>
  );
}
