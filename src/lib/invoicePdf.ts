import { jsPDF } from 'jspdf';
import { lineTotal, money, subtotal } from './platform/invoicing';
import type { Invoice, TeacherConfig } from './platform/types';

// A4 invoice in the app's branding (cream, terracotta, ink). Pure jsPDF: no network.

type RGB = readonly [number, number, number];
const C: Record<'ink' | 'soft' | 'mute' | 'terra' | 'saffron' | 'cream' | 'white', RGB> = { ink: [30, 27, 24], soft: [74, 67, 60], mute: [113, 103, 94], terra: [194, 89, 58], saffron: [227, 163, 59], cream: [246, 238, 225], white: [255, 255, 255] };
const safe = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/—/g, '-').replace(/–/g, '-').replace(/·/g, '-').replace(/−/g, '-');

export function buildInvoicePdf(inv: Invoice, cfg: TeacherConfig, studentName: string, teacherName: string): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 18;
  const text = (s: string, x: number, y: number, o: { size?: number; bold?: boolean; italic?: boolean; color?: readonly number[]; align?: 'left' | 'right' | 'center'; maxW?: number; font?: 'helvetica' | 'times' } = {}) => {
    doc.setFont(o.font ?? 'helvetica', o.bold ? (o.italic ? 'bolditalic' : 'bold') : o.italic ? 'italic' : 'normal');
    doc.setFontSize(o.size ?? 10);
    const col = o.color ?? C.ink; doc.setTextColor(col[0], col[1], col[2]);
    const lines = o.maxW ? doc.splitTextToSize(safe(s), o.maxW) : safe(s);
    doc.text(lines, x, y, { align: o.align ?? 'left' });
    return Array.isArray(lines) ? lines.length : 1;
  };

  // Header band
  doc.setFillColor(C.cream[0], C.cream[1], C.cream[2]); doc.rect(0, 0, W, 42, 'F');
  text('Learning with', M, 16, { size: 10, italic: true, color: [94, 113, 73], font: 'times' });
  text('Dina', M, 27, { size: 26, bold: true, color: C.terra, font: 'times' });
  doc.setFont('times', 'bold'); doc.setFontSize(26);
  text('.', M + doc.getTextWidth('Dina'), 27, { size: 26, bold: true, color: C.saffron, font: 'times' });
  text(cfg.businessName || 'Learning with Dina', W - M, 14, { size: 11, bold: true, align: 'right' });
  if (cfg.address) text(cfg.address, W - M, 19.5, { size: 8.5, color: C.soft, align: 'right', maxW: 80 });
  text(`Teacher: ${teacherName}`, W - M, 34, { size: 8.5, color: C.mute, align: 'right' });

  // Title block
  text('INVOICE', M, 58, { size: 22, bold: true, color: C.ink, font: 'times' });
  text(inv.number, M, 65, { size: 10.5, color: C.soft });
  const statusLabel = inv.status === 'paid' ? `PAID ${inv.paidAt ?? ''}` : inv.status === 'void' ? 'VOID' : inv.status === 'draft' ? 'DRAFT' : 'DUE ' + inv.dueAt;
  const badge: readonly [number, number, number] = inv.status === 'paid' ? [94, 113, 73] : inv.status === 'void' ? [113, 103, 94] : [194, 89, 58];
  doc.setFillColor(badge[0], badge[1], badge[2]);
  doc.roundedRect(W - M - 46, 52, 46, 9, 2.5, 2.5, 'F');
  text(statusLabel, W - M - 23, 58, { size: 9, bold: true, color: C.white, align: 'center' });

  // Parties
  text('BILL TO', M, 78, { size: 7.5, bold: true, color: C.mute });
  text(studentName, M, 84, { size: 11, bold: true });
  text('ISSUED', 110, 78, { size: 7.5, bold: true, color: C.mute }); text(inv.issuedAt, 110, 84, { size: 10.5 });
  text('DUE', 150, 78, { size: 7.5, bold: true, color: C.mute }); text(inv.dueAt, 150, 84, { size: 10.5 });

  // Lines table
  let y = 98;
  doc.setFillColor(C.cream[0], C.cream[1], C.cream[2]); doc.rect(M, y - 5, W - 2 * M, 8, 'F');
  text('Description', M + 2, y, { size: 8, bold: true, color: C.soft });
  text('Qty', 140, y, { size: 8, bold: true, color: C.soft, align: 'right' });
  text('Unit', 162, y, { size: 8, bold: true, color: C.soft, align: 'right' });
  text('Amount', W - M - 2, y, { size: 8, bold: true, color: C.soft, align: 'right' });
  y += 8;
  for (const l of inv.lines) {
    const n = text(l.description, M + 2, y, { size: 9.5, maxW: 100 });
    text(String(l.qty), 140, y, { size: 9.5, align: 'right' });
    text(money(l.unitPrice, inv.currency), 162, y, { size: 9.5, align: 'right' });
    text(money(lineTotal(l), inv.currency), W - M - 2, y, { size: 9.5, align: 'right' });
    const lineY = y + (n - 1) * 4.6 + 2.6;
    doc.setDrawColor(230, 222, 208); doc.setLineWidth(0.2); doc.line(M, lineY, W - M, lineY);
    y = lineY + 5.2;
    if (y > 250) { doc.addPage(); y = 24; }
  }
  // Totals
  y += 4;
  const right = (label: string, value: string, bold = false, color: readonly number[] = C.ink) => { text(label, 150, y, { size: bold ? 10.5 : 9.5, color: bold ? color : C.mute, align: 'right', bold }); text(value, W - M - 2, y, { size: bold ? 12 : 9.5, bold, align: 'right', color }); y += bold ? 8 : 6; };
  right('Subtotal', money(subtotal(inv.lines), inv.currency));
  if (inv.discount) right('Discount', '-' + money(inv.discount, inv.currency));
  right(inv.status === 'paid' ? 'Total paid' : 'Total due', money(inv.total, inv.currency), true, inv.status === 'paid' ? ([94, 113, 73] as const) : C.terra);

  // Payment + notes
  y += 4;
  if (inv.paymentInstructions && inv.status !== 'paid') {
    text('HOW TO PAY', M, y, { size: 7.5, bold: true, color: C.mute }); y += 5;
    y += text(inv.paymentInstructions, M, y, { size: 9.5, maxW: W - 2 * M, color: C.soft }) * 4.6 + 4;
  }
  if (inv.paymentMethod && inv.status === 'paid') { text(`Paid by ${inv.paymentMethod}${inv.paidAt ? ` on ${inv.paidAt}` : ''}.`, M, y, { size: 9.5, color: C.soft }); y += 7; }
  if (inv.notes) { text('NOTES', M, y, { size: 7.5, bold: true, color: C.mute }); y += 5; y += text(inv.notes, M, y, { size: 9.5, maxW: W - 2 * M, color: C.soft }) * 4.6 + 4; }

  // Footer
  doc.setDrawColor(C.saffron[0], C.saffron[1], C.saffron[2]); doc.setLineWidth(0.6); doc.line(M, 280, M + 14, 280);
  text(cfg.footer || 'Thank you', M, 286, { size: 9, italic: true, color: C.soft, font: 'times' });
  text(`Generated by Learning with Dina - ${new Date().toLocaleDateString('en-GB')}`, W - M, 286, { size: 7.5, color: C.mute, align: 'right' });
  return doc;
}

export function downloadInvoicePdf(inv: Invoice, cfg: TeacherConfig, studentName: string, teacherName: string) {
  buildInvoicePdf(inv, cfg, studentName, teacherName).save(`${inv.number}.pdf`);
}
