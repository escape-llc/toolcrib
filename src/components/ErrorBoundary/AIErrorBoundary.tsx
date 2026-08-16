import { Component, ErrorInfo, ReactNode } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import { injectInteractionStyles } from '../../theme/interactionStyles';
import { TargetDocumentContext } from '../../theme/targetDocumentContext';
import { Button } from '../Form/FormComponents';

/**
 * Props for `<AIErrorBoundary>` — a React error boundary for overlay portals.
 *
 * @ai-hint This boundary is used internally by Modal and SlideOut to prevent
 *          errors in portal content from crashing the entire React tree.
 *          You can also wrap any AI-generated section with it for resilience.
 */
/** @barrelExport */
export interface AIErrorBoundaryProps {
  children: ReactNode;
  /** Unique name for error reporting (e.g. 'Modal', 'SlideOut'). */
  componentName?: string;
  /**
   * Custom fallback UI rendered when a child throws.
   * Receives the error and a reset callback.
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface AIErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary for overlay portal content.
 *
 * Catches render errors in children and displays a graceful fallback instead of
 * crashing the entire page. Emits `error:boundary` on the event bus for observability.
 *
 * Used internally by `<Modal>` and `<SlideOut>` to protect the host application from
 * errors in AI-generated portal content.
 *
 * @example
 * ```tsx
 * <AIErrorBoundary componentName="DashboardWidget">
 *   <SomeAIGeneratedContent />
 * </AIErrorBoundary>
 * ```
 */
export class AIErrorBoundary extends Component<AIErrorBoundaryProps, AIErrorBoundaryState> {
  static displayName = 'AIErrorBoundary';

  // Class component, no useContext — `static contextType` is the class
  // equivalent, giving `this.context` the nearest <ThemeProvider
  // targetDocument>'s value (undefined outside one), same as every other
  // component's own `useTargetDocument()` call reads.
  static contextType = TargetDocumentContext;
  declare context: Document | undefined;

  state: AIErrorBoundaryState = { hasError: false, error: null };

  // Tracks the targetDocument last passed to injectInteractionStyles, so
  // componentDidUpdate can tell a real context change apart from an
  // unrelated re-render. Functional siblings get this for free via
  // useEffect's dependency array; a class component with static
  // contextType has no equivalent built-in comparison.
  private lastInjectedDocument: Document | undefined = undefined;

  componentDidMount(): void {
    // Class component, no useEffect — this is its equivalent "on mount"
    // hook, needed independently of whatever parent mounts it (Modal/
    // SlideOut/AlertDialog already call this themselves, but this boundary
    // is documented as usable standalone too, wrapping any AI-generated
    // section directly).
    this.lastInjectedDocument = this.context;
    injectInteractionStyles(this.context);
  }

  componentDidUpdate(): void {
    // Covers the case where this boundary mounts before its <ThemeProvider
    // targetDocument> value is known (e.g. an iframe whose contentDocument
    // is only available after a later 'load' event) — componentDidMount's
    // this.context would be undefined at that point, and without this,
    // interaction styles would stay injected into the wrong document
    // forever once the real targetDocument arrives.
    if (this.context !== this.lastInjectedDocument) {
      this.lastInjectedDocument = this.context;
      injectInteractionStyles(this.context);
    }
  }

  static getDerivedStateFromError(error: Error): AIErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { componentName = 'Unknown' } = this.props;
    console.error(`[toolcrib] Error in <${componentName}>:`, error, errorInfo);

    aiBus.emit('error:boundary', {
      componentName,
      error: error.message,
      stack: error.stack,
    });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <div
          style={{
            padding: 'var(--ai-padding-xl, 1.5rem)',
            textAlign: 'center',
            color: 'var(--ai-subtheme-error, #ef4444)',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ fontWeight: 'var(--ai-font-weight-bold, 700)', marginBottom: '0.5rem' }}>
            ⚠️ Something went wrong
          </div>
          <div style={{ color: 'var(--ai-text-secondary, #6b7280)', marginBottom: '1rem' }}>
            {this.state.error.message}
          </div>
          <Button onClick={this.reset} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
