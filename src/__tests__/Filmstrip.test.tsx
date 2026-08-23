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

  it('gives only the active item tabIndex 0 (roving tabindex, per the WAI-ARIA APG Listbox pattern) — the rest are -1, not individually Tab-stoppable', () => {
    render(<Filmstrip id="roving-demo" items={items} activeId="p2" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Photo 1')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByLabelText('Photo 2')).toHaveAttribute('tabindex', '0');
    expect(screen.getByLabelText('Photo 3')).toHaveAttribute('tabindex', '-1');
  });

  it('falls back to the first enabled item for tabIndex 0 when activeId doesn\'t match any current item, so the strip is never entirely untabbable', () => {
    render(<Filmstrip id="fallback-demo" items={items} activeId="does-not-exist" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Photo 1')).toHaveAttribute('tabindex', '0');
  });

  it('ArrowRight/ArrowLeft move both the selection and real DOM focus to the adjacent item, skipping disabled ones', () => {
    const disabledItems = [
      { id: 'p1', content: <span>Photo 1</span>, label: 'Photo 1' },
      { id: 'p2', content: <span>Photo 2</span>, label: 'Photo 2', disabled: true },
      { id: 'p3', content: <span>Photo 3</span>, label: 'Photo 3' },
    ];
    const handleChange = vi.fn();
    render(<Filmstrip id="arrow-demo" items={disabledItems} activeId="p1" onChange={handleChange} />);

    fireEvent.keyDown(screen.getByLabelText('Photo 1'), { key: 'ArrowRight' });
    // Skips the disabled p2, lands on p3.
    expect(handleChange).toHaveBeenCalledWith('p3');
    expect(screen.getByLabelText('Photo 3')).toHaveFocus();

    fireEvent.keyDown(screen.getByLabelText('Photo 3'), { key: 'ArrowLeft' });
    expect(handleChange).toHaveBeenCalledWith('p1');
    expect(screen.getByLabelText('Photo 1')).toHaveFocus();
  });

  it('Home/End jump to the first/last enabled item', () => {
    const handleChange = vi.fn();
    render(<Filmstrip id="homeend-demo" items={items} activeId="p2" onChange={handleChange} />);

    fireEvent.keyDown(screen.getByLabelText('Photo 2'), { key: 'End' });
    expect(handleChange).toHaveBeenCalledWith('p3');

    fireEvent.keyDown(screen.getByLabelText('Photo 3'), { key: 'Home' });
    expect(handleChange).toHaveBeenCalledWith('p1');
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
