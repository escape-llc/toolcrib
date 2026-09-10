import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu } from '../components/ContextMenu/ContextMenu';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

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

    fireEvent.click(screen.getByText('Right-click target'));
    expect(screen.queryByText('Copy')).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByText('Right-click target'));
    expect(screen.getByText('Copy')).toBeInTheDocument();
    // Radix Menu-family hideOthers() reads as an aria-hidden ancestor with
    // a focusable descendant to any static analysis -- the same confirmed
    // false positive e2e/accessibility.spec.ts's own ARIA_HIDDEN_FOCUS_DISABLED
    // carve-out exists for, real in jsdom for the identical structural
    // reason (neither axe variant can observe Radix's runtime focus-trap).
    expect(await axe(document.body, { rules: { 'aria-hidden-focus': { enabled: false } } })).toHaveNoViolations();
  });

  it('emits menu:opened and menu:item_selected, matching DropdownMenu\'s event shape', () => {
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

    fireEvent.contextMenu(screen.getByText('Target'));
    expect(openedFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-context-menu' }));

    fireEvent.click(screen.getByText('Delete'));
    expect(itemAction).toHaveBeenCalledTimes(1);
    expect(selectedFn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-context-menu', itemValue: 'delete' })
    );

    unsub1();
    unsub2();
  });

  it('renders a separator instead of a clickable item', () => {
    render(
      <ContextMenu items={[{ value: 'a', label: 'A' }, { isSeparator: true, value: 'sep', label: '' }, { value: 'b', label: 'B' }]}>
        <div>Target</div>
      </ContextMenu>
    );

    fireEvent.contextMenu(screen.getByText('Target'));
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.queryAllByRole('separator').length).toBe(1);
  });
});
