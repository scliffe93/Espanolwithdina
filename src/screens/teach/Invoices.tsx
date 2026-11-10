import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { PageHeader, Segmented, Sheet } from '../../components/ui';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { uid } from '../../lib/platform/backend';
import { addDaysIso, bucket, daysOverdue, invoiceNumber, invoiceText, lineForBooking, lineTotal, money, round2, summarise, total, unbilledLessons, type InvoiceBucket } from '../../lib/platform/invoicing';
import { mailtoHref } from '../../lib/report';
import type { Booking, Credit, Invoice, InvoiceLine, Person, TeacherConfig } from '../../lib/platform/types';
import { navigate } from '../../lib/router';
import { Field, Section, Stat, useAction, useStudents } from './shared';
import { PackageEditor, SellPackageSheet } from './Packages';

// ───────────────────────────────────────────────────────────────
// Invoices: Dina bills the lessons she has taught (or anything else),
// marks them paid, downloads a branded PDF or emails the summary.
// Students see their invoices in the app. No online payment: a payment
// link or bank details go in the settings and print on every invoice.
// ───────────────────────────────────────────────────────────────

type Filter = 'all' | InvoiceBucket;
const FILTERS: { value: Filter; label: string }[] = [{ value: 'all', label: 'All' }, { value: 'overdue', label: 'Overdue' }, { value: 'outstanding', label: 'Outstanding' }, { value: 'draft', label: 'Drafts' }, { value: 'paid', label: 'Paid' }, { value: 'void', label: 'Void' }];
const BUCKET_STYLE: Record<InvoiceBucket, string> = { draft: 'bg-cream-200 text-ink-soft', outstanding: 'bg-azul-50 text-azul', overdue: 'bg-terracotta-50 text-terracotta-dark', paid: 'bg-olive-50 text-olive', void: 'bg-cream-100 text-ink-mute line-through' };
const today = () => new Date().toISOString().slice(0, 10);

