// STUB — replaced by the student-dashboard implementation.
export function StudentApp({ page, params }: { page?: string; params: URLSearchParams }) {
  void params;
  return <div className="card p-6">Student dashboard ({page ?? 'home'}) — coming up.</div>;
}
export function HomeworkRunner({ id }: { id: string }) {
  return <div className="card p-6">Homework runner for {id} — coming up.</div>;
}
