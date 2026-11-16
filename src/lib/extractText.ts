// ───────────────────────────────────────────────────────────────
// Text out of a teacher's document, in the browser: PDF (pdf.js, loaded
// on demand), Word (.docx: the zip's word/document.xml), plain text and
// Markdown. Nothing is uploaded anywhere; the text stays in the page
// until the teacher assigns the exercises built from it.
// ───────────────────────────────────────────────────────────────

export type SourceKind = 'pdf' | 'docx' | 'txt' | 'paste';
export const MAX_CHARS = 20_000;
export const MAX_PAGES = 30;

export function sourceKindOf(file: File): SourceKind | null {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) return 'txt';
  return null;
}

async function fromPdf(buf: ArrayBuffer, layout = false): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, MAX_PAGES); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let line = '';
    if (layout) {
      // Keep the shape of the page: a bigger gap between lines is a blank line, and a line set in larger type than
      // the body is a heading. A lesson plan is read by its shape, so this is what makes a PDF plan come through.
      type Item = { str?: string; hasEOL?: boolean; height?: number; transform?: number[] };
      const rows: { text: string; y: number; h: number }[] = [];
      let y = 0, h = 0;
      for (const item of content.items as Item[]) {
        if (typeof item.str !== 'string') continue;
        if (!line && item.str.trim()) { y = item.transform?.[5] ?? 0; h = item.height ?? 0; }
        if (item.str.trim()) h = Math.max(h, item.height ?? 0);
        line += item.str;
        if (item.hasEOL) { if (line.trim()) rows.push({ text: line.replace(/\s+/g, ' ').trim(), y, h }); line = ''; } else line += ' ';
      }
      if (line.trim()) rows.push({ text: line.replace(/\s+/g, ' ').trim(), y, h });
      const heights = rows.map((r) => r.h).filter((x) => x > 0).sort((a, b) => a - b);
      const body = heights[Math.floor(heights.length / 2)] || 11;
      // The usual distance between two lines of body text on this page. Where every line is its own paragraph (a list
      // of options or words), that distance is large but it is still the normal one, so it must not split them.
      const isBig = (r: { text: string; h: number }) => r.h >= body * 1.18 && r.text.length <= 90;
      const gaps = rows.slice(1).map((r, i) => (isBig(r) || isBig(rows[i]) ? 0 : rows[i].y - r.y)).filter((g) => g > 0).sort((x, z) => x - z);
      const usual = gaps[Math.floor((gaps.length - 1) / 2)] || body * 1.3;
      rows.forEach((r, i) => {
        const prev = rows[i - 1];
        const gap = prev ? prev.y - r.y : 0;
        const big = isBig(r);
        if (prev && (gap > usual * 1.4 || gap < 0 || big || isBig(prev))) parts.push('');
        parts.push(big && !/^#/.test(r.text) ? `# ${r.text}` : r.text);
      });
      line = '';
    } else {
      for (const item of content.items as { str?: string; hasEOL?: boolean }[]) {
        if (typeof item.str !== 'string') continue;
        line += item.str;
        if (item.hasEOL) { parts.push(line); line = ''; } else line += ' ';
      }
    }
    if (line.trim()) parts.push(line);
    parts.push('');
    if (parts.join('\n').length > MAX_CHARS) break;
  }
  return parts.join('\n');
}

async function fromDocx(buf: ArrayBuffer): Promise<string> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const files = unzipSync(new Uint8Array(buf));
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('This .docx has no document body.');
  const doc = new DOMParser().parseFromString(strFromU8(xml), 'application/xml');
  const paragraphs: string[] = [];
  for (const p of Array.from(doc.getElementsByTagNameNS('*', 'p'))) {
    const texts = Array.from(p.getElementsByTagNameNS('*', 't')).map((t) => t.textContent ?? '');
    const tabs = p.getElementsByTagNameNS('*', 'tab').length;
    const line = (texts.join('') + (tabs ? ' ' : '')).replace(/\s+/g, ' ').trim();
    if (line) paragraphs.push(line);
  }
  return paragraphs.join('\n');
}

/** The document's text, capped at MAX_CHARS. Throws with a readable message when the file cannot be read. */
export async function extractText(file: File, opts: { layout?: boolean } = {}): Promise<{ text: string; kind: SourceKind; truncated: boolean }> {
  const kind = sourceKindOf(file);
  if (!kind) throw new Error('Use a PDF, a Word file (.docx) or a text file, or paste the text.');
  if (file.size > 25 * 1024 * 1024) throw new Error('That file is over 25 MB. Export the pages you need or paste the text.');
  const buf = await file.arrayBuffer();
  let text = '';
  if (kind === 'pdf') text = await fromPdf(buf, !!opts.layout);
  else if (kind === 'docx') text = await fromDocx(buf);
  else text = new TextDecoder().decode(buf);
  const truncated = text.length > MAX_CHARS;
  text = text.slice(0, MAX_CHARS);
  if (!text.replace(/\s+/g, '').length) throw new Error(kind === 'pdf' ? 'No text found in that PDF: it may be a scan. Paste the text instead.' : 'No text found in that file.');
  return { text, kind, truncated };
}
