// Rebuilds the lines of a PDF page from its text items, keeping the shape a lesson plan is read by:
//   • a table row comes out as one line, its cells separated by a tab, however many lines each cell wraps to
//   • a wide gap inside a line (a blank to fill in, drawn as a rule) also comes out as a tab
//   • a wider gap than usual between lines is a blank line, and a line in larger type is marked as a heading
// PDFs store text as positioned fragments, often cell by cell, so reading them in order loses all of this.

export interface PdfItem { str?: string; transform?: number[]; width?: number; height?: number }
interface Seg { x: number; end: number; y: number; h: number; text: string }
interface Cell { x: number; lines: Seg[] }

const WIDE = 14; // points: a gap this wide inside a line is a column break or a blank, not a space

export function layoutPdfItems(items: PdfItem[]): string[] {
  // 1. Fragments on one baseline with ordinary spacing become a segment.
  const segs: Seg[] = [];
  let cur: Seg | null = null;
  for (const it of items) {
    if (typeof it.str !== 'string' || !it.transform) continue;
    const x = it.transform[4], y = it.transform[5], w = it.width ?? 0, h = it.height ?? 0;
    if (!it.str.trim()) { if (cur && w >= WIDE) cur = null; continue; } // a wide space ends the segment
    const s: Seg | null = cur;
    if (s && Math.abs(y - s.y) < 2 && x - s.end < WIDE && x >= s.end - 2) {
      s.text += (x - s.end > 1 && !/\s$/.test(s.text) ? ' ' : '') + it.str; s.end = x + w; s.h = Math.max(s.h, h);
    } else { cur = { x, end: x + w, y, h, text: it.str }; segs.push(cur); }
  }
  for (const s of segs) s.text = s.text.replace(/\s+/g, ' ').trim();
  const real = segs.filter((s) => s.text && !/^[•·▪◦\-–—*\s]+$/.test(s.text)); // stray list markers carry nothing

  // 2. Segments become rows of cells. A cell is consecutive lines starting at the same x; the next cell starts
  //    further right and no lower than the row so far.
  const heights = real.map((s) => s.h).filter((h) => h > 0).sort((a, b) => a - b);
  const body = heights[Math.floor(heights.length / 2)] || 10;
  const rows: { cells: Cell[]; top: number; bottom: number }[] = [];
  let row: (typeof rows)[number] | null = null;
  for (const s of real) {
    const cell: Cell | undefined = row?.cells[row.cells.length - 1];
    const last = cell?.lines[cell.lines.length - 1];
    if (row && cell && last && Math.abs(s.x - cell.x) <= 3 && s.y < last.y && last.y - s.y <= Math.max(last.h, s.h, body) * 2.2 && Math.abs(s.h - last.h) < 2) {
      cell.lines.push(s); row.bottom = Math.min(row.bottom, s.y);
    } else if (row && cell && s.x > cell.x + 10 && s.y >= row.bottom - 2 && s.y <= row.top + body * 1.7) {
      row.cells.push({ x: s.x, lines: [s] }); row.top = Math.max(row.top, s.y); row.bottom = Math.min(row.bottom, s.y);
    } else { row = { cells: [{ x: s.x, lines: [s] }], top: s.y, bottom: s.y }; rows.push(row); }
  }

  // 3. Rows become lines. A row of several cells is one line; a single cell keeps its own lines (a paragraph or a
  //    list), except a heading that wraps, which is one heading.
  const out: { text: string; y: number; bottom: number; h: number; big: boolean }[] = [];
  const isBig = (h: number, text: string) => h >= body * 1.18 && text.length <= 110;
  for (const r of rows) {
    if (r.cells.length > 1) {
      out.push({ text: r.cells.map((c) => c.lines.map((l) => l.text).join(' ')).join('\t'), y: r.top, bottom: r.bottom, h: body, big: false });
    } else {
      const lines = r.cells[0].lines;
      if (lines.every((l) => isBig(l.h, l.text))) { const text = lines.map((l) => l.text).join(' '); out.push({ text, y: lines[0].y, bottom: r.bottom, h: lines[0].h, big: text.length <= 110 }); }
      else for (const l of lines) out.push({ text: l.text, y: l.y, bottom: l.y, h: l.h, big: isBig(l.h, l.text) });
    }
  }
  const gaps = out.slice(1).map((r, i) => (r.big || out[i].big ? 0 : out[i].bottom - r.y)).filter((g) => g > 0).sort((a, b) => a - b);
  const usual = gaps[Math.floor((gaps.length - 1) / 2)] || body * 1.3;
  const lines: string[] = [];
  out.forEach((r, i) => {
    const prev = out[i - 1];
    const gap = prev ? prev.bottom - r.y : 0;
    if (prev && (gap > usual * 1.4 || gap < -2 || r.big || prev.big)) lines.push('');
    lines.push(r.big && !/^#/.test(r.text) ? `# ${r.text}` : r.text);
  });
  return lines;
}
