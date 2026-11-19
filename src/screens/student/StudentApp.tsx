import { Calendar } from './Calendar';
import { InvoicesPage } from './Invoices';
import { FeedbackPage } from './Feedback';
import { Home } from './Home';
import { HomeworkPage } from './Homework';
import { LearningPage } from './Learning';
import { StudentRoom } from '../room/StudentRoom';

// ───────────────────────────────────────────────────────────────
// The student side of the teaching platform (route 'student').
//   student            → My lessons & homework (home)
//   student/calendar   → upcoming & previous lessons
//   student/homework   → to do / submitted / reviewed
//   student/learning   → the learning bank: explanations Dina has shared, always there
//   student/feedback   → everything Dina has written
//   homework/<id>      → HomeworkRunner (performs written/speaking homework)
// ───────────────────────────────────────────────────────────────

export function StudentApp({ page, params }: { page?: string; params: URLSearchParams }) {
  if (page?.startsWith('room/')) return <StudentRoom key={page} id={page.slice(5)} />;
  switch (page) {
    case 'calendar': return <Calendar />;
    case 'homework': return <HomeworkPage params={params} />;
    case 'learning': return <LearningPage />;
    case 'feedback': return <FeedbackPage />;
    case 'invoices': return <InvoicesPage />;
    default: return <Home />;
  }
}

export { HomeworkRunner } from './HomeworkRunner';
