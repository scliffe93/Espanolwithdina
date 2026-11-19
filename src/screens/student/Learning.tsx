import { Icon } from '../../components/Icon';
import { FileCard } from '../../components/Files';
import { Empty, PageHeader } from '../../components/ui';
import { usePlatformQuery } from '../../lib/platform/context';
import { fmtDate } from '../../lib/platform/time';
import { navigate } from '../../lib/router';
import { DemoChip, ErrorCard, Loading, StudentNav } from './shared';

// ───────────────────────────────────────────────────────────────
// The learning bank — every explanation Dina has shared (a PDF or a
// photo of a page), newest first. It stays here whatever happens to the
// homework it came with, so the student can come back to it any time.
// ───────────────────────────────────────────────────────────────

export function LearningPage() {
  const { data, loading, error, reload } = usePlatformQuery((b) => b.resources());
  return (
    <div data-testid="student-learning">
      <PageHeader eyebrow="Apuntes · Learning" title="My learning bank" subtitle="The explanations Dina has shared with you. They stay here, so you can come back to them whenever you need." right={<DemoChip />} />
      <StudentNav page="learning" />
      {error && <ErrorCard error={error} retry={reload} />}
      {!error && loading && !data && <Loading what="your learning bank" />}
      {data && !data.length && (
        <Empty icon="book" title="Nothing here yet" body="When Dina shares an explanation with you, it appears here and stays." action={<button className="btn-ghost" onClick={() => navigate('student')}><Icon name="arrowLeft" size={16} /> Back to overview</button>} />
      )}
      {data && data.length > 0 && (
        <div className="grid gap-3">
          {data.map((r) => <FileCard key={r.id} file={r.file} label={`Shared ${fmtDate(r.createdAt)}`} />)}
        </div>
      )}
    </div>
  );
}
