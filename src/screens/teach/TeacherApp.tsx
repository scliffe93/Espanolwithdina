import { Calendar } from './Calendar';
import { HomeworkPage } from './HomeworkPage';
import { Invoices } from './Invoices';
import { StudentProfile } from './StudentProfile';
import { Students } from './Students';
import { Today } from './Today';

/**
 * Dina's teacher dashboard. Routes (see App.tsx):
 *   teach                → Today
 *   teach/calendar       → weekly / monthly teaching calendar
 *   teach/students       → both students at a glance
 *   teach/student/<id>   → one student's full profile (?tab=lessons|homework|feedback|activity)
 *   teach/homework       → all homework, awaiting review first
 */
export function TeacherApp({ page, id, params }: { page?: string; id?: string; params: URLSearchParams }) {
  switch (page) {
    case 'calendar': return <Calendar key="calendar" params={params} />;
    case 'students': return <Students key="students" />;
    case 'student': return id ? <StudentProfile key={id} id={id} params={params} /> : <Students key="students" />;
    case 'homework': return <HomeworkPage key="homework" params={params} />;
    case 'invoices': return <Invoices key="invoices" params={params} />;
    default: return <Today key="today" />;
  }
}
