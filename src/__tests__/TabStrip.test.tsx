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
