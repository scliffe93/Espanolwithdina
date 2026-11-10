import { Icon } from '../../components/Icon';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { money, summarise } from '../../lib/platform/invoicing';
import { navigate } from '../../lib/router';

/** A one-line banner about money owed: for the teacher (what students owe her) or the student (what they owe). */
export function InvoiceNudge() {
  const { me } = usePlatform();
  const invoices = usePlatformQuery((b) => b.invoices());
  const config = usePlatformQuery((b) => b.teacherConfig());
  if (!invoices.data || !config.data) return null;
  const s = summarise(invoices.data);
  if (s.outstanding <= 0) return null;
  const teacher = me?.role === 'teacher' || me?.role === 'admin';
  const cur = config.data.currency;
  return (
    <button type="button" onClick={() => navigate(teacher ? 'teach/invoices' : 'student/invoices')} className={`mb-4 flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm ${s.overdue ? 'bg-terracotta-50' : 'bg-saffron-50'}`} data-testid="invoice-nudge">
      <Icon name="mail" size={16} className={s.overdue ? 'text-terracotta' : 'text-ink-soft'} />
      <span className="min-w-0 flex-1">
        <b>{money(s.outstanding, cur)} {teacher ? 'outstanding from students' : 'to pay'}</b>
        {s.overdue ? ` · ${money(s.overdue, cur)} overdue` : ''}{teacher ? ` · ${s.count.outstanding + s.count.overdue} invoice${s.count.outstanding + s.count.overdue === 1 ? '' : 's'}` : ' · open to see how to pay'}
      </span>
      <Icon name="arrowRight" size={14} />
    </button>
  );
}
