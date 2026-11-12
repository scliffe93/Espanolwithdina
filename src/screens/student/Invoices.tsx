import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { PageHeader, Sheet } from '../../components/ui';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { bucket, daysOverdue, money, summarise } from '../../lib/platform/invoicing';
import { BalanceCard, useBalance } from '../teach/Packages';
import type { Invoice } from '../../lib/platform/types';
import { InvoiceView } from '../teach/Invoices';
import { useStore } from '../../lib/store';
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
                    {inv.status === 'sent' && <div className="w-full"><ReportPaid inv={inv} onDone={invoices.reload} /></div>}
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

const METHODS = ['Bank transfer', 'Cash', 'Card', 'PayPal', 'Other'];
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** "I've paid this": the student tells Dina an invoice is paid. She still confirms it, so the invoice stays "to pay" until she does. */
function ReportPaid({ inv, onDone }: { inv: Invoice; onDone: () => void }) {
  const { backend } = usePlatform();
  const { notify } = useStore();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState(METHODS[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = inv.paymentReported;
  if (r && !open) {
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-xl bg-olive-50 px-3 py-2 text-xs text-olive" data-testid={`reported-${inv.number}`}>
        <Icon name="check" size={14} /> <span><b>You told Dina you paid this</b> on {shortDate(r.at)}{r.method ? ` by ${r.method.toLowerCase()}` : ''}. It shows as paid once she confirms it.</span>
      </p>
    );
  }
  if (!open) return <button type="button" className="btn-dark !py-1.5 !text-xs" onClick={() => setOpen(true)} data-testid={`report-paid-${inv.number}`}><Icon name="check" size={12} /> I’ve paid this</button>;
  const send = async () => {
    if (!backend) return;
    setBusy(true); setError(null);
    try {
      await backend.reportInvoicePaid(inv.id, { method, note });
      notify('Dina has been told', `She will confirm ${inv.number} once she has checked the payment.`);
      setOpen(false); onDone();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send that. Please try again.'); }
    setBusy(false);
  };
  return (
    <div className="grid gap-2 rounded-2xl bg-white p-3 ring-1 ring-ink/10" data-testid={`report-form-${inv.number}`}>
      <p className="text-sm font-semibold">Tell Dina you have paid {inv.number}</p>
      <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
        <label className="grid gap-1 text-xs font-medium">How you paid
          <select className="input !py-1.5 text-sm" value={method} onChange={(e) => setMethod(e.target.value)} data-testid="report-method">{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
        </label>
        <label className="grid gap-1 text-xs font-medium">Note for Dina (optional)
          <input className="input !py-1.5 text-sm" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. sent this morning, reference LWD-2026-0007" data-testid="report-note" />
        </label>
      </div>
      {error && <p className="text-xs text-terracotta-dark" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary !py-1.5 !text-xs" disabled={busy} onClick={send} data-testid="report-send">{busy ? 'Sending…' : 'Tell Dina'}</button>
        <button type="button" className="ctrl !py-1.5 !text-xs" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <p className="text-[11px] text-ink-mute">This lets Dina know. The invoice stays “to pay” until she confirms the money has arrived.</p>
    </div>
  );
}
