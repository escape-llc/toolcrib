import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIErrorBoundary } from '../components/ErrorBoundary/AIErrorBoundary';
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
});
