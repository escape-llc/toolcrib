import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tree, TreeItemData } from '../components/Tree/Tree';
import { aiBus } from '../eventBus/eventBus';

const items: TreeItemData[] = [
  {
    id: 'fruits',
    label: 'Fruits',
    children: [
      { id: 'apple', label: 'Apple' },
      { id: 'banana', label: 'Banana' },
    ],
  },
  { id: 'vegetables', label: 'Vegetables', children: [{ id: 'carrot', label: 'Carrot' }] },
];

describe('Tree', () => {
  it('renders root-level items and keeps children collapsed by default', () => {
    render(<Tree items={items} />);
    expect(screen.getByText('Fruits')).toBeInTheDocument();
    expect(screen.getByText('Vegetables')).toBeInTheDocument();
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  });

  it('expands on click of the disclosure triangle, revealing children', () => {
    render(<Tree items={items} />);
    const fruitsRow = screen.getByText('Fruits').closest('[role="treeitem"]') as HTMLElement;
    expect(fruitsRow).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(fruitsRow.querySelector('span')!); // the disclosure triangle
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(fruitsRow).toHaveAttribute('aria-expanded', 'true');
  });

  it('sets aria-level/aria-setsize/aria-posinset correctly, including on nested items', () => {
    render(<Tree items={items} defaultExpandedIds={['fruits']} />);
    const fruits = screen.getByText('Fruits').closest('[role="treeitem"]') as HTMLElement;
    const apple = screen.getByText('Apple').closest('[role="treeitem"]') as HTMLElement;

    expect(fruits).toHaveAttribute('aria-level', '1');
    expect(fruits).toHaveAttribute('aria-setsize', '2'); // 2 root items
    expect(fruits).toHaveAttribute('aria-posinset', '1');

    expect(apple).toHaveAttribute('aria-level', '2');
    expect(apple).toHaveAttribute('aria-setsize', '2'); // 2 children of Fruits
    expect(apple).toHaveAttribute('aria-posinset', '1');
  });

  it('ArrowRight expands a collapsed node with children; ArrowRight again moves focus into the first child', () => {
    render(<Tree items={items} />);
    const fruits = screen.getByText('Fruits').closest('[role="treeitem"]') as HTMLElement;
    fruits.focus();

    fireEvent.keyDown(fruits, { key: 'ArrowRight' });
    expect(fruits).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Apple')).toBeInTheDocument();

    fireEvent.keyDown(fruits, { key: 'ArrowRight' });
    const apple = screen.getByText('Apple').closest('[role="treeitem"]') as HTMLElement;
    expect(apple).toHaveAttribute('tabIndex', '0');
    expect(fruits).toHaveAttribute('tabIndex', '-1');
  });

  it('ArrowLeft collapses an expanded node; ArrowLeft again on a child moves focus to its parent', () => {
    render(<Tree items={items} defaultExpandedIds={['fruits']} />);
    const apple = screen.getByText('Apple').closest('[role="treeitem"]') as HTMLElement;
    apple.focus();

    fireEvent.keyDown(apple, { key: 'ArrowLeft' });
    const fruits = screen.getByText('Fruits').closest('[role="treeitem"]') as HTMLElement;
    expect(fruits).toHaveAttribute('tabIndex', '0');

    fireEvent.keyDown(fruits, { key: 'ArrowLeft' });
    expect(fruits).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  });

  it('ArrowDown/ArrowUp move roving focus between visible items', () => {
    render(<Tree items={items} />);
    const fruits = screen.getByText('Fruits').closest('[role="treeitem"]') as HTMLElement;
    const vegetables = screen.getByText('Vegetables').closest('[role="treeitem"]') as HTMLElement;
    fruits.focus();

    fireEvent.keyDown(fruits, { key: 'ArrowDown' });
    expect(vegetables).toHaveAttribute('tabIndex', '0');
    expect(fruits).toHaveAttribute('tabIndex', '-1');

    fireEvent.keyDown(vegetables, { key: 'ArrowUp' });
    expect(fruits).toHaveAttribute('tabIndex', '0');
  });

  it('Home/End jump to the first/last visible item', () => {
    render(<Tree items={items} defaultExpandedIds={['fruits', 'vegetables']} />);
    const fruits = screen.getByText('Fruits').closest('[role="treeitem"]') as HTMLElement;
    const carrot = screen.getByText('Carrot').closest('[role="treeitem"]') as HTMLElement;
    fruits.focus();

    fireEvent.keyDown(fruits, { key: 'End' });
    expect(carrot).toHaveAttribute('tabIndex', '0');

    fireEvent.keyDown(carrot, { key: 'Home' });
    expect(fruits).toHaveAttribute('tabIndex', '0');
  });

  it('type-ahead jumps focus to the next item whose label starts with the typed character', () => {
    render(<Tree items={items} defaultExpandedIds={['fruits', 'vegetables']} />);
    const fruits = screen.getByText('Fruits').closest('[role="treeitem"]') as HTMLElement;
    fruits.focus();

    fireEvent.keyDown(fruits, { key: 'c' }); // Carrot is the only visible item starting with "c"
    const carrot = screen.getByText('Carrot').closest('[role="treeitem"]') as HTMLElement;
    expect(carrot).toHaveAttribute('tabIndex', '0');
  });

  it('Enter/Space selects a leaf item and sets aria-selected', () => {
    const onSelectChange = vi.fn();
    render(<Tree items={items} defaultExpandedIds={['fruits']} onSelectChange={onSelectChange} />);
    const apple = screen.getByText('Apple').closest('[role="treeitem"]') as HTMLElement;
    apple.focus();

    fireEvent.keyDown(apple, { key: 'Enter' });
    expect(apple).toHaveAttribute('aria-selected', 'true');
    expect(onSelectChange).toHaveBeenCalledWith('apple');
  });

  it('supports a controlled selectedId, calling onSelectChange instead of managing its own state', () => {
    const onSelectChange = vi.fn();
    const { rerender } = render(
      <Tree items={items} defaultExpandedIds={['fruits']} selectedId="apple" onSelectChange={onSelectChange} />
    );
    const banana = screen.getByText('Banana').closest('[role="treeitem"]') as HTMLElement;
    fireEvent.click(banana);

    expect(onSelectChange).toHaveBeenCalledWith('banana');
    // Still showing apple as selected -- the parent hasn't re-rendered with the new selection yet.
    expect(screen.getByText('Apple').closest('[role="treeitem"]')).toHaveAttribute('aria-selected', 'true');

    rerender(<Tree items={items} defaultExpandedIds={['fruits']} selectedId="banana" onSelectChange={onSelectChange} />);
    expect(banana).toHaveAttribute('aria-selected', 'true');
  });

  it('emits tree:expanded and tree:collapsed', () => {
    const expandedFn = vi.fn();
    const collapsedFn = vi.fn();
    const unsubExpanded = aiBus.on('tree:expanded', expandedFn);
    const unsubCollapsed = aiBus.on('tree:collapsed', collapsedFn);

    render(<Tree id="my-tree" items={items} />);
    const fruits = screen.getByText('Fruits').closest('[role="treeitem"]') as HTMLElement;
    fireEvent.click(fruits.querySelector('span')!);
    expect(expandedFn).toHaveBeenLastCalledWith({ id: 'my-tree', itemId: 'fruits' });

    fireEvent.click(fruits.querySelector('span')!);
    expect(collapsedFn).toHaveBeenLastCalledWith({ id: 'my-tree', itemId: 'fruits' });

    unsubExpanded();
    unsubCollapsed();
  });

  it('does not expand/select a disabled node', () => {
    const onSelectChange = vi.fn();
    const disabledItems: TreeItemData[] = [{ id: 'locked', label: 'Locked', disabled: true }];
    render(<Tree items={disabledItems} onSelectChange={onSelectChange} />);
    const locked = screen.getByText('Locked').closest('[role="treeitem"]') as HTMLElement;

    fireEvent.click(locked);
    expect(onSelectChange).not.toHaveBeenCalled();
    expect(locked).toHaveAttribute('aria-disabled', 'true');
  });
});
