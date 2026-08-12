import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Collapsible } from '../components/Collapsible/Collapsible';
import { aiBus } from '../eventBus/eventBus';

describe('Collapsible Component', () => {
  it('starts closed by default and toggles open/closed on trigger click', () => {
    render(
      <Collapsible trigger="Show more options">
        <div>Extra content</div>
      </Collapsible>
    );

    expect(screen.queryByText('Extra content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show more options'));
    expect(screen.getByText('Extra content')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Show more options'));
    expect(screen.queryByText('Extra content')).not.toBeInTheDocument();
  });

  it('respects defaultOpen', () => {
    render(
      <Collapsible trigger="Header" defaultOpen>
        <div>Body</div>
      </Collapsible>
    );
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('emits collapsible:opened/closed and responds to aiBus dispatches', () => {
    const openedFn = vi.fn();
    const closedFn = vi.fn();
    const unsub1 = aiBus.on('collapsible:opened', openedFn);
    const unsub2 = aiBus.on('collapsible:closed', closedFn);

    render(
      <Collapsible id="advanced-options" trigger="Advanced">
        <div>Advanced content</div>
      </Collapsible>
    );

    fireEvent.click(screen.getByText('Advanced'));
    expect(openedFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'advanced-options' }));

    act(() => {
      aiBus.emit('collapsible:closed', { id: 'advanced-options' });
    });
    expect(closedFn).toHaveBeenCalledWith({ id: 'advanced-options' });
    expect(screen.queryByText('Advanced content')).not.toBeInTheDocument();

    unsub1();
    unsub2();
  });
});
