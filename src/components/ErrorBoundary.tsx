import { Component, type ErrorInfo, type ReactNode } from 'react';
import { buildReport, logIssue, refreshApp, reportFailure } from '../lib/diagnostics';
import { Icon } from './Icon';

/**
 * Catches a page that fails to draw. Instead of a blank screen the learner sees what happened and three ways on:
 * try again, go somewhere else, or refresh the app. The problem is also added to the troubleshooting list in Settings.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null; copied: boolean }> {
  state = { error: null as Error | null, copied: false };

  static getDerivedStateFromError(error: Error) {
    return { error, copied: false };
  }

  private tries = 0;
  /** True once self-repair has been tried and has not worked: only then is the learner shown the recovery screen. */
  private final = false;
  componentDidCatch(error: Error, info: ErrorInfo) {
    const message = error.message || String(error);
    const stack = `${error.stack ?? ''}\n${info.componentStack ?? ''}`.trim();
    // Self-repair, in two steps, before the learner is shown anything to do.
    // 1. Draw the page again: a passing fault (data that arrived half-way through) clears by itself.
    let already = false; try { already = sessionStorage.getItem('lwd-auto-refresh') === (this.props.resetKey ?? 'page'); } catch { /* no storage */ }
    if (this.tries === 0 && !already) { this.tries = 1; logIssue('note', `Page fault, trying again: ${message}`.slice(0, 300)); window.setTimeout(() => this.setState({ error: null, copied: false }), 350); return; }
    // 2. Refresh the app once: a stale or half-updated copy is the usual cause of a fault that repeats.
    let refreshed = false;
    try { refreshed = sessionStorage.getItem('lwd-auto-refresh') === this.props.resetKey; if (!refreshed) sessionStorage.setItem('lwd-auto-refresh', this.props.resetKey ?? 'page'); } catch { refreshed = true; }
    if (!refreshed) { logIssue('note', `Page fault twice, refreshing the app: ${message}`.slice(0, 300)); void refreshApp(); return; }
    // Neither worked: tell the administrator what was tried.
    this.final = true; this.forceUpdate();
    reportFailure('A page keeps failing', ['Drew the page again', 'Cleared the saved copy of the app and reloaded it'], message);
    logIssue('error', message, stack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Moving to another page clears the error.
    if (prev.resetKey !== this.props.resetKey) { this.tries = 0; this.final = false; }
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null, copied: false });
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (!this.final) return <p className="py-10 text-center text-ink-mute" role="status" data-testid="error-repairing">One moment: putting this page right…</p>;
    const copy = async () => {
      try { await navigator.clipboard.writeText(buildReport()); this.setState({ copied: true }); } catch { /* clipboard blocked */ }
    };
    return (
      <div className="mx-auto max-w-xl py-6" role="alert" data-testid="error-screen">
        <div className="card p-6">
          <p className="eyebrow">Algo salió mal · Something went wrong</p>
          <h2 className="mt-1 text-2xl font-semibold">This page hit a problem</h2>
          <p className="mt-2 text-ink-soft">Your progress is safe. The app has already tried to fix this by itself: it drew the page again and refreshed its saved copy. That did not work, so the team has been told what happened and what was tried.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => { this.tries = 0; this.final = false; this.setState({ error: null, copied: false }); }} data-testid="error-retry"><Icon name="refresh" size={18} /> Try again</button>
            <button className="btn-ghost" onClick={() => { location.hash = '#/world'; this.setState({ error: null, copied: false }); }}>Go to the start</button>
            <button className="btn-ghost" onClick={() => void refreshApp()}>Refresh the app</button>
          </div>
          <details className="mt-5 text-sm text-ink-mute">
            <summary className="cursor-pointer">What happened</summary>
            <p className="mt-2 break-words font-mono text-xs">{this.state.error.message || String(this.state.error)}</p>
            <button className="ctrl mt-3" onClick={() => void copy()}>{this.state.copied ? 'Copied' : 'Copy a report for Dina'}</button>
            <p className="mt-2">If you are logged in, this has already been sent to the app’s administrator. It lists the problem and your device type, never your password or answers. You can find it later in Settings, under Troubleshooting.</p>
          </details>
        </div>
      </div>
    );
  }
}
