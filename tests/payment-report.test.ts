import { describe, expect, it } from 'vitest';
import { DemoBackend, paymentReport, type DemoStorage } from '../src/lib/platform/backend';
import { buildWorkspace, DEMO_PEOPLE } from '../src/lib/platform/demoSeed';
import { bucket, summarise } from '../src/lib/platform/invoicing';
import { DEMO_STUDENT_IDS, DEMO_TEACHER_ID, type Invoice, type PlatformData } from '../src/lib/platform/types';

function memoryStorage(data: PlatformData): DemoStorage & { saved: PlatformData } {
  const s = { saved: data, loadData: async () => s.saved, saveData: async (d: PlatformData) => { s.saved = d; }, loadStudentState: async () => null };
  return s;
}
const dina = DEMO_PEOPLE.find((p) => p.id === DEMO_TEACHER_ID)!;
const sam = DEMO_PEOPLE.find((p) => p.id === DEMO_STUDENT_IDS.sam)!;
const anneka = DEMO_PEOPLE.find((p) => p.id === DEMO_STUDENT_IDS.anneka)!;
const invoice = (over: Partial<Invoice> = {}): Invoice => ({ id: 'inv-test-0001', teacherId: dina.id, studentId: sam.id, number: 'LWD-2026-0099', issuedAt: '2026-11-10', dueAt: '2026-11-24', currency: 'GBP', lines: [{ description: 'Lesson', qty: 1, unitPrice: 30 }], discount: 0, total: 30, status: 'sent', createdAt: '2026-11-10T10:00:00.000Z', updatedAt: '2026-11-10T10:00:00.000Z', ...over });

describe('a student reports an invoice as paid', () => {
  it('flags the invoice for the teacher without marking it paid', async () => {
    const storage = memoryStorage(buildWorkspace(Date.UTC(2026, 10, 9, 9)));
    const teacher = new DemoBackend(dina, storage.saved, storage, () => Date.UTC(2026, 10, 12, 9));
    await teacher.saveInvoice(invoice());
    const student = new DemoBackend(sam, storage.saved, storage, () => Date.UTC(2026, 10, 12, 10));
    const reported = await student.reportInvoicePaid('inv-test-0001', { method: ' Bank transfer ', note: 'x'.repeat(500) });
    expect(reported.status).toBe('sent');
    expect(reported.paymentReported).toMatchObject({ at: '2026-11-12T10:00:00.000Z', method: 'Bank transfer' });
    expect(reported.paymentReported!.note).toHaveLength(200);
    expect(bucket(reported, Date.UTC(2026, 10, 12))).toBe('outstanding'); // still owed until the teacher confirms
    const teacherLater = new DemoBackend(dina, storage.saved, storage, () => Date.UTC(2026, 10, 12, 11)); // the teacher opens the app afterwards
    const mine = (await teacherLater.invoices({ studentId: sam.id })).find((i) => i.id === 'inv-test-0001')!;
    expect(mine.paymentReported?.method).toBe('Bank transfer');
    expect(summarise([mine], Date.UTC(2026, 10, 12)).outstanding).toBe(30);
    // The teacher confirms; the notice stays on the record.
    const paid = await teacherLater.saveInvoice({ ...mine, status: 'paid', paidAt: '2026-11-12', paymentMethod: 'bank transfer' });
    expect(paid).toMatchObject({ status: 'paid', paymentReported: { method: 'Bank transfer' } });
  });
  it('only the owner can report, and only an invoice that is waiting to be paid', async () => {
    const storage = memoryStorage(buildWorkspace(Date.UTC(2026, 10, 9, 9)));
    const teacher = new DemoBackend(dina, storage.saved, storage);
    await teacher.saveInvoice(invoice());
    await teacher.saveInvoice(invoice({ id: 'inv-test-0002', number: 'LWD-2026-0100', status: 'paid', paidAt: '2026-11-11' }));
    await teacher.saveInvoice(invoice({ id: 'inv-test-0003', number: 'LWD-2026-0101', status: 'draft' }));
    await expect(new DemoBackend(anneka, storage.saved, storage).reportInvoicePaid('inv-test-0001')).rejects.toThrow(/not found/i);
    await expect(teacher.reportInvoicePaid('inv-test-0001')).rejects.toThrow(/Mark paid/);
    const student = new DemoBackend(sam, storage.saved, storage);
    await expect(student.reportInvoicePaid('inv-test-0002')).rejects.toThrow(/already/);
    await expect(student.reportInvoicePaid('inv-test-0003')).rejects.toThrow();
    await expect(student.reportInvoicePaid('nope')).rejects.toThrow(/not found/i);
    expect(paymentReport('2026-11-12T10:00:00.000Z', { method: '  ', note: '' })).toEqual({ at: '2026-11-12T10:00:00.000Z' });
  });
});
