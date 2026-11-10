import { Calendar } from './Calendar';
import { InvoicesPage } from './Invoices';
import { FeedbackPage } from './Feedback';
import { Home } from './Home';
import { HomeworkPage } from './Homework';

// ───────────────────────────────────────────────────────────────
// The student side of the teaching platform (route 'student').
//   student            → My lessons & homework (home)
//   student/calendar   → upcoming & previous lessons
//   student/homework   → to do / submitted / reviewed
//   student/feedback   → everything Dina has written
//   homework/<id>      → HomeworkRunner (performs written/speaking homework)
// ───────────────────────────────────────────────────────────────

export function StudentApp({ page, params }: { page?: string; params: URLSearchParams }) {
  switch (page) {
    case 'calendar': return <Calendar />;
    case 'homework': return <HomeworkPage params={params} />;
    case 'feedback': return <FeedbackPage />;
    case 'invoices': return <InvoicesPage />;
    default: return <Home />;
  }
}

export { HomeworkRunner } from './HomeworkRunner';
