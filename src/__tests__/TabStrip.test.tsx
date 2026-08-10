import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TabStrip } from '../components/TabStrip/TabStrip';

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
});
