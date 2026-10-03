import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu } from '../components/ContextMenu/ContextMenu';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';
import { actAndSettle } from './testUtils/overlay';

// Base UI mounts the popup a frame after the contextmenu event.
const rightClick = (text: string) => actAndSettle(() => fireEvent.contextMenu(screen.getByText(text)));

describe('ContextMenu Component', () => {
  it('opens on right-click (not left-click) and renders items', async () => {
    render(
      <ContextMenu items={[{ value: 'copy', label: 'Copy' }]}>
        <div>Right-click target</div>
      </ContextMenu>
    );

    expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    // Closed-state scan: ContextMenu's items are Portal-rendered, real DOM
    // the closed state genuinely omits.
    expect(await axe(document.body)).toHaveNoViolations();

    await actAndSettle(() => fireEvent.click(screen.getByText('Right-click target')));
    expect(screen.queryByText('Copy')).not.toBeInTheDocument();

    await rightClick('Right-click target');
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toBeInTheDocument();
    // No aria-hidden-focus carve-out (#700): Base UI doesn't aria-hide the
    // page behind an open menu.
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('emits menu:opened and menu:item_selected, matching DropdownMenu\'s event shape', async () => {
    const openedFn = vi.fn();
    const selectedFn = vi.fn();
    const itemAction = vi.fn();
    const unsub1 = aiBus.on('menu:opened', openedFn);
    const unsub2 = aiBus.on('menu:item_selected', selectedFn);

    render(
      <ContextMenu id="test-context-menu" items={[{ value: 'delete', label: 'Delete', onClick: itemAction }]}>
        <div>Target</div>
      </ContextMenu>
    );

    await rightClick('Target');
    expect(openedFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-context-menu' }));

    await actAndSettle(() => fireEvent.click(screen.getByText('Delete')));
    expect(itemAction).toHaveBeenCalledTimes(1);
    expect(selectedFn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-context-menu', itemValue: 'delete' })
    );

    unsub1();
    unsub2();
  });

  it('renders a separator instead of a clickable item', async () => {
    render(
      <ContextMenu items={[{ value: 'a', label: 'A' }, { isSeparator: true, value: 'sep', label: '' }, { value: 'b', label: 'B' }]}>
        <div>Target</div>
      </ContextMenu>
    );

    await rightClick('Target');
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.queryAllByRole('separator').length).toBe(1);
  });
});
