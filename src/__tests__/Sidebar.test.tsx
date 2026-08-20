import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar, type SidebarItemData } from '../components/Sidebar/Sidebar';

const items: SidebarItemData[] = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'locked', label: 'Locked', disabled: true },
];

describe('Sidebar', () => {
  it('renders every item label and icon', () => {
    render(<Sidebar items={items} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('🏠')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('marks the active item with aria-current="page"', () => {
    render(<Sidebar items={items} activeId="settings" />);
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Home').closest('a')).not.toHaveAttribute('aria-current');
  });

  it('calls onItemClick with the clicked item id, and not for a disabled item', () => {
    const onItemClick = vi.fn();
    render(<Sidebar items={items} onItemClick={onItemClick} />);

    fireEvent.click(screen.getByText('Home'));
    expect(onItemClick).toHaveBeenCalledWith('home');

    fireEvent.click(screen.getByText('Locked'));
    expect(onItemClick).not.toHaveBeenCalledWith('locked');
  });

  it('manages its own collapsed state internally by default, toggled via its own button', () => {
    render(<Sidebar items={items} />);
    expect(screen.getByText('Home')).toBeInTheDocument(); // label visible, not collapsed

    fireEvent.click(screen.getByLabelText('Collapse sidebar'));
    expect(screen.queryByText('Home')).not.toBeInTheDocument(); // label hidden once collapsed
    expect(screen.getByText('🏠')).toBeInTheDocument(); // icon still shown

    fireEvent.click(screen.getByLabelText('Expand sidebar'));
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('supports a controlled collapsed state, calling onCollapsedChange instead of managing its own', () => {
    const onCollapsedChange = vi.fn();
    const { rerender } = render(<Sidebar items={items} collapsed={false} onCollapsedChange={onCollapsedChange} />);

    fireEvent.click(screen.getByLabelText('Collapse sidebar'));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    // Still expanded -- the parent hasn't re-rendered with the new value yet.
    expect(screen.getByText('Home')).toBeInTheDocument();

    rerender(<Sidebar items={items} collapsed={true} onCollapsedChange={onCollapsedChange} />);
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
  });
});
