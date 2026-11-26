import { Icon } from '../../components/Icon';
import { Empty, PageHeader } from '../../components/ui';
import { describeActivity } from '../../lib/platform/homework';
import { markLabel } from '../../lib/platform/marking';
import { fmtDateTime, relative } from '../../lib/platform/time';
import type { FeedbackKind } from '../../lib/platform/types';
import { navigate } from '../../lib/router';
import { usePlatformQuery } from '../../lib/platform/context';
import { boardOf, summaryOf } from '../../lib/platform/lessonExtras';
import { Whiteboard } from '../room/Whiteboard';
import { DemoChip, ErrorCard, FEEDBACK_META, FeedbackItem, Loading, Section, StudentNav, useStudentData } from './shared';

// ───────────────────────────────────────────────────────────────
// Everything Dina has written to the student: general feedback by
// kind, plus the feedback attached to reviewed homework.
// ───────────────────────────────────────────────────────────────

const KINDS: FeedbackKind[] = ['comment', 'correction', 'recommendation'];

export function FeedbackPage() {
  const { data, loading, error, reload } = useStudentData();
  const now = Date.now();
  const reviewed = data ? data.homework.filter((h) => h.feedback).sort((a, b) => (b.feedback?.at ?? '').localeCompare(a.feedback?.at ?? '')) : [];
  // What Dina published when a lesson ended: her summary and the whiteboard.
  const lessons = usePlatformQuery((b) => b.lessons(), []);
  const fromLessons = (lessons.data ?? []).map((l) => ({ l, summary: summaryOf(l.blocks), board: boardOf(l.blocks) })).filter((x) => x.summary || (x.board.open && (x.board.text || x.board.strokes.length)));
  const total = (data?.feedback.length ?? 0) + reviewed.length + fromLessons.length;

  return (
    <div data-testid="student-feedback">
      <PageHeader eyebrow="De Dina · Feedback" title="Feedback from Dina" subtitle="Dina’s comments on your lessons and homework." right={<DemoChip />} />
      <StudentNav page="feedback" />
      {error && <ErrorCard error={error} retry={reload} />}
      {!error && loading && !data && <Loading what="your feedback" />}
      {data && total === 0 && (
        <Empty icon="chat" title="No feedback yet" body="After a lesson, or once Dina reviews your homework, her notes appear here." action={<button className="btn-ghost" onClick={() => navigate('student')}><Icon name="arrowLeft" size={16} /> Back to overview</button>} />
      )}
      {data && total > 0 && (
        <div className="grid gap-4">
          {fromLessons.length > 0 && (
            <Section eyebrow="After each lesson" title={`From your lessons · ${fromLessons.length}`}>
              <ul className="grid gap-3" data-testid="feedback-lessons">
                {fromLessons.map(({ l, summary, board }) => (
                  <li key={l.id} className="rounded-2xl bg-white/70 p-4 ring-1 ring-ink/5" data-testid="feedback-lesson">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="font-semibold">{l.title}</p>
                      <p className="text-xs text-ink-mute">{new Date(`${l.date || l.createdAt.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    </div>
                    {summary && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-olive-50 px-3 py-2 leading-relaxed" data-testid="feedback-summary">{summary}</p>}
                    {board.open && (board.text || board.strokes.length > 0) && <div className="mt-3"><p className="eyebrow mb-1.5">Pizarra · The whiteboard</p><Whiteboard board={board} /></div>}
                    <button className="ctrl mt-3" onClick={() => navigate(`student/room/${l.id}`)}><Icon name="eye" size={14} /> Open the lesson, with your answers and notes</button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {KINDS.map((k) => {
            const list = data.feedback.filter((f) => f.kind === k);
            const m = FEEDBACK_META[k];
            return (
              <Section key={k} eyebrow={m.blurb} title={`${m.plural} · ${list.length}`}>
                {list.length ? <ul className="grid gap-2">{list.map((f, i) => <FeedbackItem key={f.id} f={f} now={now} index={i} />)}</ul> : <p className="text-sm text-ink-mute">None yet.</p>}
              </Section>
            );
          })}
          <Section eyebrow="On your homework" title={`Reviewed homework · ${reviewed.length}`}>
            {reviewed.length ? (
              <ul className="grid gap-2">
                {reviewed.map((h) => (
                  <li key={h.id} className="rounded-2xl bg-white/70 p-3 ring-1 ring-ink/5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="font-semibold">{h.activity.title}</p>
                      <p className="text-xs text-ink-mute">{fmtDateTime(h.feedback!.at)} · {relative(h.feedback!.at, now)}</p>
                    </div>
                    <p className="text-xs text-ink-mute">{describeActivity(h.activity)}{h.result?.summary ? ` · ${h.result.summary}` : ''}{markLabel(h.marking) ? ` · marked ${markLabel(h.marking)}` : ''}{h.marking?.corrections?.length ? ` · ${h.marking.corrections.length} correction${h.marking.corrections.length === 1 ? '' : 's'}` : ''}</p>
                    <p className="mt-2 rounded-xl bg-olive-50 px-3 py-2 text-sm leading-relaxed">{h.feedback!.body}</p>
                    <button className="ctrl mt-2" onClick={() => navigate(`homework/${h.id}`)}><Icon name="eye" size={14} /> {h.marking ? 'See the marking' : 'View homework'}</button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-mute">No reviewed homework yet.</p>}
          </Section>
        </div>
      )}
    </div>
  );
}
