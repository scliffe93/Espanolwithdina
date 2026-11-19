import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { usePlatform } from '../lib/platform/context';
import { fileProblem } from '../lib/platform/backend';
import type { FileRef } from '../lib/platform/types';

// ───────────────────────────────────────────────────────────────
// The teacher's own files: choosing and uploading them (teacher), and
// reading them in the page (everyone). A PDF is drawn page by page with
// pdf.js, so it reads the same on an iPad, a phone and a laptop, and
// scrolls with the page instead of inside a small box.
// ───────────────────────────────────────────────────────────────

const MAX_PAGES = 40;
export const fileSize = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const isPdf = (f: FileRef) => f.mime === 'application/pdf';

/** Shows a file in the page: every page of a PDF, or the photo. */
export function FileViewer({ file }: { file: FileRef }) {
  const { backend } = usePlatform();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready'>('loading');
  const [more, setMore] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!backend) return;
    let off = false;
    let made: string | null = null;
    setUrl(null); setError(null); setState('loading'); setMore(0);
    (async () => {
      try {
        const blob = await backend.fileBlob(file.id);
        if (off) return;
        const link = URL.createObjectURL(isPdf(file) ? blob : blob.slice(0, blob.size, file.mime));
        made = link;
        setUrl(link);
        if (!isPdf(file)) return setState('ready');
        const data = new Uint8Array(await blob.arrayBuffer());
        const pdfjs = await import('pdfjs-dist');
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const doc = await pdfjs.getDocument({ data }).promise;
        const host = box.current;
        if (off || !host) return;
        host.replaceChildren();
        const width = Math.max(280, host.clientWidth);
        const sharp = Math.min(2, window.devicePixelRatio || 1);
        for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * sharp });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = 'block w-full rounded-xl bg-white ring-1 ring-ink/10';
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `${file.name}, page ${n} of ${doc.numPages}`);
          canvas.dataset.testid = 'file-page';
          await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport } as never).promise;
          if (off) return;
          host.appendChild(canvas);
          if (n === 1) setState('ready');
        }
        setMore(Math.max(0, doc.numPages - MAX_PAGES));
        setState('ready');
      } catch (e) {
        if (!off) setError((e as Error).message || 'The file could not be opened.');
      }
    })();
    return () => { off = true; if (made) URL.revokeObjectURL(made); };
  }, [backend, file.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid gap-2" data-testid="file-viewer">
      {error && <p role="alert" className="rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{error}</p>}
      {!error && state === 'loading' && <p className="text-sm text-ink-mute">Opening {file.name}…</p>}
      {isPdf(file) ? <div ref={box} className="grid gap-2" /> : url && <img src={url} alt={file.name} className="block w-full rounded-xl ring-1 ring-ink/10" data-testid="file-image" />}
      {more > 0 && <p className="text-xs text-ink-mute">The first {MAX_PAGES} pages are shown. Open the file to see the other {more}.</p>}
      {url && <p><a className="text-sm font-semibold text-azul underline-offset-2 hover:underline" href={url} target="_blank" rel="noreferrer" download={file.name}>Download or open on its own</a></p>}
    </div>
  );
}

/** One file as a row that opens in place. */
export function FileCard({ file, label, defaultOpen = false, right }: { file: FileRef; label?: string; defaultOpen?: boolean; right?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-ink/10" data-testid="file-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cream-100 text-ink-soft" aria-hidden><Icon name="book" size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{file.name}</span>
          <span className="block text-xs text-ink-mute">{label ? `${label} · ` : ''}{isPdf(file) ? 'PDF' : 'Photo'} · {fileSize(file.size)}</span>
        </span>
        {right}
        <button type="button" className="ctrl" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="file-open"><Icon name={open ? 'x' : 'eye'} size={15} /> {open ? 'Close' : 'Open'}</button>
      </div>
      {open && <div className="mt-3"><FileViewer file={file} /></div>}
    </div>
  );
}

/** Teacher: choose one or more PDFs or photos. Each is uploaded as soon as it is chosen. */
export function FilePicker({ id, files, onChange, onBusy, button = 'Upload a PDF or photo' }: { id: string; files: FileRef[]; onChange: (f: FileRef[]) => void; onBusy?: (busy: boolean) => void; button?: string }) {
  const { backend } = usePlatform();
  const input = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useRef(files);
  list.current = files;

  const add = async (chosen: FileList | null) => {
    if (!backend || !chosen?.length) return;
    setError(null);
    onBusy?.(true);
    const problems: string[] = [];
    for (const f of Array.from(chosen)) {
      if (list.current.length >= 8) { problems.push('Eight files is the most for one homework.'); break; }
      const problem = fileProblem(f);
      if (problem) { problems.push(problem); continue; }
      setSending(f.name);
      try {
        const ref = await backend.uploadFile(f);
        list.current = [...list.current, ref];
        onChange(list.current);
      } catch (e) {
        problems.push((e as Error).message || `“${f.name}” couldn’t be uploaded.`);
      }
    }
    setSending(null);
    onBusy?.(false);
    if (problems.length) setError(problems.join(' '));
    if (input.current) input.current.value = '';
  };

  return (
    <div className="grid gap-2" data-testid={id}>
      {files.length > 0 && (
        <ul className="grid gap-1.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-ink/10" data-testid={`${id}-item`}>
              <Icon name="check" size={15} className="shrink-0 text-olive" />
              <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
              <span className="shrink-0 text-xs text-ink-mute">{fileSize(f.size)}</span>
              <button type="button" className="ctrl !px-2 !py-1" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((x) => x.id !== f.id))}><Icon name="x" size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-soft !py-2" onClick={() => input.current?.click()} disabled={!!sending}><Icon name="upload" size={16} /> {sending ? 'Uploading…' : files.length ? 'Add another' : button}</button>
        {sending && <span className="text-xs text-ink-mute" aria-live="polite">Uploading {sending}…</span>}
        <input ref={input} id={`${id}-input`} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => add(e.target.files)} data-testid={`${id}-input`} />
      </div>
      {error && <p role="alert" className="rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{error}</p>}
    </div>
  );
}
