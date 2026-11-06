import { Icon } from '../../components/Icon';
import { Empty, PageHeader } from '../../components/ui';
import { browserZone, zoneLabel } from '../../lib/platform/time';
import type { Booking } from '../../lib/platform/types';
import { navigate } from '../../lib/router';
import { DemoChip, ErrorCard, LessonCard, Loading, StudentNav, bookingEnd, groupByMonth, useStudentData } from './shared';

// ───────────────────────────────────────────────────────────────
// Student calendar — upcoming and previous lessons, grouped by month.
// ───────────────────────────────────────────────────────────────

function MonthList({ bookings, now, eyebrow, empty }: { bookings: Booking[]; now: number; eyebrow: string; empty: string }) {
  const groups = groupByMonth(bookings);
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="eyebrow mb-1">{eyebrow} <span className="ml-1 normal-case tracking-normal text-ink-mute">· {bookings.length}</span></h2>
      {groups.length ? groups.map((g) => (
        <div key={g.key}>
          <h3 className="mb-2 mt-3 font-display text-xl font-semibold">{g.label}</h3>
          <ul className="grid gap-3">{g.items.map((b, i) => <LessonCard key={b.id} b={b} now={now} index={i} />)}</ul>
        </div>
      )) : <p className="mt-2 text-sm text-ink-mute">{empty}</p>}
    </section>
  );
}

export function Calendar() {
  const { data, loading, error, reload } = useStudentData();
  const now = Date.now();
  const upcoming = data ? data.bookings.filter((b) => new Date(bookingEnd(b)).getTime() > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt)) : [];
  const previous = data ? data.bookings.filter((b) => new Date(bookingEnd(b)).getTime() <= now).sort((a, b) => b.startsAt.localeCompare(a.startsAt)) : [];

  return (
    <div data-testid="student-calendar">
      <PageHeader eyebrow="Agenda · Lessons" title="My lessons" subtitle={`Times are shown in your time zone, ${zoneLabel(browserZone())}. Each lesson can be added to your own calendar.`} right={<DemoChip />} />
      <StudentNav page="calendar" />
      {error && <ErrorCard error={error} retry={reload} />}
      {!error && loading && !data && <Loading />}
      {data && !data.bookings.length && (
        <Empty icon="calendar" title="No lessons yet" body="When Dina books a lesson with you, it appears here with the time, the link or address and what to prepare." action={<button className="btn-ghost" onClick={() => navigate('student')}><Icon name="arrowLeft" size={16} /> Back to overview</button>} />
      )}
      {data && data.bookings.length > 0 && (
        <>
          <MonthList bookings={upcoming} now={now} eyebrow="Upcoming" empty="Nothing booked yet — Dina will add your next lesson." />
          <MonthList bookings={previous} now={now} eyebrow="Previous" empty="No past lessons yet." />
        </>
      )}
    </div>
  );
}
