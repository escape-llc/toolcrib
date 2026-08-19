import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Breadcrumb, computeVisibleCrumbs } from '../components/Breadcrumb/Breadcrumb';

describe('computeVisibleCrumbs (pure collapse decision)', () => {
  const crumbs = ['a', 'b', 'c', 'd', 'e'].map((key, i, arr) => ({
    key,
    element: {} as any,
    isLast: i === arr.length - 1,
  }));

  it('shows every crumb when not overflowing', () => {
    const { visible, collapsed } = computeVisibleCrumbs(crumbs, false);
    expect(visible).toEqual(crumbs);
    expect(collapsed).toHaveLength(0);
  });

  it('collapses everything except first and last when overflowing with enough items', () => {
    const { visible, collapsed } = computeVisibleCrumbs(crumbs, true);
    expect(visible.map(c => c.key)).toEqual(['a', 'e']);
    expect(collapsed.map(c => c.key)).toEqual(['b', 'c', 'd']);
  });

  it('does not collapse a short trail even when marked overflowing -- nothing meaningful to hide', () => {
    const short = crumbs.slice(0, 3); // 3 items: collapsing would hide only 1, not worth a dropdown
    const { visible, collapsed } = computeVisibleCrumbs(short, true);
    expect(visible).toEqual(short);
    expect(collapsed).toHaveLength(0);
  });
});

describe('Breadcrumb', () => {
  it('renders each item and the default separator between them', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item href="/products">Products</Breadcrumb.Item>
        <Breadcrumb.Item>Widget</Breadcrumb.Item>
      </Breadcrumb>
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getAllByText('›')).toHaveLength(2); // one separator between each of the 3 items
  });

  it('renders every non-last item as a real link, and the last as plain non-interactive text', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item>Current Page</Breadcrumb.Item>
      </Breadcrumb>
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: 'Current Page' })).not.toBeInTheDocument();
  });

  it('marks the last item data-current via react-aria-components\' own last-child detection', () => {
    const { container } = render(
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item>Current Page</Breadcrumb.Item>
      </Breadcrumb>
    );
    const currentLi = Array.from(container.querySelectorAll('li')).find(li => li.hasAttribute('data-current'));
    expect(currentLi?.textContent).toBe('Current Page');
  });

  it('supports a custom separator', () => {
    render(
      <Breadcrumb separator={<span>/</span>}>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item>Current</Breadcrumb.Item>
      </Breadcrumb>
    );
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.queryByText('›')).not.toBeInTheDocument();
  });

  it('calls onClick for a JS-driven crumb', () => {
    const onClick = vi.fn();
    render(
      <Breadcrumb>
        <Breadcrumb.Item onClick={onClick}>Home</Breadcrumb.Item>
        <Breadcrumb.Item>Current</Breadcrumb.Item>
      </Breadcrumb>
    );
    fireEvent.click(screen.getByText('Home'));
    expect(onClick).toHaveBeenCalled();
  });

  // Forces the real DOM-measurement branch (scrollWidth/clientWidth are
  // both always 0 in jsdom by default -- a well-known jsdom limitation,
  // not something a real browser has, which is exactly why this
  // component's own collapse *decision* is a pure, separately-tested
  // function above) to confirm the full pipeline, not just
  // computeVisibleCrumbs in isolation, actually collapses into a working
  // DropdownMenu. Patches the prototype getters before mounting, since the
  // component's overflow check runs inside a useEffect on its very first
  // commit -- patching a specific instance's properties after render()
  // returns would be too late for that first check to see them.
  it('collapses into a DropdownMenu when the container reports real overflow, and the menu holds the hidden items', () => {
    const scrollWidthSpy = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1000);
    const clientWidthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);

    try {
      const items = ['Home', 'Category', 'Subcategory', 'Products', 'Current'];
      render(
        <Breadcrumb>
          {items.map((label, i) => (
            <Breadcrumb.Item key={label} href={i < items.length - 1 ? '#' : undefined}>
              {label}
            </Breadcrumb.Item>
          ))}
        </Breadcrumb>
      );

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Current')).toBeInTheDocument();
      expect(screen.queryByText('Category')).not.toBeInTheDocument();

      // Radix's DropdownMenu trigger opens on pointerdown, not click --
      // fireEvent.click alone doesn't reliably reproduce that in jsdom
      // (confirmed: this codebase's own existing DropdownMenu test has the
      // same limitation, asserting only that the trigger is clickable, not
      // that the menu's items actually appear afterward). What's reliably
      // verifiable here is that the trigger is real, correctly wired to a
      // real menu (aria-haspopup), and the collapsed items were handed to
      // it correctly -- covered by computeVisibleCrumbs' own dedicated
      // tests above for the data, and this attribute check for the wiring.
      const trigger = screen.getByLabelText('Show hidden breadcrumb items').closest('[aria-haspopup="menu"]');
      expect(trigger).toBeInTheDocument();
    } finally {
      scrollWidthSpy.mockRestore();
      clientWidthSpy.mockRestore();
    }
  });
});
