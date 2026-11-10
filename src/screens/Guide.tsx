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
  { title: '6. Progress and reports', steps: ['Journey and Analytics tabs: consistency, accuracy by exercise, mistakes by type with real examples, tenses, vocabulary, homework.', 'Download PDF report per student, or Class summary (CSV) from the Students page for a spreadsheet.'] },
];

const STUDENT: { title: string; steps: string[] }[] = [
  { title: '1. Log in', steps: ['Use the username and password Dina gave you (or create an account; Dina will see you). Save the recovery code it shows you.', 'Your progress saves automatically and follows you to any device. It also works offline.'] },
  { title: '2. Your home page: My lessons', steps: ['Next lesson, with the time in your time zone and the meeting link or address.', '"This week with Dina": her notes from the lesson, the goals, and the week’s tasks day by day. Tap Start on a task; it opens the real activity.', 'Her feedback on your homework appears here and on the Feedback page.'] },
  { title: '3. Doing the work', steps: ['Verb gym: type the forms; use "Help me remember" when something will not stick, it stays in your memory deck.', 'Games: Penalty Shoot-out (verbs), The Derby Quiz (football words of your city), Line-up (listening), Metro Rush, Order Up!, ¿Sí o no?, Ser o Estar.', 'Storyline chapters: live your city in Spanish; speak your replies out loud.', 'Written and speaking homework: write in the editor or record yourself; the recording stays on your device unless you share it.'] },
  { title: '4. The app adapts to you', steps: ['Score under 60% and a shorter re-try appears two days later. Score 90%+ on verbs and a stretch task appears.', 'Memory review brings back exactly the words you are about to forget. Ten minutes a day beats an hour once a week.'] },
  { title: '5. Your journey', steps: ['My journey shows your level per skill, study days, trends and the slips you make most, all from what you actually did.', 'Settings: voice, speech speed, translations, your city and your account (change password, log out).'] },
];

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
