import { jsPDF } from 'jspdf';
import type { TeacherReport } from './report';
import { formatMinutes } from './dates';

// Professional A4 weekly report with charts drawn as vectors.
// Uses the built-in Helvetica font (WinAnsi), which covers Spanish accents.

const C = {
  ink: [30, 27, 24] as const,
  soft: [74, 67, 60] as const,
  mute: [122, 112, 103] as const,
  terracotta: [194, 89, 58] as const,
  terracottaLight: [224, 160, 138] as const,
  cream: [251, 246, 238] as const,
  line: [230, 222, 210] as const,
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Strips characters Helvetica/WinAnsi can't render (keeps Latin-1, á é ñ ¿ ¡ …). */
function safe(s: string): string {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/[≥]/g, '>=')
    .replace(/[▲▼·•]/g, (m) => (m === '·' ? '·' : m === '•' ? '-' : ''))
    .replace(/[^\x20-\xFF\n]/g, '');
}

function pct(n: number | null): string {
  return n === null ? '-' : `${Math.round(n * 100)}%`;
}

export function buildReportPdf(r: TeacherReport): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 16;
  let y = 0;

  const text = (s: string, x: number, yy: number, opts: { size?: number; bold?: boolean; color?: readonly number[]; align?: 'left' | 'right' | 'center'; maxW?: number } = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size ?? 10);
    doc.setTextColor(...((opts.color ?? C.ink) as [number, number, number]));
    const lines = opts.maxW ? doc.splitTextToSize(safe(s), opts.maxW) : safe(s);
    doc.text(lines, x, yy, { align: opts.align ?? 'left' });
    return Array.isArray(lines) ? lines.length : 1;
  };
  const ensure = (h: number) => {
    if (y + h > 282) {
      doc.addPage();
      y = 18;
    }
  };
  const heading = (s: string) => {
    ensure(14);
    text(s, M, y, { size: 12.5, bold: true });
    doc.setDrawColor(...C.terracotta);
    doc.setLineWidth(0.6);
    doc.line(M, y + 2, M + 14, y + 2);
    y += 8;
  };
  const bullets = (items: string[]) => {
    for (const it of items) {
      const lines = doc.splitTextToSize(safe(it), W - 2 * M - 6);
      ensure(lines.length * 5 + 1);
      doc.setFillColor(...C.terracotta);
      doc.circle(M + 1.2, y - 1.3, 0.8, 'F');
      text(it, M + 5, y, { maxW: W - 2 * M - 6, color: C.soft });
      y += lines.length * 4.8 + 1.5;
    }
  };

  // Header band
  doc.setFillColor(...C.terracotta);
  doc.rect(0, 0, W, 34, 'F');
  text('Learning with Dina', M, 15, { size: 20, bold: true, color: [255, 255, 255] });
  text('Tu vida en español empieza aquí · Your Spanish Life Starts Here', M, 22, { size: 8.5, color: [251, 230, 220] });
  text('Weekly progress report', W - M, 13, { size: 12, bold: true, color: [255, 255, 255], align: 'right' });
  text(r.rangeLabel, W - M, 19.5, { size: 9.5, color: [251, 230, 220], align: 'right' });
  text(`Learner: ${r.learnerName}${r.teacherName ? `  ·  Prepared for: ${r.teacherName}` : ''}`, W - M, 26, { size: 9, color: [251, 230, 220], align: 'right' });
  y = 44;

  if (!r.hasData) {
    text('No learning activity has been recorded for this week yet.', M, y, { size: 11, color: C.soft });
    y += 8;
  }

  // KPI tiles
  const w = r.week, p = r.prev;
  const kpis: [string, string, string][] = [
    ['Active time', formatMinutes(w.activeSeconds), `prev. ${formatMinutes(p.activeSeconds)}`],
    ['Study days', `${w.studyDays} / 7`, `prev. ${p.studyDays}`],
    ['Accuracy', pct(w.accuracy), `prev. ${pct(p.accuracy)}`],
    ['Delayed recall', pct(w.retention), w.retentionAttempts ? `${w.retentionAttempts} items` : 'no delayed reviews'],
    ['Lessons', String(w.lessonsCompleted), `prev. ${p.lessonsCompleted}`],
    ['Exercises', String(w.exercisesAttempted), `${w.exercisesCorrect} correct`],
    ['Speaking', String(w.speakingAttempts), 'recordings / spoken replies'],
    ['New words', String(r.newVocab.length), 'added to deck'],
  ];
  const tw = (W - 2 * M - 3 * 4) / 4;
  kpis.forEach(([label, value, sub], i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = M + col * (tw + 4), yy = y + row * 24;
    doc.setFillColor(...C.cream);
    doc.roundedRect(x, yy, tw, 20, 2.5, 2.5, 'F');
    text(label.toUpperCase(), x + 3.5, yy + 5.5, { size: 6.8, bold: true, color: C.mute });
    text(value, x + 3.5, yy + 12.5, { size: 13, bold: true });
    text(sub, x + 3.5, yy + 17, { size: 7, color: C.mute });
  });
  y += 54;

  // Chart 1: minutes per day
  const chart = (title: string, data: { label: string; value: number }[], x: number, cw: number, unit: string, highlightLast: boolean) => {
    const ch = 38;
    text(title, x, y, { size: 9.5, bold: true });
    const top = y + 4, base = top + ch;
    const max = Math.max(1, ...data.map((d) => d.value));
    const nice = max <= 10 ? 10 : max <= 30 ? Math.ceil(max / 10) * 10 : Math.ceil(max / 30) * 30;
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    [0.5, 1].forEach((g) => {
      const gy = base - ch * g;
      doc.setLineDashPattern([0.8, 0.8], 0);
      doc.line(x, gy, x + cw, gy);
      doc.setLineDashPattern([], 0);
      text(`${Math.round(nice * g)}`, x + cw, gy - 0.8, { size: 6, color: C.mute, align: 'right' });
    });
    doc.setDrawColor(...C.mute);
    doc.line(x, base, x + cw, base);
    const bw = cw / data.length;
    data.forEach((d, i) => {
      const h = (d.value / nice) * ch;
      const strong = !highlightLast || i === data.length - 1;
      doc.setFillColor(...((strong ? C.terracotta : C.terracottaLight) as [number, number, number]));
      if (h > 0) doc.roundedRect(x + i * bw + bw * 0.22, base - h, bw * 0.56, h, 0.8, 0.8, 'F');
      text(d.label, x + i * bw + bw / 2, base + 4, { size: 6.5, color: C.mute, align: 'center' });
      if (d.value > 0) text(`${d.value}`, x + i * bw + bw / 2, base - h - 1.2, { size: 6.2, color: C.soft, align: 'center' });
    });
    text(unit, x, base + 9, { size: 6.5, color: C.mute });
  };
  const half = (W - 2 * M - 8) / 2;
  chart('Active minutes per day', w.minutesByDay.map((v, i) => ({ label: DAYS[i], value: Math.round(v) })), M, half, 'minutes', false);
  chart('Active minutes per week (last 4)', r.history.map((h) => ({ label: h.label, value: h.minutes })), M + half + 8, half, 'minutes - this week highlighted', true);
  y += 56;

  heading('What was practised');
  bullets([
    `Verbs (${r.verbsPracticed.length}): ${r.verbsPracticed.map((v) => `${v.inf}${v.mastery?.accuracy != null ? ` ${pct(v.mastery.accuracy)}` : ''}`).join(', ') || 'none this week'}`,
    `Tenses: ${r.tenses.join(', ') || 'none this week'}`,
    `Story chapters completed: ${r.scenes.join(', ') || 'none this week'}`,
    `New vocabulary: ${r.newVocab.join(', ') || 'none this week'}`,
    `Listening time (audio playing): ${formatMinutes(w.listeningSeconds)}`,
  ]);

  if (r.levels) {
    heading('Current skill levels (CEFR estimate)');
    ensure(10);
    const entries = Object.entries(r.levels);
    const cw = (W - 2 * M) / entries.length;
    entries.forEach(([k, v], i) => {
      doc.setFillColor(...C.cream);
      doc.roundedRect(M + i * cw + 1, y - 4, cw - 2, 11, 2, 2, 'F');
      text(v, M + i * cw + cw / 2, y + 1.5, { size: 10.5, bold: true, align: 'center' });
      text(k, M + i * cw + cw / 2, y + 5.5, { size: 6.5, color: C.mute, align: 'center' });
    });
    y += 13;
    text(`Variety: ${r.region}. Speaking level is an estimate; in-app speaking practice is not automatically scored.`, M, y, { size: 7.5, color: C.mute });
    y += 7;
  }

  heading('Recurring errors');
  if (r.recurringErrors.length) {
    bullets(r.recurringErrors.slice(0, 6).map((e) => `${e.label} - ${e.count}x${e.example ? ` (e.g. ${e.example})` : ''}`));
  } else bullets(['No recurring errors recorded this week.']);

  heading('Strengths');
  bullets(r.strengths);
  heading('Areas to work on');
  bullets(r.weaknesses);

  heading('Learning techniques used');
  bullets(r.techniques.length
    ? r.techniques.map((t) => `${t.label}: used ${t.used}x${t.delayedRate !== null ? `, ${pct(t.delayedRate)} recalled after 12h+` : ''}`)
    : ['No memory aids used this week.']);

  heading('Recommended teaching priorities');
  r.priorities.forEach((pr, i) => {
    const lines = doc.splitTextToSize(safe(pr), W - 2 * M - 10);
    ensure(lines.length * 5 + 3);
    doc.setFillColor(...C.terracotta);
    doc.circle(M + 2.5, y - 1.4, 2.6, 'F');
    text(String(i + 1), M + 2.5, y - 0.3, { size: 8, bold: true, color: [255, 255, 255], align: 'center' });
    text(pr, M + 8, y, { maxW: W - 2 * M - 10 });
    y += lines.length * 4.8 + 2.5;
  });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.line);
    doc.line(M, 287, W - M, 287);
    text(`Generated by Learning with Dina on ${r.generatedAt.toLocaleDateString('en-GB')} from learning data recorded on the learner's device. Active time counts only focused, interactive study.`, M, 291, { size: 6.5, color: C.mute });
    text(`${i} / ${pages}`, W - M, 291, { size: 6.5, color: C.mute, align: 'right' });
  }
  return doc;
}

export function downloadReportPdf(r: TeacherReport) {
  const doc = buildReportPdf(r);
  const name = `LearningWithDina-report-${r.learnerName.replace(/[^\w-]+/g, '_')}-${r.week.dayKeys[0]}.pdf`;
  doc.save(name);
}
