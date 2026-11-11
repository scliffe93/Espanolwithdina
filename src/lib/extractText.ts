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

async function fromPdf(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, MAX_PAGES); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let line = '';
    for (const item of content.items as { str?: string; hasEOL?: boolean }[]) {
      if (typeof item.str !== 'string') continue;
      line += item.str;
      if (item.hasEOL) { parts.push(line); line = ''; } else line += ' ';
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
export async function extractText(file: File): Promise<{ text: string; kind: SourceKind; truncated: boolean }> {
  const kind = sourceKindOf(file);
  if (!kind) throw new Error('Use a PDF, a Word file (.docx) or a text file, or paste the text.');
  if (file.size > 25 * 1024 * 1024) throw new Error('That file is over 25 MB. Export the pages you need or paste the text.');
  const buf = await file.arrayBuffer();
  let text = '';
  if (kind === 'pdf') text = await fromPdf(buf);
  else if (kind === 'docx') text = await fromDocx(buf);
  else text = new TextDecoder().decode(buf);
  const truncated = text.length > MAX_CHARS;
  text = text.slice(0, MAX_CHARS);
  if (!text.replace(/\s+/g, '').length) throw new Error(kind === 'pdf' ? 'No text found in that PDF: it may be a scan. Paste the text instead.' : 'No text found in that file.');
  return { text, kind, truncated };
}
