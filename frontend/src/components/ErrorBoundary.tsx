import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Fair Path crashed:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="notice">
        <div
          className="sb-logo"
          style={{ margin: "0 auto 20px", width: 56, height: 56 }}
        />
        <h1>Something went wrong</h1>
        <p>The console hit an unexpected error. A reload usually fixes it.</p>
        <p className="muted" style={{ marginTop: 12 }}>
          <code>{this.state.error.message}</code>
        </p>
        <button
          className="btn btn-primary"
          style={{ width: "auto", display: "inline-flex", marginTop: 20 }}
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
