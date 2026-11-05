import { useMemo, useState } from 'react';
import { BarChart } from '../components/BarChart';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/ui';
import { formatMinutes } from '../lib/dates';
import { buildTeacherReport, isValidEmail, mailtoHref, reportSubject, reportText } from '../lib/report';
import { useStore } from '../lib/store';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Teacher() {
  const { state, update, notify } = useStore();
  const [name, setName] = useState(state.teacher.name);
  const [email, setEmail] = useState(state.teacher.email);
  const [busy, setBusy] = useState(false);
  const report = useMemo(() => buildTeacherReport(state), [state]);
  const body = useMemo(() => reportText(report), [report]);
  const saved = state.teacher.name === name.trim() && state.teacher.email === email.trim();
  const emailOk = isValidEmail(state.teacher.email);

  const save = () => {
    update((s) => ({ ...s, teacher: { name: name.trim(), email: email.trim() }, profile: s.profile ? { ...s.profile, hasTeacher: true } : s.profile }));
    notify('Teacher details saved', 'Stored only on this device.');
  };
  const pdf = async () => {
    setBusy(true);
    try {
      const { downloadReportPdf } = await import('../lib/pdf');
      downloadReportPdf(report);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${reportSubject(report)}\n\n${body}`);
      notify('Copied', 'The weekly summary is on your clipboard.');
    } catch {
      notify('Copy failed', 'Your browser blocked clipboard access — select the text below instead.');
    }
  };
  const w = report.week;

  return (
    <div>
      <PageHeader eyebrow="Mi profe" title="My Spanish teacher" subtitle="Share an honest weekly picture of your learning so lessons can focus where they matter." />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <section className="card h-fit p-5">
          <h2 className="text-lg font-semibold">Teacher details</h2>
          <form className="mt-3 grid gap-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <label className="text-sm font-medium">Name<input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dina" autoComplete="off" /></label>
            <label className="text-sm font-medium">Email<input type="email" className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@example.com" autoComplete="off" /></label>
            {email && !isValidEmail(email) && <p className="text-sm text-terracotta-dark">That email address doesn’t look complete.</p>}
            <button className="btn-dark w-fit" disabled={saved || (!!email && !isValidEmail(email))}>{saved ? 'Saved' : 'Save details'}</button>
          </form>

          <div className="mt-6 grid gap-2">
            <button className="btn-primary" onClick={pdf} disabled={busy}><Icon name="download" size={18} /> {busy ? 'Preparing…' : 'Download PDF report'}</button>
            {emailOk ? (
              <a className="btn-ghost" href={mailtoHref(state.teacher.email, reportSubject(report), body)}><Icon name="mail" size={18} /> Email my teacher</a>
            ) : (
              <button className="btn-ghost" disabled title="Save a valid teacher email first"><Icon name="mail" size={18} /> Email my teacher</button>
            )}
            <button className="btn-ghost" onClick={copy}><Icon name="copy" size={18} /> Copy summary</button>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-mute">
            “Email my teacher” opens your own email app with the address, subject and summary filled in — you review and send it yourself. Email links can’t attach files, so download the PDF and attach it manually if you’d like to include it.
          </p>
        </section>

        <section className="card p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">This week’s report</h2>
            <span className="text-sm text-ink-mute">{report.rangeLabel}</span>
          </div>
          {!report.hasData && <p className="mt-3 rounded-2xl bg-saffron-50 p-3 text-sm">No learning recorded yet this week. The report fills in as you study.</p>}
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Active time', formatMinutes(w.activeSeconds)],
              ['Study days', `${w.studyDays}/7`],
              ['Accuracy', w.accuracy === null ? '—' : `${Math.round(w.accuracy * 100)}%`],
              ['Recall 12h+', w.retention === null ? '—' : `${Math.round(w.retention * 100)}%`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-cream-100 p-3"><dt className="eyebrow">{k}</dt><dd className="mt-1 font-display text-2xl font-semibold">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-4"><BarChart title="Active minutes per day" unit="min" data={w.minutesByDay.map((v, i) => ({ label: DAYS[i], value: Math.round(v) }))} height={100} /></div>
          <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><p className="eyebrow mb-1">Strengths</p><ul className="list-disc space-y-1 pl-4 text-ink-soft">{report.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
            <div><p className="eyebrow mb-1">To work on</p><ul className="list-disc space-y-1 pl-4 text-ink-soft">{report.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul></div>
          </div>
          <div className="mt-4"><p className="eyebrow mb-1">Teaching priorities</p><ol className="list-decimal space-y-1 pl-5 text-sm">{report.priorities.map((s) => <li key={s}>{s}</li>)}</ol></div>
          <details className="mt-5 rounded-2xl bg-cream-100 p-3">
            <summary className="cursor-pointer text-sm font-semibold">Email text preview</summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink-soft">{body}</pre>
          </details>
        </section>
      </div>
    </div>
  );
}
