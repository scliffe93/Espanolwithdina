import { Component, type ErrorInfo, type ReactNode } from 'react';
import { buildReport, logIssue, refreshApp } from '../lib/diagnostics';
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

  componentDidCatch(error: Error, info: ErrorInfo) {
    logIssue('crash', error.message || String(error), `${error.stack ?? ''}\n${info.componentStack ?? ''}`.trim());
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Moving to another page clears the error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null, copied: false });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const copy = async () => {
      try { await navigator.clipboard.writeText(buildReport()); this.setState({ copied: true }); } catch { /* clipboard blocked */ }
    };
    return (
      <div className="mx-auto max-w-xl py-6" role="alert" data-testid="error-screen">
        <div className="card p-6">
          <p className="eyebrow">Algo salió mal · Something went wrong</p>
          <h2 className="mt-1 text-2xl font-semibold">This page hit a problem</h2>
          <p className="mt-2 text-ink-soft">Your progress is safe. Try again, and if it keeps happening, refresh the app.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => this.setState({ error: null, copied: false })} data-testid="error-retry"><Icon name="refresh" size={18} /> Try again</button>
            <button className="btn-ghost" onClick={() => { location.hash = '#/world'; this.setState({ error: null, copied: false }); }}>Go to the start</button>
            <button className="btn-ghost" onClick={() => void refreshApp()}>Refresh the app</button>
          </div>
          <details className="mt-5 text-sm text-ink-mute">
            <summary className="cursor-pointer">What happened</summary>
            <p className="mt-2 break-words font-mono text-xs">{this.state.error.message || String(this.state.error)}</p>
            <button className="ctrl mt-3" onClick={() => void copy()}>{this.state.copied ? 'Copied' : 'Copy a report for Dina'}</button>
            <p className="mt-2">The report lists the problem and your device type. It has no name, password or answers in it. You can also find it later in Settings, under Troubleshooting.</p>
          </details>
        </div>
      </div>
    );
  }
}
