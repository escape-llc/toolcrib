import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Filmstrip } from '../components/Filmstrip/Filmstrip';
import { aiBus } from '../eventBus/eventBus';

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

describe('Filmstrip', () => {
  const items = [
    { id: 'p1', content: <span>Photo 1</span>, label: 'Photo 1' },
    { id: 'p2', content: <span>Photo 2</span>, label: 'Photo 2' },
    { id: 'p3', content: <span>Photo 3</span>, label: 'Photo 3' },
  ];

  it('renders every item and marks the active one via aria-selected (controlled mode)', () => {
    const handleChange = vi.fn();
    render(<Filmstrip id="demo" items={items} activeId="p1" onChange={handleChange} />);

    expect(screen.getByText('Photo 1')).toBeInTheDocument();
    expect(screen.getByText('Photo 2')).toBeInTheDocument();
    expect(screen.getByText('Photo 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Photo 1')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Photo 2')).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(screen.getByLabelText('Photo 2'));
    expect(handleChange).toHaveBeenCalledWith('p2');
  });

  it('manages its own active item when uncontrolled', () => {
    render(<Filmstrip id="uncontrolled-demo" items={items} defaultActiveId="p1" />);

    expect(screen.getByLabelText('Photo 1')).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByLabelText('Photo 3'));
    expect(screen.getByLabelText('Photo 3')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Photo 1')).toHaveAttribute('aria-selected', 'false');
  });

  it('does not select a disabled item', () => {
    const disabledItems = [
      { id: 'p1', content: <span>Photo 1</span>, label: 'Photo 1' },
      { id: 'p2', content: <span>Photo 2</span>, label: 'Photo 2', disabled: true },
    ];
    render(<Filmstrip id="disabled-demo" items={disabledItems} defaultActiveId="p1" />);

    fireEvent.click(screen.getByLabelText('Photo 2'));
    expect(screen.getByLabelText('Photo 1')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Photo 2')).toHaveAttribute('aria-selected', 'false');
  });

  it('emits filmstrip:changed on mount and on every change, mirroring tab:changed\'s shape', () => {
    const changedFn = vi.fn();
    const unsub = aiBus.on('filmstrip:changed', changedFn);

    render(<Filmstrip id="events-demo" items={items} defaultActiveId="p1" />);
    expect(changedFn).toHaveBeenCalledWith({ id: 'events-demo', activeId: 'p1', previousId: undefined });

    fireEvent.click(screen.getByLabelText('Photo 2'));
    expect(changedFn).toHaveBeenCalledWith({ id: 'events-demo', activeId: 'p2', previousId: 'p1' });

    unsub();
  });
});
