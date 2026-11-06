import { Icon } from '../../components/Icon';
import { Empty, PageHeader } from '../../components/ui';
import { usePlatform } from '../../lib/platform/context';
import type { Homework } from '../../lib/platform/types';
import { navigate } from '../../lib/router';
import { DemoChip, ErrorCard, HomeworkCard, Loading, StudentNav, homeworkBuckets, useStudentData } from './shared';

// ───────────────────────────────────────────────────────────────
// Student homework — To do / Submitted / Reviewed.
// ───────────────────────────────────────────────────────────────

function Group({ title, hint, items, now, empty, highlight }: { title: string; hint: string; items: Homework[]; now: number; empty: string; highlight?: string | null }) {
  return (
    <section className="mt-7 first:mt-0" aria-labelledby={`hw-group-${title}`}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
        <h2 id={`hw-group-${title}`} className="text-xl font-semibold">{title} <span className="text-base font-medium text-ink-mute">{items.length}</span></h2>
        <span className="text-sm text-ink-mute">{hint}</span>
      </div>
      {items.length ? <div className="grid gap-3 lg:grid-cols-2">{items.map((h, i) => <HomeworkCard key={h.id} h={h} now={now} index={i} highlight={h.id === highlight} />)}</div> : <p className="text-sm text-ink-mute">{empty}</p>}
    </section>
  );
}

export function HomeworkPage({ params }: { params: URLSearchParams }) {
  const { backend } = usePlatform();
  const { data, loading, error, reload } = useStudentData();
  const now = Date.now();
  const done = params.get('done');
  const buckets = data ? homeworkBuckets(data.homework, now) : null;
  const justDone = done && data?.homework.find((h) => h.id === done);

  return (
    <div data-testid="student-homework">
      <PageHeader eyebrow="Deberes · Homework" title="My homework" subtitle="What Dina has set, what’s waiting for her feedback, and what she has already reviewed." right={<DemoChip />} />
      <StudentNav page="homework" />
      {justDone && (
        <div role="status" className="mb-5 flex items-center gap-3 rounded-3xl bg-olive-50 p-4 text-sm ring-1 ring-olive/30" data-testid="hw-done-banner">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-olive text-white" aria-hidden><Icon name="check" size={18} /></span>
          <span><b>Homework submitted:</b> {justDone.activity.title}. {backend?.kind === 'demo' ? 'Saved on this device — switch to Dina in the Demo menu to see it on her dashboard.' : 'Dina will see it on her dashboard.'}</span>
        </div>
      )}
      {error && <ErrorCard error={error} retry={reload} />}
      {!error && loading && !data && <Loading what="your homework" />}
      {buckets && !data?.homework.length && (
        <Empty icon="book" title="No homework yet" body="When Dina assigns something, it appears here with her instructions and a deadline." action={<button className="btn-ghost" onClick={() => navigate('student')}><Icon name="arrowLeft" size={16} /> Back to overview</button>} />
      )}
      {buckets && data?.homework.length ? (
        <>
          <Group title="To do" hint="Sorted by deadline" items={buckets.todo} now={now} empty="Nothing to do right now — nice." highlight={done} />
          <Group title="Submitted" hint="Waiting for Dina’s feedback" items={buckets.submitted} now={now} empty="Nothing waiting for feedback." highlight={done} />
          <Group title="Reviewed" hint="With Dina’s feedback" items={buckets.reviewed} now={now} empty="Nothing reviewed yet." highlight={done} />
        </>
      ) : null}
    </div>
  );
}
