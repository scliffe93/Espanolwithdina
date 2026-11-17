// Prints the text the lesson room reads from a PDF, for checking the reader against a real plan.
// Usage: npx tsx scripts/pdf-text.mts <file.pdf>
import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { layoutPdfItems, type PdfItem } from '../src/lib/pdfLayout';
export async function pdfText(file: string): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(file)) }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) { const c = await (await doc.getPage(p)).getTextContent(); if (parts.length) parts.push(''); parts.push(...layoutPdfItems(c.items as PdfItem[])); }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
if (process.argv[1]?.endsWith("pdf-text.mts") && process.argv[2]) console.log((await pdfText(process.argv[2])).replace(/\t/g, ' ⇥ '));
