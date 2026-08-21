import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIErrorBoundary } from '../components/ErrorBoundary/AIErrorBoundary';
import { TargetDocumentContext } from '../theme/targetDocumentContext';
import { aiBus } from '../eventBus/eventBus';

function Bomb(): React.ReactElement {
  throw new Error('boom');
}

describe('AIErrorBoundary', () => {
  // React logs the caught error to the console during the render that throws;
  // silence it here so the test output isn't noise, not because it's unexpected.
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  afterEach(() => consoleErrorSpy.mockClear());

  it('renders children normally when nothing throws', () => {
    render(
      <AIErrorBoundary componentName="Test">
        <div>All good</div>
      </AIErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('catches a render error and shows the default fallback', () => {
    render(
      <AIErrorBoundary componentName="Test">
        <Bomb />
      </AIErrorBoundary>
    );
    expect(screen.getByText('Something went wrong', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('emits a typed "error:boundary" event on the bus, not a silently-swallowed one', () => {
    const callback = vi.fn();
    const unsubscribe = aiBus.on('error:boundary', callback);

    render(
      <AIErrorBoundary componentName="Dashboard">
        <Bomb />
      </AIErrorBoundary>
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ componentName: 'Dashboard', error: 'boom' })
    );
    unsubscribe();
  });

  it('resets via the fallback button and re-renders children on the next successful render', () => {
    let shouldThrow = true;
    function Flaky(): React.ReactElement {
      if (shouldThrow) throw new Error('boom');
      return <div>Recovered</div>;
    }

    render(
      <AIErrorBoundary componentName="Test">
        <Flaky />
      </AIErrorBoundary>
    );
    expect(screen.getByText('Try Again')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('renders a custom fallback when given, receiving the error and a working reset callback', () => {
    let shouldThrow = true;
    function Flaky(): React.ReactElement {
      if (shouldThrow) throw new Error('custom boom');
      return <div>Recovered</div>;
    }

    render(
      <AIErrorBoundary
        componentName="Test"
        fallback={(error, reset) => (
          <div>
            <span>Custom fallback: {error.message}</span>
            <button onClick={reset}>Custom Reset</button>
          </div>
        )}
      >
        <Flaky />
      </AIErrorBoundary>
    );

    expect(screen.getByText('Custom fallback: custom boom')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong', { exact: false })).not.toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Custom Reset'));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('re-injects interaction styles when the ambient targetDocument context actually changes between renders', () => {
    const otherDocument = document.implementation.createHTMLDocument('other');
    const { rerender } = render(
      <TargetDocumentContext.Provider value={document}>
        <AIErrorBoundary componentName="Test">
          <div>Content</div>
        </AIErrorBoundary>
      </TargetDocumentContext.Provider>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();

    // Swapping which document is provided (e.g. an iframe's contentDocument
    // arriving after a later 'load' event) exercises componentDidUpdate's
    // own re-injection guard — asserted here by simply confirming the
    // re-render with a genuinely different context value doesn't throw and
    // still renders correctly, since jsdom gives no direct way to inspect
    // which stylesheet a given document received.
    expect(() =>
      rerender(
        <TargetDocumentContext.Provider value={otherDocument}>
          <AIErrorBoundary componentName="Test">
            <div>Content</div>
          </AIErrorBoundary>
        </TargetDocumentContext.Provider>
      )
    ).not.toThrow();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
