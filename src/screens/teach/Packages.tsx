import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/ui';
import { usePlatform, usePlatformQuery } from '../../lib/platform/context';
import { uid } from '../../lib/platform/backend';
import { addDaysIso, invoiceNumber, money, round2 } from '../../lib/platform/invoicing';
import { balanceFor, balanceLabel, creditFromPackage, isLow, pricePerLesson, type Balance } from '../../lib/platform/packages';
import type { Booking, Credit, Invoice, LessonPackage, Person, TeacherConfig } from '../../lib/platform/types';
import { Field, useAction } from './shared';

// Lesson packages: Dina defines them in her invoicing settings, sells one to a
// student (which creates the invoice), and every taught lesson uses a credit.

/** Editor for the teacher's package list (inside the settings sheet). */
export function PackageEditor({ packages, currency, onChange }: { packages: LessonPackage[]; currency: string; onChange: (p: LessonPackage[]) => void }) {
  const update = (i: number, patch: Partial<LessonPackage>) => onChange(packages.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const add = () => onChange([...packages, { id: uid(), name: `${packages.length ? 10 : 5} lessons`, lessons: packages.length ? 10 : 5, minutesPerLesson: 60, price: packages.length ? 340 : 180, validMonths: 6 }]);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between"><p className="text-sm font-medium">Lesson packages</p><button type="button" className="ctrl !py-1 !text-xs" onClick={add} data-testid="add-package"><Icon name="edit" size={12} /> Add a package</button></div>
      {packages.length === 0 ? <p className="rounded-xl bg-cream-100 p-3 text-sm text-ink-mute">No packages yet. A package is a set number of lessons for one price; when you sell one, each lesson you teach uses a credit and the student sees their balance.</p> : (
        <ul className="grid gap-1.5" data-testid="package-list">
          <li className="grid grid-cols-[1fr_64px_72px_88px_72px_auto] gap-2 text-[10px] uppercase tracking-wider text-ink-mute"><span>Name</span><span>Lessons</span><span>Minutes</span><span>Price</span><span>Valid (months)</span><span /></li>
          {packages.map((p, i) => (
            <li key={p.id} className="grid grid-cols-[1fr_64px_72px_88px_72px_auto] items-center gap-2">
              <input aria-label="Package name" className="input !py-1.5 text-sm" value={p.name} onChange={(e) => update(i, { name: e.target.value })} />
              <input aria-label="Lessons" type="number" min={1} className="input !py-1.5 text-sm" value={p.lessons} onChange={(e) => update(i, { lessons: Math.max(1, Number(e.target.value)) })} />
              <input aria-label="Minutes per lesson" type="number" min={15} step={15} className="input !py-1.5 text-sm" value={p.minutesPerLesson} onChange={(e) => update(i, { minutesPerLesson: Number(e.target.value) })} />
              <input aria-label="Price" type="number" min={0} step={0.5} className="input !py-1.5 text-sm" value={p.price} onChange={(e) => update(i, { price: Number(e.target.value) })} />
              <input aria-label="Valid months (0 = no expiry)" type="number" min={0} max={36} className="input !py-1.5 text-sm" value={p.validMonths} onChange={(e) => update(i, { validMonths: Number(e.target.value) })} />
              <button type="button" className="ctrl !px-2 !py-1.5" aria-label="Remove package" onClick={() => onChange(packages.filter((_, k) => k !== i))}><Icon name="x" size={12} /></button>
              <p className="col-span-6 -mt-1 text-[11px] text-ink-mute">{money(pricePerLesson(p), currency)} per lesson{p.validMonths ? ` · valid ${p.validMonths} months from purchase` : ' · no expiry'}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Sell a package to a student: creates the credit and its invoice (sent, or paid straight away). */
export function SellPackageSheet({ open, onClose, people, cfg, preselect }: { open: boolean; onClose: () => void; people: Person[]; cfg: TeacherConfig; preselect?: string }) {
  const { backend, me } = usePlatform();
  const { run, busy, error, setError } = useAction();
  const [studentId, setStudentId] = useState(preselect ?? people[0]?.id ?? '');
  const [pkgId, setPkgId] = useState(cfg.packages[0]?.id ?? '');
  const [purchasedAt, setPurchasedAt] = useState(new Date().toISOString().slice(0, 10));
  const [paid, setPaid] = useState(false);
  const [done, setDone] = useState<{ credit: Credit; invoice: Invoice } | null>(null);
  const pkg = cfg.packages.find((p) => p.id === pkgId);
  const sell = async () => {
    if (!backend || !pkg) { setError('Choose a package.'); return; }
    if (!studentId) { setError('Choose a student.'); return; }
    const credit = creditFromPackage(pkg, studentId, me!.id, cfg.currency, purchasedAt, uid());
    const invoice: Invoice = { id: uid(), teacherId: me!.id, studentId, number: invoiceNumber(cfg, purchasedAt), issuedAt: purchasedAt, dueAt: paid ? purchasedAt : addDaysIso(purchasedAt, cfg.dueDays), currency: cfg.currency, lines: [{ description: `${pkg.name}: ${pkg.lessons} × ${pkg.minutesPerLesson}-minute lessons${pkg.validMonths ? ` (valid ${pkg.validMonths} months)` : ''}`, qty: 1, unitPrice: round2(pkg.price) }], discount: 0, total: round2(pkg.price), status: paid ? 'paid' : 'sent', paidAt: paid ? purchasedAt : undefined, paymentMethod: paid ? 'paid on purchase' : undefined, paymentInstructions: cfg.paymentInstructions || undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    credit.invoiceId = invoice.id;
    const r = await run(async () => {
      await backend.saveInvoice(invoice);
      await backend.saveCredit(credit);
      await backend.saveTeacherConfig({ ...cfg, nextNumber: (cfg.nextNumber || 1) + 1 });
      return { credit, invoice };
    });
    if (r) setDone(r);
  };
  const close = () => { setDone(null); onClose(); };
  const name = people.find((p) => p.id === studentId)?.firstName ?? 'the student';
  return (
    <Sheet open={open} onClose={close} title={done ? 'Package sold' : 'Sell a package'}>
      {done ? (
        <div className="grid gap-3 text-sm">
          <p><b>{done.credit.name}</b> added to {name}: {done.credit.lessons} lessons{done.credit.expiresAt ? `, valid until ${done.credit.expiresAt}` : ''}. Invoice <b>{done.invoice.number}</b> for {money(done.invoice.total, done.invoice.currency)} is {done.invoice.status === 'paid' ? 'marked paid' : 'sent to the student (visible in their app; use Email or PDF from Invoices if you like)'}.</p>
          <p className="text-ink-soft">Every lesson you teach {name} from {done.credit.purchasedAt} uses one credit. You both see the balance.</p>
          <button type="button" className="btn-primary" onClick={close}>Done</button>
        </div>
      ) : cfg.packages.length === 0 ? (
        <div className="grid gap-3 text-sm"><p>Define your packages first: Invoices → Rates &amp; payment details → Lesson packages.</p><button type="button" className="ctrl" onClick={close}>Close</button></div>
      ) : (
        <div className="grid gap-3">
          <Field id="sp-student" label="Student"><select id="sp-student" className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>{people.map((p) => <option key={p.id} value={p.id}>{p.firstName} (@{p.username})</option>)}</select></Field>
          <Field id="sp-package" label="Package"><select id="sp-package" className="input" value={pkgId} onChange={(e) => setPkgId(e.target.value)}>{cfg.packages.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.lessons} × {p.minutesPerLesson} min · {money(p.price, cfg.currency)}</option>)}</select></Field>
          <Field id="sp-date" label="Purchase date" hint="Lessons from this date onwards use the credits."><input id="sp-date" type="date" className="input" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-terracotta" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Already paid (mark the invoice paid)</label>
          {error && <p role="alert" className="rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{error}</p>}
          <div className="flex gap-2"><button type="button" className="btn-primary" disabled={busy} onClick={sell} data-testid="confirm-sell"><Icon name="check" size={16} /> {busy ? 'Saving…' : `Sell ${pkg ? `for ${money(pkg.price, cfg.currency)}` : ''}`}</button><button type="button" className="ctrl" onClick={close}>Cancel</button></div>
        </div>
      )}
    </Sheet>
  );
}

/** Loads everything the balance needs for one student. */
export function useBalance(studentId: string | undefined): { balance: Balance | null; reload: () => void } {
  const q = usePlatformQuery(async (b) => {
    if (!studentId) return null;
    const [bookings, invoices, credits] = await Promise.all([b.bookings({ studentId, includeCancelled: true }), b.invoices({ studentId }), b.credits({ studentId })]);
    return balanceFor(studentId, bookings as Booking[], invoices, credits);
  }, [studentId]);
  return { balance: q.data ?? null, reload: q.reload };
}

/** "3 of 10 left" chip with the right colour. */
export function BalanceChip({ balance, size = 'sm' }: { balance: Balance | null; size?: 'sm' | 'lg' }) {
  if (!balance || !balance.hasPackages) return null;
  const low = isLow(balance);
  const owes = balance.remaining < 0;
  const cls = owes ? 'bg-terracotta text-white' : low ? 'bg-saffron-50 text-ink ring-1 ring-saffron/50' : 'bg-olive-50 text-olive';
  return <span className={`inline-flex items-center gap-1 rounded-full font-bold ${size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-[11px] uppercase tracking-wider'} ${cls}`} title={`${balance.upcoming} booked lesson${balance.upcoming === 1 ? '' : 's'} not yet taught${balance.nextExpiry ? ` · valid until ${balance.nextExpiry}` : ''}`} data-testid="balance-chip"><Icon name="star" size={12} /> {balanceLabel(balance)}{balance.upcoming ? ` · ${balance.upcoming} booked` : ''}</span>;
}

/** Full balance card: packages bought, lessons used, what is left. */
export function BalanceCard({ balance, currency, onSell }: { balance: Balance; currency: string; onSell?: () => void }) {
  const used = balance.covered.length;
  const pct = balance.credits ? Math.min(100, Math.round((used / balance.credits) * 100)) : 0;
  const packagesSorted = useMemo(() => [...balance.packages].reverse(), [balance.packages]);
  return (
    <div className="card p-5" data-testid="balance-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="eyebrow">Bono de clases · Lesson balance</p><p className="font-display text-3xl font-semibold">{balanceLabel(balance)}</p><p className="text-sm text-ink-mute">{used} used{balance.upcoming ? ` · ${balance.upcoming} booked and still to come` : ''}{balance.nextExpiry ? ` · valid until ${balance.nextExpiry}` : ''}</p></div>
        {onSell && <button type="button" className="btn-primary !py-2" onClick={onSell} data-testid="sell-package"><Icon name="star" size={14} /> Sell a package</button>}
      </div>
      {balance.credits > 0 && <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink/5"><div className={`h-full rounded-full ${balance.remaining < 0 ? 'bg-terracotta' : isLow(balance) ? 'bg-saffron' : 'bg-olive'}`} style={{ width: `${pct}%` }} /></div>}
      {isLow(balance) && <p className="mt-2 text-sm text-terracotta-dark">{balance.remaining < 0 ? 'More lessons taught than bought: the next invoice should cover the difference.' : 'Nearly used up: time for the next package.'}</p>}
      {packagesSorted.length > 0 && <ul className="mt-3 grid gap-1 border-t border-ink/5 pt-3 text-sm">{packagesSorted.map((c) => <li key={c.id} className="flex justify-between gap-2"><span>{c.name} <span className="text-ink-mute">· bought {c.purchasedAt}{c.expiresAt ? ` · valid until ${c.expiresAt}` : ''}</span></span><span className="tabular-nums text-ink-soft">{c.lessons} lessons · {money(c.price, currency)}</span></li>)}</ul>}
    </div>
  );
}
