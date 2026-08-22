import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TabStrip } from '../components/TabStrip/TabStrip';
import { aiBus } from '../eventBus/eventBus';

describe('TabStrip Component', () => {
  const items = [
    { id: 'tab1', label: 'Tab 1' },
    { id: 'tab2', label: 'Tab 2' },
    { id: 'tab3', label: 'Tab 3' },
  ];

  it('renders tab items and handles tab changes (controlled mode)', () => {
    const handleChange = vi.fn();

    render(<TabStrip id="demo" items={items} activeId="tab1" onChange={handleChange} />);

    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
    expect(screen.getByText('Tab 3')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Tab 2'));
    expect(handleChange).toHaveBeenCalledWith('tab2');
  });

  it('manages its own active tab when uncontrolled (no activeId/onChange given)', () => {
    render(<TabStrip id="uncontrolled-demo" items={items} defaultActiveId="tab2" />);

    // Radix marks the active trigger's tab state via data-state="active".
    expect(screen.getByText('Tab 2').closest('button')).toHaveAttribute('data-state', 'active');

    fireEvent.click(screen.getByText('Tab 3'));
    expect(screen.getByText('Tab 3').closest('button')).toHaveAttribute('data-state', 'active');
  });

  it('coordinates with a <TabStrip.Panel> rendered as a sibling, not a child — no shared DOM containment required', async () => {
    render(
      <div>
        <TabStrip id="decoupled-demo" items={items} defaultActiveId="tab1" />
        <div>
          <TabStrip.Panel groupId="decoupled-demo" value="tab1">Panel One Content</TabStrip.Panel>
          <TabStrip.Panel groupId="decoupled-demo" value="tab2">Panel Two Content</TabStrip.Panel>
        </div>
      </div>
    );

    await waitFor(() => expect(screen.getByText('Panel One Content')).toBeInTheDocument());
    expect(screen.queryByText('Panel Two Content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Tab 2'));

    await waitFor(() => expect(screen.getByText('Panel Two Content')).toBeInTheDocument());
    expect(screen.queryByText('Panel One Content')).not.toBeInTheDocument();
  });

  it('a panel for a groupId with no matching TabStrip mounted anywhere just stays hidden', () => {
    render(<TabStrip.Panel groupId="nobody-is-broadcasting-this-id" value="tab1">Orphan Panel</TabStrip.Panel>);
    expect(screen.queryByText('Orphan Panel')).not.toBeInTheDocument();
  });

  it('regression coverage: shows scroll buttons once the tab list overflows, and clicking them scrolls the list', () => {
    render(<TabStrip id="overflow-demo" items={items} activeId="tab1" onChange={vi.fn()} />);

    const tablist = screen.getByRole('tablist');
    // jsdom never reports real layout, so scrollWidth/clientWidth default to
    // 0/0 (no overflow) — this simulates a tab list wider than its visible
    // box, matching useScrollOverflow's own real-browser detection.
    Object.defineProperty(tablist, 'scrollWidth', { value: 400, configurable: true });
    Object.defineProperty(tablist, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(tablist, 'scrollLeft', { value: 50, configurable: true });
    tablist.scrollBy = vi.fn();

    fireEvent.scroll(tablist);

    const leftButton = screen.getByLabelText('Scroll tabs left');
    const rightButton = screen.getByLabelText('Scroll tabs right');
    expect(leftButton).toBeInTheDocument();
    expect(rightButton).toBeInTheDocument();

    fireEvent.click(leftButton);
    expect(tablist.scrollBy).toHaveBeenCalledWith({ left: -180, behavior: 'smooth' });

    fireEvent.click(rightButton);
    expect(tablist.scrollBy).toHaveBeenCalledWith({ left: 180, behavior: 'smooth' });
  });

  it('activates the matching panel when a controlled activeId changes externally, not just from a click (regression: CommandPalette "go to tab" only highlighted the tab, never switched the panel)', async () => {
    const { rerender } = render(
      <div>
        <TabStrip id="external-change-demo" items={items} activeId="tab1" onChange={vi.fn()} />
        <div>
          <TabStrip.Panel groupId="external-change-demo" value="tab1">Panel One Content</TabStrip.Panel>
          <TabStrip.Panel groupId="external-change-demo" value="tab2">Panel Two Content</TabStrip.Panel>
        </div>
      </div>
    );

    await waitFor(() => expect(screen.getByText('Panel One Content')).toBeInTheDocument());

    // Simulates a parent changing its own state from somewhere other than
    // this TabStrip's own onChange -- e.g. a CommandPalette command -- by
    // re-rendering with a new activeId directly, with no click involved.
    rerender(
      <div>
        <TabStrip id="external-change-demo" items={items} activeId="tab2" onChange={vi.fn()} />
        <div>
          <TabStrip.Panel groupId="external-change-demo" value="tab1">Panel One Content</TabStrip.Panel>
          <TabStrip.Panel groupId="external-change-demo" value="tab2">Panel Two Content</TabStrip.Panel>
        </div>
      </div>
    );

    await waitFor(() => expect(screen.getByText('Panel Two Content')).toBeInTheDocument());
    expect(screen.queryByText('Panel One Content')).not.toBeInTheDocument();
  });

  it('clears its sticky tab:changed entry on unmount (regression: unbounded sticky map for dynamically-created groups)', () => {
    const { unmount } = render(<TabStrip id="ephemeral-group" items={items} defaultActiveId="tab1" />);
    unmount();

    // A late subscriber after unmount should get nothing replayed for this
    // id — before the fix, the sticky entry outlived the component that
    // created it, forever, regardless of how many such groups came and went.
    const callback = vi.fn();
    aiBus.on('tab:changed', callback);
    expect(callback).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'ephemeral-group' }));
  });
});
