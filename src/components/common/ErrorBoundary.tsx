import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorFallback } from '@/components/common/ErrorFallback';

interface FallbackProps {
  error: unknown;
  reset: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI. Defaults to `ErrorFallback` with a "Try again" button. */
  fallback?: (props: FallbackProps) => ReactNode;
  /**
   * Called when the user retries. Pass TanStack Query's `reset` from `QueryErrorResetBoundary`
   * so failed queries refetch instead of re-throwing their cached error.
   */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

/**
 * Feature-level error boundary: keeps one failing section from taking down the whole page.
 * (React still requires a class component for error boundaries.)
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    // Replaced by Sentry reporting in P1.
    console.error('ErrorBoundary caught an error', error, info.componentStack);
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      const props = { error: this.state.error, reset: this.reset };
      return this.props.fallback ? (
        this.props.fallback(props)
      ) : (
        <ErrorFallback reset={this.reset} />
      );
    }
    return this.props.children;
  }
}
