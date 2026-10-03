import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DropdownMenu } from '../components/DropdownMenu/DropdownMenu';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';
import { actAndSettle } from './testUtils/overlay';

// Base UI's Menu opens on mousedown (a plain click on the trigger is a no-op)
// and mounts the popup a frame later.
const openMenu = (name: string) => actAndSettle(() => fireEvent.mouseDown(screen.getByText(name)));

describe('DropdownMenu Component', () => {
  it('opens on trigger mousedown, emits menu:opened, and renders every item', async () => {
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
    // Closed-state scan: DropdownMenu's items are Portal-rendered.
    expect(await axe(document.body)).toHaveNoViolations();

    await openMenu('Options');

    expect(openedFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'actions-menu' }));
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    // No aria-hidden-focus carve-out (#700): Base UI doesn't aria-hide the
    // page behind an open menu.
    expect(await axe(document.body)).toHaveNoViolations();

    unsub();
  });

  it('puts the trigger semantics on the consumer\'s own element, with no wrapper', () => {
    render(<DropdownMenu trigger={<button>Options</button>} items={[{ value: 'a', label: 'A' }]} />);
    const trigger = screen.getByRole('button', { name: 'Options' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('selecting an item calls its onClick, emits menu:item_selected, and closes the menu (emitting menu:closed)', async () => {
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

    await openMenu('Options');
    await actAndSettle(() => fireEvent.click(screen.getByText('Edit')));

    expect(itemAction).toHaveBeenCalledTimes(1);
    expect(selectedFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'actions-menu', itemValue: 'edit' }));
    expect(closedFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'actions-menu' }));

    unsub1();
    unsub2();
  });

  it('renders an icon before the label when given', async () => {
    render(
      <DropdownMenu
        trigger={<button>Options</button>}
        items={[{ value: 'edit', label: 'Edit', icon: <span data-testid="edit-icon">✏️</span> }]}
      />
    );

    await openMenu('Options');
    expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
  });

  it('renders a separator instead of a clickable item, and skips onClick for a disabled item', async () => {
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

    await openMenu('Options');
    expect(screen.queryAllByRole('separator').length).toBe(1);

    await actAndSettle(() => fireEvent.click(screen.getByText('B')));
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