export function Invoices({ params }: { params: URLSearchParams }) {
  const { me } = usePlatform();
  const students = useStudents();
  const invoices = usePlatformQuery((b) => b.invoices());
  const bookings = usePlatformQuery((b) => b.bookings({ includeCancelled: false, to: new Date().toISOString() }));
  const config = usePlatformQuery((b) => b.teacherConfig());
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Invoice | 'new' | null>(params.get('new') ? 'new' : null);
  const [settings, setSettings] = useState(false);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [selling, setSelling] = useState(!!params.get('sell'));
  const credits = usePlatformQuery((b) => b.credits());
  const people = students.data?.people ?? [];
  const cfg = config.data;
  const list = invoices.data ?? [];
  const summary = useMemo(() => summarise(list), [list]);
  const shown = list.filter((i) => filter === 'all' || bucket(i) === filter);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.firstName ?? 'Student';
  const ready = invoices.data && config.data && students.data && bookings.data;

  return (
    <div>
      <PageHeader eyebrow="Facturas" title="Invoices" subtitle="Bill the lessons you have taught, mark them paid, download a PDF or email the summary. Students see their invoices in the app." right={<div className="flex flex-wrap gap-2"><button type="button" className="ctrl" onClick={() => setSettings(true)} data-testid="invoice-settings"><Icon name="settings" size={14} /> Rates &amp; payment details</button><button type="button" className="ctrl" onClick={() => setSelling(true)} data-testid="sell-package-top"><Icon name="star" size={14} /> Sell a package</button><button type="button" className="btn-primary !py-2.5" onClick={() => setEditing('new')} data-testid="new-invoice"><Icon name="edit" size={16} /> New invoice</button></div>} />
      {!ready ? <p className="text-sm text-ink-mute">Loading invoices…</p> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="invoice-summary">
            <Stat label="Outstanding" value={money(summary.outstanding, cfg!.currency)} sub={`${summary.count.outstanding + summary.count.overdue} invoice${summary.count.outstanding + summary.count.overdue === 1 ? '' : 's'} unpaid`} />
            <Stat label="Overdue" value={money(summary.overdue, cfg!.currency)} sub={summary.count.overdue ? `${summary.count.overdue} past due date` : 'nothing overdue'} />
            <Stat label="Paid this month" value={money(summary.paidThisMonth, cfg!.currency)} sub="by payment date" />
            <Stat label="Invoiced this month" value={money(summary.invoicedThisMonth, cfg!.currency)} sub={`${summary.count.draft} draft${summary.count.draft === 1 ? '' : 's'} not yet sent`} />
          </div>
          {!cfg!.paymentInstructions && <div className="mb-4 rounded-2xl bg-saffron-50 p-4 text-sm"><b>Add how students should pay</b> (bank details or a payment link) under <button type="button" className="font-semibold underline" onClick={() => setSettings(true)}>Rates &amp; payment details</button>. It prints on every invoice.</div>}
          <Section title="All invoices" eyebrow={`${list.length} total`} right={<div className="overflow-x-auto"><Segmented label="Filter" value={filter} onChange={setFilter} options={FILTERS} /></div>}>
            {shown.length === 0 ? <p className="text-sm text-ink-mute">{list.length ? 'Nothing in this view.' : 'No invoices yet. Tap New invoice: it offers the lessons you have taught that are not billed yet.'}</p> : (
              <ul className="grid gap-2" data-testid="invoice-list">
                {shown.map((inv) => {
                  const b = bucket(inv);
                  const od = daysOverdue(inv);
                  return (
                    <li key={inv.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-cream-100 p-3 text-sm">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${BUCKET_STYLE[b]}`}>{b}{od ? ` · ${od} d` : ''}</span>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setViewing(inv)}>
                        <span className="font-semibold">{inv.number}</span> <span className="text-ink-mute">· {nameOf(inv.studentId)} · issued {inv.issuedAt} · due {inv.dueAt}</span>
                        <span className="block truncate text-xs text-ink-mute">{inv.lines.map((l) => l.description).join(' · ')}</span>
                      </button>
                      <span className="font-display text-xl font-semibold tabular-nums">{money(inv.total, inv.currency)}</span>
                      <InvoiceActions inv={inv} cfg={cfg!} studentName={nameOf(inv.studentId)} teacherName={me?.firstName ?? 'Dina'} onEdit={() => setEditing(inv)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </>
      )}
      {ready && settings && <SettingsSheet cfg={cfg!} onClose={() => setSettings(false)} />}
      {ready && selling && <SellPackageSheet open onClose={() => { setSelling(false); if (params.get('sell')) navigate('teach/invoices'); }} people={people} cfg={cfg!} preselect={params.get('student') ?? undefined} />}
      {ready && editing && <InvoiceForm key={editing === 'new' ? 'new' : editing.id} invoice={editing === 'new' ? null : editing} cfg={cfg!} people={people} bookings={bookings.data ?? []} invoices={list} credits={credits.data ?? []} teacherId={me!.id} preselect={params.get('student') ?? undefined} onClose={() => { setEditing(null); if (params.get('new') || params.get('student')) navigate('teach/invoices'); }} />}
      {viewing && <Sheet open onClose={() => setViewing(null)} title={viewing.number}>
        <InvoiceView inv={viewing} studentName={nameOf(viewing.studentId)} />
        <div className="mt-4"><InvoiceActions inv={viewing} cfg={cfg!} studentName={nameOf(viewing.studentId)} teacherName={me?.firstName ?? 'Dina'} onEdit={() => { setViewing(null); setEditing(viewing); }} onDone={() => setViewing(null)} /></div>
      </Sheet>}
    </div>
  );
}

/** Mark paid / send / PDF / email / void / delete, with the small confirmations that matter. */
function InvoiceActions({ inv, cfg, studentName, teacherName, onEdit, onDone }: { inv: Invoice; cfg: TeacherConfig; studentName: string; teacherName: string; onEdit: () => void; onDone?: () => void }) {
  const { backend } = usePlatform();
  const { run, busy, error } = useAction();
  const [paying, setPaying] = useState(false);
  const [paidAt, setPaidAt] = useState(today());
  const [method, setMethod] = useState('bank transfer');
  const save = (patch: Partial<Invoice>) => run(async () => { await backend!.saveInvoice({ ...inv, ...patch }); onDone?.(); });
  const pdf = async () => { const { downloadInvoicePdf } = await import('../../lib/invoicePdf'); downloadInvoicePdf(inv, cfg, studentName, teacherName); };
  const mail = mailtoHref('', `Invoice ${inv.number} from ${cfg.businessName}`, invoiceText(inv, cfg, studentName));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {inv.status === 'draft' && <button type="button" className="btn-primary !py-1.5 !text-xs" disabled={busy} onClick={() => save({ status: 'sent' })} data-testid={`send-${inv.number}`}><Icon name="send" size={12} /> Mark as sent</button>}
      {(inv.status === 'sent') && !paying && <button type="button" className="btn-primary !py-1.5 !text-xs" onClick={() => setPaying(true)} data-testid={`pay-${inv.number}`}><Icon name="check" size={12} /> Mark paid</button>}
      {paying && <span className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-white p-1.5"><input aria-label="Paid on" type="date" className="input !w-36 !py-1 text-xs" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /><input aria-label="Payment method" className="input !w-32 !py-1 text-xs" value={method} onChange={(e) => setMethod(e.target.value)} /><button type="button" className="btn-dark !py-1 !text-xs" disabled={busy} onClick={() => save({ status: 'paid', paidAt, paymentMethod: method })} data-testid={`confirm-pay-${inv.number}`}>Confirm</button><button type="button" className="ctrl !py-1 !text-xs" onClick={() => setPaying(false)}>Cancel</button></span>}
      {inv.status !== 'void' && <button type="button" className="ctrl !py-1.5 !text-xs" onClick={pdf} data-testid={`pdf-${inv.number}`}><Icon name="download" size={12} /> PDF</button>}
      {inv.status !== 'void' && inv.status !== 'draft' && <a className="ctrl !py-1.5 !text-xs" href={mail}><Icon name="mail" size={12} /> Email</a>}
      {inv.status !== 'paid' && inv.status !== 'void' && <button type="button" className="ctrl !py-1.5 !text-xs" onClick={onEdit}><Icon name="edit" size={12} /> Edit</button>}
      {inv.status === 'paid' && <button type="button" className="ctrl !py-1.5 !text-xs" disabled={busy} onClick={() => save({ status: 'sent', paidAt: undefined, paymentMethod: undefined })}>Undo paid</button>}
      {inv.status === 'draft' && <button type="button" className="ctrl !py-1.5 !text-xs text-terracotta-dark" disabled={busy} onClick={() => run(async () => { await backend!.deleteInvoice(inv.id); onDone?.(); })}><Icon name="trash" size={12} /> Delete</button>}
      {inv.status === 'sent' && <button type="button" className="ctrl !py-1.5 !text-xs text-terracotta-dark" disabled={busy} onClick={() => save({ status: 'void' })}>Void</button>}
      {error && <span className="text-xs text-terracotta-dark">{error}</span>}
    </div>
  );
}

export function InvoiceView({ inv, studentName }: { inv: Invoice; studentName: string }) {
  return (
    <div className="text-sm">
      <p className="text-ink-mute">To <b className="text-ink">{studentName}</b> · issued {inv.issuedAt} · due {inv.dueAt}{inv.paidAt ? ` · paid ${inv.paidAt}${inv.paymentMethod ? ` by ${inv.paymentMethod}` : ''}` : ''}</p>
      <table className="mt-3 w-full">
        <tbody>{inv.lines.map((l, i) => <tr key={i} className="border-t border-ink/5"><td className="py-1.5 pr-2">{l.description}</td><td className="py-1.5 text-right tabular-nums text-ink-mute">{l.qty} × {money(l.unitPrice, inv.currency)}</td><td className="py-1.5 pl-3 text-right tabular-nums">{money(lineTotal(l), inv.currency)}</td></tr>)}</tbody>
        <tfoot>
          {inv.discount > 0 && <tr className="border-t border-ink/5"><td colSpan={2} className="py-1.5 text-right text-ink-mute">Discount</td><td className="py-1.5 pl-3 text-right tabular-nums">−{money(inv.discount, inv.currency)}</td></tr>}
          <tr className="border-t border-ink/10"><td colSpan={2} className="py-2 text-right font-semibold">{inv.status === 'paid' ? 'Total paid' : 'Total due'}</td><td className="py-2 pl-3 text-right font-display text-xl font-semibold tabular-nums">{money(inv.total, inv.currency)}</td></tr>
        </tfoot>
      </table>
      {inv.paymentInstructions && inv.status !== 'paid' && <div className="mt-3 rounded-2xl bg-saffron-50 p-3"><p className="eyebrow !text-[10px]">How to pay</p><p className="whitespace-pre-line">{inv.paymentInstructions}</p></div>}
      {inv.notes && <p className="mt-3 whitespace-pre-line text-ink-soft">{inv.notes}</p>}
    </div>
  );
}

function SettingsSheet({ cfg, onClose }: { cfg: TeacherConfig; onClose: () => void }) {
  const { backend } = usePlatform();
  const { run, busy, error } = useAction();
  const [c, setC] = useState<TeacherConfig>(cfg);
  const set = <K extends keyof TeacherConfig>(k: K, v: TeacherConfig[K]) => setC((x) => ({ ...x, [k]: v }));
  return (
    <Sheet open onClose={onClose} title="Rates and payment details">
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="cf-name" label="Business name (on invoices)"><input id="cf-name" className="input" value={c.businessName} onChange={(e) => set('businessName', e.target.value)} /></Field>
          <Field id="cf-currency" label="Currency"><select id="cf-currency" className="input" value={c.currency} onChange={(e) => set('currency', e.target.value)}>{['GBP', 'EUR', 'USD', 'ARS', 'MXN', 'COP', 'AUD', 'CAD', 'CHF'].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field id="cf-rate" label="Rate for a 60-minute lesson" hint="Other durations are priced in proportion."><input id="cf-rate" type="number" min={0} step={0.5} className="input" value={c.hourlyRate} onChange={(e) => set('hourlyRate', Number(e.target.value))} /></Field>
          <Field id="cf-due" label="Due after (days)"><input id="cf-due" type="number" min={0} max={90} className="input" value={c.dueDays} onChange={(e) => set('dueDays', Number(e.target.value))} /></Field>
          <Field id="cf-prefix" label="Invoice number prefix"><input id="cf-prefix" className="input" value={c.invoicePrefix} onChange={(e) => set('invoicePrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} /></Field>
          <Field id="cf-next" label="Next invoice number"><input id="cf-next" type="number" min={1} className="input" value={c.nextNumber} onChange={(e) => set('nextNumber', Math.max(1, Number(e.target.value)))} /></Field>
        </div>
        <Field id="cf-address" label="Your address (optional)"><textarea id="cf-address" className="input min-h-[60px]" value={c.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field id="cf-pay" label="How students pay" hint="Bank details, PayPal or a payment link. Printed on every invoice and shown in the student's app."><textarea id="cf-pay" className="input min-h-[80px]" value={c.paymentInstructions} onChange={(e) => set('paymentInstructions', e.target.value)} placeholder={'Bank transfer to Dina García\nSort code 00-00-00 · Account 12345678\nReference: your invoice number'} /></Field>
        <Field id="cf-footer" label="Footer line"><input id="cf-footer" className="input" value={c.footer} onChange={(e) => set('footer', e.target.value)} /></Field>
        <PackageEditor packages={c.packages ?? []} currency={c.currency} onChange={(p) => set('packages', p)} />
        {error && <p role="alert" className="rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{error}</p>}
        <div className="flex gap-2"><button type="button" className="btn-primary" disabled={busy} onClick={() => run(async () => { await backend!.saveTeacherConfig(c); onClose(); })} data-testid="save-settings">{busy ? 'Saving…' : 'Save'}</button><button type="button" className="ctrl" onClick={onClose}>Cancel</button></div>
      </div>
    </Sheet>
  );
}

function InvoiceForm({ invoice, cfg, people, bookings, invoices, credits, teacherId, preselect, onClose }: { invoice: Invoice | null; cfg: TeacherConfig; people: Person[]; bookings: Booking[]; invoices: Invoice[]; credits: Credit[]; teacherId: string; preselect?: string; onClose: () => void }) {
  const { backend } = usePlatform();
  const { run, busy, error, setError } = useAction();
  const [studentId, setStudentId] = useState(invoice?.studentId ?? preselect ?? people[0]?.id ?? '');
  const [issuedAt, setIssuedAt] = useState(invoice?.issuedAt ?? today());
  const [dueAt, setDueAt] = useState(invoice?.dueAt ?? addDaysIso(today(), cfg.dueDays));
  const [lines, setLines] = useState<InvoiceLine[]>(invoice?.lines ?? []);
  const [discount, setDiscount] = useState(invoice?.discount ?? 0);
  const [notes, setNotes] = useState(invoice?.notes ?? '');
  const [pay, setPay] = useState(invoice?.paymentInstructions ?? cfg.paymentInstructions);
  const unbilled = useMemo(() => unbilledLessons(bookings, invoices.filter((i) => i.id !== invoice?.id), studentId, Date.now(), credits), [bookings, invoices, studentId, invoice?.id, credits]);
  const chosen = new Set(lines.map((l) => l.bookingId).filter(Boolean));
  const toggleLesson = (b: Booking) => setLines((ls) => (chosen.has(b.id) ? ls.filter((l) => l.bookingId !== b.id) : [...ls, lineForBooking(b, cfg)]));
  const addCustom = () => setLines((ls) => [...ls, { description: '', qty: 1, unitPrice: cfg.hourlyRate }]);
  const update = (i: number, patch: Partial<InvoiceLine>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const sum = total(lines, discount);

  const save = async (status: Invoice['status']) => {
    if (!studentId) { setError('Choose a student.'); return; }
    const clean = lines.filter((l) => l.description.trim() && l.qty > 0);
    if (!clean.length) { setError('Add at least one line with a description.'); return; }
    const inv: Invoice = { id: invoice?.id ?? uid(), teacherId, studentId, number: invoice?.number ?? invoiceNumber(cfg, issuedAt), issuedAt, dueAt, currency: cfg.currency, lines: clean.map((l) => ({ ...l, qty: Number(l.qty), unitPrice: round2(Number(l.unitPrice)) })), discount: round2(Number(discount) || 0), total: total(clean, discount), status, notes: notes.trim() || undefined, paymentInstructions: pay.trim() || undefined, createdAt: invoice?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
    await run(async () => {
      await backend!.saveInvoice(inv);
      if (!invoice) await backend!.saveTeacherConfig({ ...cfg, nextNumber: (cfg.nextNumber || 1) + 1 });
      onClose();
    });
  };

  return (
    <Sheet open onClose={onClose} title={invoice ? `Edit ${invoice.number}` : 'New invoice'} wide>
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="in-student" label="Student"><select id="in-student" className="input" value={studentId} onChange={(e) => { setStudentId(e.target.value); setLines((ls) => ls.filter((l) => !l.bookingId)); }} disabled={!!invoice}>{people.map((p) => <option key={p.id} value={p.id}>{p.firstName} (@{p.username})</option>)}</select></Field>
          <Field id="in-issued" label="Issue date"><input id="in-issued" type="date" className="input" value={issuedAt} onChange={(e) => { setIssuedAt(e.target.value); setDueAt(addDaysIso(e.target.value, cfg.dueDays)); }} /></Field>
          <Field id="in-due" label="Due date"><input id="in-due" type="date" className="input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></Field>
        </div>
        {unbilled.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium">Lessons not yet billed <span className="font-normal text-ink-mute">· tick to add at {money(cfg.hourlyRate, cfg.currency)} per hour · lessons covered by a package are not listed</span></p>
            <ul className="grid gap-1 sm:grid-cols-2" data-testid="unbilled-lessons">{unbilled.map((b) => <li key={b.id}><label className="flex cursor-pointer items-center gap-2 rounded-xl bg-cream-100 px-3 py-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-terracotta" checked={chosen.has(b.id)} onChange={() => toggleLesson(b)} /><span className="min-w-0 flex-1 truncate">{new Date(b.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {b.durationMin} min · {b.topic}</span><span className="tabular-nums text-ink-mute">{money(lineForBooking(b, cfg).unitPrice, cfg.currency)}</span></label></li>)}</ul>
          </div>
        )}
        <div>
          <div className="mb-1 flex items-center justify-between"><p className="text-sm font-medium">Lines</p><button type="button" className="ctrl !py-1 !text-xs" onClick={addCustom} data-testid="add-line"><Icon name="edit" size={12} /> Add a line</button></div>
          {lines.length === 0 ? <p className="rounded-xl bg-cream-100 p-3 text-sm text-ink-mute">Tick lessons above or add a line (a lesson pack, materials, a discount as a negative price…).</p> : (
            <ul className="grid gap-1.5" data-testid="invoice-lines">
              {lines.map((l, i) => (
                <li key={i} className="grid grid-cols-[1fr_56px_96px_auto] items-center gap-2">
                  <input aria-label="Description" className="input !py-1.5 text-sm" value={l.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="Description" />
                  <input aria-label="Quantity" type="number" min={0} step={1} className="input !py-1.5 text-sm" value={l.qty} onChange={(e) => update(i, { qty: Number(e.target.value) })} />
                  <input aria-label="Unit price" type="number" step={0.5} className="input !py-1.5 text-sm" value={l.unitPrice} onChange={(e) => update(i, { unitPrice: Number(e.target.value) })} />
                  <button type="button" className="ctrl !px-2 !py-1.5" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}><Icon name="x" size={12} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <Field id="in-notes" label="Notes (optional)"><input id="in-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Thank you for a great month" /></Field>
          <Field id="in-discount" label={`Discount (${cfg.currency})`}><input id="in-discount" type="number" min={0} step={0.5} className="input" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></Field>
        </div>
        <Field id="in-pay" label="How to pay (printed on this invoice)"><textarea id="in-pay" className="input min-h-[60px]" value={pay} onChange={(e) => setPay(e.target.value)} /></Field>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream-100 p-3">
          <span className="text-sm text-ink-mute">{invoice ? invoice.number : `Will be ${invoiceNumber(cfg, issuedAt)}`}</span>
          <span className="font-display text-2xl font-semibold tabular-nums" data-testid="invoice-total">{money(sum, cfg.currency)}</span>
        </div>
        {error && <p role="alert" className="rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => save('sent')} data-testid="save-send"><Icon name="send" size={16} /> {busy ? 'Saving…' : 'Save and send to student'}</button>
          <button type="button" className="ctrl" disabled={busy} onClick={() => save('draft')} data-testid="save-draft">Save as draft</button>
          <button type="button" className="ctrl" onClick={onClose}>Cancel</button>
        </div>
        <p className="text-xs text-ink-mute">“Send” makes the invoice visible in the student’s app (Invoices page and home reminders). Use the Email button afterwards to send the summary by email as well.</p>
      </div>
    </Sheet>
  );
}
