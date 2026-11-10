import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { PageHeader, Sheet } from '../../components/ui';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { bucket, daysOverdue, money, summarise } from '../../lib/platform/invoicing';
import { BalanceCard, useBalance } from '../teach/Packages';
import type { Invoice } from '../../lib/platform/types';
import { InvoiceView } from '../teach/Invoices';
import { DemoChip, Loading, Section, StudentNav } from './shared';

/** The student's invoices from Dina: what is due, how to pay, PDF download. */
export function InvoicesPage() {
  const { me } = usePlatform();
  const invoices = usePlatformQuery((b) => b.invoices());
  const config = usePlatformQuery((b) => b.teacherConfig());
  const { balance } = useBalance(me?.id);
  const [open, setOpen] = useState<Invoice | null>(null);
  const list = invoices.data ?? [];
  const s = summarise(list);
  const pdf = async (inv: Invoice) => { const { downloadInvoicePdf } = await import('../../lib/invoicePdf'); downloadInvoicePdf(inv, config.data!, me?.firstName ?? 'Student', 'Dina'); };
  return (
    <div data-testid="student-invoices">
      <PageHeader eyebrow="Facturas · Invoices" title="My invoices" subtitle="Invoices from Dina for your lessons, with how to pay." right={<DemoChip />} />
      <StudentNav page="invoices" />
      {!invoices.data || !config.data ? <Loading what="your invoices" /> : (
        <>
          {s.outstanding > 0 && <div className={`mb-4 rounded-2xl p-4 text-sm ${s.overdue ? 'bg-terracotta-50' : 'bg-saffron-50'}`} data-testid="invoice-due"><b>{money(s.outstanding, config.data.currency)} to pay</b>{s.overdue ? ` · ${money(s.overdue, config.data.currency)} is overdue` : ''}. Open an invoice to see how to pay.</div>}
          {balance?.hasPackages && <div className="mb-4"><BalanceCard balance={balance} currency={config.data.currency} /></div>}
          <Section title="Invoices" eyebrow={list.length ? `${list.length} total` : undefined}>
            {list.length === 0 ? <p className="text-sm text-ink-mute">No invoices yet.</p> : (
              <ul className="grid gap-2">
                {list.map((inv) => { const b = bucket(inv); const od = daysOverdue(inv); return (
                  <li key={inv.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-cream-100 p-3 text-sm">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${b === 'paid' ? 'bg-olive-50 text-olive' : b === 'overdue' ? 'bg-terracotta-50 text-terracotta-dark' : b === 'void' ? 'bg-cream-200 text-ink-mute' : 'bg-azul-50 text-azul'}`}>{b === 'outstanding' ? 'to pay' : b}{od ? ` · ${od} d` : ''}</span>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(inv)}><span className="font-semibold">{inv.number}</span> <span className="text-ink-mute">· issued {inv.issuedAt} · due {inv.dueAt}</span><span className="block truncate text-xs text-ink-mute">{inv.lines.map((l) => l.description).join(' · ')}</span></button>
                    <span className="font-display text-xl font-semibold tabular-nums">{money(inv.total, inv.currency)}</span>
                    <button type="button" className="ctrl !py-1.5 !text-xs" onClick={() => pdf(inv)}><Icon name="download" size={12} /> PDF</button>
                  </li>
                ); })}
              </ul>
            )}
          </Section>
        </>
      )}
      {open && <Sheet open onClose={() => setOpen(null)} title={open.number}><InvoiceView inv={open} studentName={me?.firstName ?? 'You'} /><div className="mt-4 flex gap-2"><button type="button" className="btn-primary" onClick={() => pdf(open)}><Icon name="download" size={16} /> Download PDF</button><button type="button" className="ctrl" onClick={() => setOpen(null)}>Close</button></div></Sheet>}
    </div>
  );
}
