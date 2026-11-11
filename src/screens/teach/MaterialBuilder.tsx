import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { TENSES, type Tense } from '../../data/verbs';
import { extractText, sourceKindOf, type SourceKind } from '../../lib/extractText';
import { MATERIAL_KIND_LABEL, analyseText, buildMaterialItems, promptFor, type MaterialAnalysis, type MaterialKind, type MaterialSet } from '../../lib/material';
import type { Cefr } from '../../types';
import { Field } from './shared';

// ───────────────────────────────────────────────────────────────
// The teacher's material → exercises. Drop in a PDF, a Word file or a
// text file, or paste text; the app reads it in the browser, shows what
// it found (verbs by tense, vocabulary), and builds a set of exercises
// from the document's own sentences that the teacher previews, tunes and
// regenerates before assigning. Nothing leaves the browser.
// ───────────────────────────────────────────────────────────────

const KINDS: MaterialKind[] = ['cloze', 'build', 'dictation', 'vocab'];

export function MaterialBuilder({ onChange, maxLevel = null, compact = false }: { onChange: (m: MaterialSet | null) => void; maxLevel?: Cefr | null; compact?: boolean }) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<SourceKind>('paste');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MaterialAnalysis | null>(null);
  const [count, setCount] = useState(10);
  const [kinds, setKinds] = useState<MaterialKind[]>(['cloze', 'build', 'dictation', 'vocab']);
  const [tenses, setTenses] = useState<Tense[]>([]);
  const [questions, setQuestions] = useState('');
  const [seed, setSeed] = useState(1);
  const [set, setSet] = useState<MaterialSet | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setNote(null);
    if (!sourceKindOf(file)) return setError('Use a PDF, a Word file (.docx) or a text file, or paste the text below.');
    setReading(true);
    try {
      const r = await extractText(file);
      setText(r.text);
      setSource(r.kind);
      setTitle((t) => t || file.name.replace(/\.[a-z0-9]+$/i, ''));
      if (r.truncated) setNote('The document is long: the first 20,000 characters are used.');
    } catch (e) {
      setError((e as Error).message || 'Could not read that file.');
    } finally {
      setReading(false);
    }
  };

  const analyse = () => {
    setError(null);
    if (text.trim().split(/\s+/).length < 20) return setError('Add at least a paragraph of Spanish (20 words or more).');
    const a = analyseText(text);
    if (!a.sentences.length) return setError('No usable sentences found: the text needs full sentences of 4 to 24 words.');
    setAnalysis(a);
    setTenses(a.tenses.slice(0, 2).map((t) => t.id));
    setSet(null);
  };

  // A seeded shuffle so "Regenerate" gives a different but reproducible set.
  const rng = useMemo(() => { let x = seed * 9301 + 49297; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }, [seed]);
  useEffect(() => {
    if (!analysis) return;
    const items = buildMaterialItems(analysis, { count, kinds, tenses, maxLevel, questions: questions.split('\n'), rng });
    const excerpt = text.replace(/\s+/g, ' ').trim().slice(0, 600);
    const m: MaterialSet = { title: title.trim() || 'Lesson material', excerpt, source, words: analysis.words, items };
    setSet(m);
    onChange(items.length ? m : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, count, kinds, tenses, questions, seed, title, maxLevel]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="grid gap-3" data-testid="material-builder">
      {!analysis && (
        <>
          <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
            <button type="button" className="btn-soft !py-2" onClick={() => fileRef.current?.click()} disabled={reading} data-testid="material-file-btn"><Icon name="book" size={16} /> {reading ? 'Reading…' : 'Choose a file'}</button>
            <span className="text-xs text-ink-mute">PDF, Word (.docx) or text, read here in your browser. Scanned PDFs have no text: paste it instead.</span>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,application/pdf,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} data-testid="material-file" />
          </div>
          <Field id="material-text" label="Or paste the text" hint="A page from your course book, a reading, a transcript, your own worksheet.">
            <textarea id="material-text" className={`input ${compact ? 'min-h-[120px]' : 'min-h-[160px]'}`} value={text} onChange={(e) => { setText(e.target.value); setSource('paste'); }} lang="es" placeholder="Pega aquí el texto de la lección…" data-testid="material-text" />
          </Field>
          <Field id="material-title" label="Title the student sees">
            <input id="material-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Unidad 3: En el mercado" data-testid="material-title" />
          </Field>
          {note && <p className="text-xs text-ink-mute">{note}</p>}
          {error && <p role="alert" className="rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-dark">{error}</p>}
          <div><button type="button" className="btn-dark !py-2" onClick={analyse} disabled={reading || !text.trim()} data-testid="material-analyse"><Icon name="sparkle" size={16} /> Read the text and build exercises</button></div>
        </>
      )}
      {analysis && (
        <>
          <div className="rounded-2xl bg-cream-100 p-3 text-sm" data-testid="material-summary">
            <p className="font-semibold">{title.trim() || 'Lesson material'} <span className="font-normal text-ink-mute">· {analysis.words} words · {analysis.sentences.length} usable sentences · {analysis.verbs.length} verbs the app knows · {analysis.vocab.length} vocabulary words</span></p>
            {analysis.tenses.length > 0 && <p className="mt-1 text-ink-soft">Tenses in the text: {analysis.tenses.map((t) => `${t.label} (${t.count})`).join(', ')}.</p>}
            {analysis.verbs.length > 0 && <p className="mt-1 text-ink-soft">Most used verbs: {analysis.verbs.slice(0, 8).map((v) => `${v.inf} ${v.count}×`).join(', ')}.</p>}
            <button type="button" className="mt-2 text-xs font-semibold text-azul underline-offset-2 hover:underline" onClick={() => { setAnalysis(null); setSet(null); onChange(null); }}>Change the text</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset><legend className="mb-1 text-sm font-medium">Exercise types</legend>
              <div className="flex flex-wrap gap-2">{KINDS.map((k) => <button key={k} type="button" aria-pressed={kinds.includes(k)} onClick={() => setKinds((l) => (l.length === 1 && l.includes(k) ? l : toggle(l, k)))} className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${kinds.includes(k) ? 'bg-ink text-white' : 'bg-cream-100 text-ink hover:bg-cream-200'}`} data-testid={`material-kind-${k}`}>{MATERIAL_KIND_LABEL[k]}</button>)}</div>
            </fieldset>
            <fieldset><legend className="mb-1 text-sm font-medium">Gap-fill tenses</legend>
              <div className="flex flex-wrap gap-2">{analysis.tenses.map((t) => <button key={t.id} type="button" aria-pressed={tenses.includes(t.id)} onClick={() => setTenses((l) => toggle(l, t.id))} className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${tenses.includes(t.id) ? 'bg-ink text-white' : 'bg-cream-100 text-ink hover:bg-cream-200'}`}>{TENSES.find((x) => x.id === t.id)?.label} <span className="opacity-60">{t.count}</span></button>)}{analysis.tenses.length === 0 && <span className="text-xs text-ink-mute">No verb forms the app knows were found.</span>}</div>
              <p className="mt-1 text-xs text-ink-mute">None selected = any tense.{maxLevel ? ` Verbs above the student’s ceiling (${maxLevel}) are skipped.` : ''}</p>
            </fieldset>
            <Field id="material-count" label="How many exercises"><input id="material-count" type="number" min={4} max={24} className="input !w-28" value={count} onChange={(e) => setCount(Math.max(4, Math.min(24, Number(e.target.value) || 10)))} data-testid="material-count" /></Field>
            <Field id="material-questions" label="Your own questions (one per line, marked by you)"><textarea id="material-questions" className="input min-h-[72px]" value={questions} onChange={(e) => setQuestions(e.target.value)} lang="es" placeholder="¿Qué compró el lunes?" data-testid="material-questions" /></Field>
          </div>
          {set && (
            <div className="rounded-2xl bg-white p-3 ring-1 ring-ink/10" data-testid="material-preview">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="eyebrow !text-[10px]">Preview · {set.items.length} exercise{set.items.length === 1 ? '' : 's'}</p>
                <button type="button" className="ctrl !py-1 !text-xs" onClick={() => setSeed((s) => s + 1)} data-testid="material-regenerate"><Icon name="refresh" size={13} /> Regenerate</button>
              </div>
              <ol className="mt-2 grid gap-1 text-sm">
                {set.items.map((it, i) => (
                  <li key={i} className="flex gap-2 rounded-lg bg-cream-50 px-2.5 py-1.5" data-testid="material-item">
                    <span className="w-5 shrink-0 text-xs text-ink-mute">{i + 1}.</span>
                    <span className="min-w-0 flex-1"><span className="mr-1.5 rounded bg-cream-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">{MATERIAL_KIND_LABEL[it.kind]}</span><span lang="es">{promptFor(it)}</span>{it.kind === 'cloze' && <span className="text-xs text-ink-mute"> → {it.answer} ({it.inf}, {TENSES.find((t) => t.id === it.tense)?.label.toLowerCase()})</span>}</span>
                  </li>
                ))}
              </ol>
              {set.items.length === 0 && <p className="text-sm text-ink-mute">Nothing could be built with these settings. Add exercise types or pick other tenses.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
