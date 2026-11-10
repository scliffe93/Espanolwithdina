import { Icon } from '../../components/Icon';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { money, summarise } from '../../lib/platform/invoicing';
import { balanceFor, balanceLabel, isLow } from '../../lib/platform/packages';
import { useStudents } from './shared';
import { navigate } from '../../lib/router';

/** A one-line banner about money owed: for the teacher (what students owe her) or the student (what they owe). */
export function InvoiceNudge() {
  const { me } = usePlatform();
  const teacher = me?.role === 'teacher' || me?.role === 'admin';
  const invoices = usePlatformQuery((b) => b.invoices());
  const config = usePlatformQuery((b) => b.teacherConfig());
  const students = useStudents();
  const bookings = usePlatformQuery((b) => (teacher ? b.bookings({ includeCancelled: true }) : Promise.resolve([])));
  const credits = usePlatformQuery((b) => (teacher ? b.credits() : Promise.resolve([])));
  if (!invoices.data || !config.data) return null;
  const s = summarise(invoices.data);
  const low = teacher ? (students.data?.people ?? []).map((p) => ({ p, bal: balanceFor(p.id, bookings.data ?? [], invoices.data!, credits.data ?? []) })).filter((x) => isLow(x.bal)) : [];
  const cur = config.data.currency;
  return (<>
    {low.length > 0 && (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-saffron-50 p-3 text-sm" data-testid="low-balance-nudge">
        <Icon name="star" size={16} className="text-ink-soft" />
        <b>{low.length === 1 ? `${low[0].p.firstName} is nearly out of lessons` : `${low.length} students are nearly out of lessons`}:</b>
        {low.map(({ p, bal }) => <button key={p.id} type="button" className="rounded-full bg-white px-3 py-1 text-xs font-semibold hover:bg-cream-100" onClick={() => navigate(`teach/student/${p.id}?tab=lessons`)}>{p.firstName} · {balanceLabel(bal)}</button>)}
      </div>
    )}
    {s.outstanding > 0 && (
    <button type="button" onClick={() => navigate(teacher ? 'teach/invoices' : 'student/invoices')} className={`mb-4 flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm ${s.overdue ? 'bg-terracotta-50' : 'bg-saffron-50'}`} data-testid="invoice-nudge">
      <Icon name="mail" size={16} className={s.overdue ? 'text-terracotta' : 'text-ink-soft'} />
      <span className="min-w-0 flex-1">
        <b>{money(s.outstanding, cur)} {teacher ? 'outstanding from students' : 'to pay'}</b>
        {s.overdue ? ` · ${money(s.overdue, cur)} overdue` : ''}{teacher ? ` · ${s.count.outstanding + s.count.overdue} invoice${s.count.outstanding + s.count.overdue === 1 ? '' : 's'}` : ' · open to see how to pay'}
      </span>
      <Icon name="arrowRight" size={14} />
    </button>
    )}
  </>);
}
