import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/ui';
import { usePlatformQuery } from '../../lib/platform/context';
import type { Homework } from '../../lib/platform/types';
import { HomeworkAssignForm } from './HomeworkAssignForm';
import { HomeworkReview } from './HomeworkReview';
import { DemoChip, HomeworkRow, Loading, Section, StudentPicker, useStudents, useViewZone } from './shared';

const GROUPS: { status: Homework['status']; title: string; eyebrow: string; empty: string }[] = [
  { status: 'submitted', title: 'Awaiting your review', eyebrow: 'Submitted', empty: 'Nothing waiting for review.' },
  { status: 'assigned', title: 'Assigned', eyebrow: 'In progress', empty: 'No open homework.' },
  { status: 'reviewed', title: 'Reviewed', eyebrow: 'Done', empty: 'No reviewed homework yet.' },
];

/** Every homework item across students, grouped by what needs Dina's attention first. */
export function HomeworkPage({ params }: { params: URLSearchParams }) {
  const [zone] = useViewZone();
  const students = useStudents();
  const homework = usePlatformQuery((b) => b.homework());
  const [filter, setFilter] = useState<string[]>(() => (params.get('student') ? [params.get('student')!] : []));
  const [assign, setAssign] = useState(false);
  const [review, setReview] = useState<Homework | null>(null);
  const people = students.data?.people ?? [];
  const list = (homework.data ?? []).filter((h) => !filter.length || filter.includes(h.studentId));
  const awaiting = list.filter((h) => h.status === 'submitted').length;

  return (
    <div>
      <PageHeader
        eyebrow="Deberes"
        title="Homework"
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">{homework.data ? `${awaiting} to review · ${list.filter((h) => h.status === 'assigned').length} in progress` : 'Loading…'} <DemoChip /></span>}
        right={<button type="button" className="btn-primary hidden sm:inline-flex" onClick={() => setAssign(true)}><Icon name="book" size={18} /> Assign homework</button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Show:</span>
        <button type="button" className="chip" aria-pressed={!filter.length} onClick={() => setFilter([])}>All students</button>
        <StudentPicker people={people} value={filter} onChange={setFilter} label="Filter by student" />
        <button type="button" className="btn-primary ml-auto !py-2 sm:hidden" onClick={() => setAssign(true)}><Icon name="book" size={16} /> Assign</button>
      </div>
      {!homework.data || !students.data ? <Loading label="Loading homework…" /> : (
        <div className="grid gap-4">
          {GROUPS.map((g) => {
            const items = list.filter((h) => h.status === g.status).sort((a, b) => (g.status === 'reviewed' ? b.dueAt.localeCompare(a.dueAt) : a.dueAt.localeCompare(b.dueAt)));
            return (
              <Section key={g.status} title={g.title} eyebrow={g.eyebrow} right={items.length ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${g.status === 'submitted' ? 'bg-saffron text-ink' : 'bg-cream-100 text-ink-soft'}`}>{items.length}</span> : undefined}>
                {items.length ? <div className="grid gap-2">{items.map((h) => <HomeworkRow key={h.id} h={h} people={people} zone={zone} onOpen={setReview} />)}</div> : <p className="text-sm text-ink-mute">{g.empty}</p>}
              </Section>
            );
          })}
        </div>
      )}
      <HomeworkAssignForm open={assign} onClose={() => setAssign(false)} people={people} progress={students.data?.progress ?? {}} initialStudentIds={filter.length ? filter : undefined} viewZone={zone} />
      <HomeworkReview homework={review} people={people} viewZone={zone} onClose={() => setReview(null)} />
    </div>
  );
}
