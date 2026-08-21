import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DropdownMenu } from '../components/DropdownMenu/DropdownMenu';
import { aiBus } from '../eventBus/eventBus';

// Radix DropdownMenu's positioning internals use ResizeObserver — not
// implemented in jsdom. Same polyfill pattern already used in
// RadixPrimitives.test.tsx and eventBusTraffic.test.tsx for the same reason.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

describe('DropdownMenu Component', () => {
  it('opens on trigger click, emits menu:opened, and renders every item', () => {
    const openedFn = vi.fn();
    const unsub = aiBus.on('menu:opened', openedFn);

    render(
      <DropdownMenu
        id="actions-menu"
        trigger={<button>Options</button>}
        items={[
          { value: 'edit', label: 'Edit' },
          { value: 'delete', label: 'Delete' },
        ]}
      />
    );

    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText('Options'), { button: 0 });

    expect(openedFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'actions-menu' }));
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();

    unsub();
  });

  it('selecting an item calls its onClick, emits menu:item_selected, and closes the menu (emitting menu:closed)', () => {
    const selectedFn = vi.fn();
    const closedFn = vi.fn();
    const itemAction = vi.fn();
    const unsub1 = aiBus.on('menu:item_selected', selectedFn);
    const unsub2 = aiBus.on('menu:closed', closedFn);

    render(
      <DropdownMenu
        id="actions-menu"
        trigger={<button>Options</button>}
        items={[{ value: 'edit', label: 'Edit', onClick: itemAction }]}
      />
    );

    fireEvent.pointerDown(screen.getByText('Options'), { button: 0 });
    fireEvent.click(screen.getByText('Edit'));

    expect(itemAction).toHaveBeenCalledTimes(1);
    expect(selectedFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'actions-menu', itemValue: 'edit' }));
    expect(closedFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'actions-menu' }));

    unsub1();
    unsub2();
  });

  it('renders an icon before the label when given', () => {
    render(
      <DropdownMenu
        trigger={<button>Options</button>}
        items={[{ value: 'edit', label: 'Edit', icon: <span data-testid="edit-icon">✏️</span> }]}
      />
    );

    fireEvent.pointerDown(screen.getByText('Options'), { button: 0 });
    expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
  });

  it('renders a separator instead of a clickable item, and skips onSelect for a disabled item', () => {
    const itemAction = vi.fn();

    render(
      <DropdownMenu
        trigger={<button>Options</button>}
        items={[
          { value: 'a', label: 'A' },
          { value: 'sep', label: '', isSeparator: true },
          { value: 'b', label: 'B', disabled: true, onClick: itemAction },
        ]}
      />
    );

    fireEvent.pointerDown(screen.getByText('Options'), { button: 0 });
    expect(screen.queryAllByRole('separator').length).toBe(1);

    fireEvent.click(screen.getByText('B'));
    expect(itemAction).not.toHaveBeenCalled();
  });

  it('positions the menu content per the side/align props without throwing', () => {
    expect(() =>
      render(
        <DropdownMenu
          trigger={<button>Options</button>}
          side="right"
          align="end"
          items={[{ value: 'a', label: 'A' }]}
        />
      )
    ).not.toThrow();
  });
});
