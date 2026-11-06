// STUB — replaced by the teacher-dashboard implementation.
export function TeacherApp({ page, id, params }: { page?: string; id?: string; params: URLSearchParams }) {
  void params;
  return <div className="card p-6">Teacher dashboard ({page ?? 'home'}{id ? ` / ${id}` : ''}) — coming up.</div>;
}
