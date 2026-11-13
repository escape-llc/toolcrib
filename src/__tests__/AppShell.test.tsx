import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../components/AppShell/AppShell';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { axe } from './testUtils/axe';

describe('AppShell Component', () => {
  it('renders AppShell with Header and Main slots', async () => {
    render(
      <AppShell>
        <AppShell.Header>
          <span>App Title</span>
        </AppShell.Header>
        <AppShell.Main>
          <span>Page Content</span>
        </AppShell.Main>
      </AppShell>
    );

    expect(screen.getByText('App Title')).toBeInTheDocument();
    expect(screen.getByText('Page Content')).toBeInTheDocument();
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('fills the full viewport as a flex column, so consumers never hand-roll this frame themselves', () => {
    const { container } = render(
      <AppShell>
        <AppShell.Header>Header</AppShell.Header>
        <AppShell.Main>Main</AppShell.Main>
      </AppShell>
    );

    const root = container.firstChild as HTMLElement;
    expect(root.style.height).toBe('100vh');
    expect(root.style.width).toBe('100vw');
    expect(root.style.display).toBe('flex');
    expect(root.style.flexDirection).toBe('column');
  });

  it('renders Header as a <header> and Main as a <main>, for correct landmark semantics', () => {
    render(
      <AppShell>
        <AppShell.Header>Header</AppShell.Header>
        <AppShell.Main>Main</AppShell.Main>
      </AppShell>
    );

    expect(screen.getByText('Header').closest('header')).toBeInTheDocument();
    expect(screen.getByText('Main').closest('main')).toBeInTheDocument();
  });

  it('Main is border-box, so width: 100% plus its padding does not overflow the parent', () => {
    render(
      <AppShell>
        <AppShell.Main>Main</AppShell.Main>
      </AppShell>
    );
    const main = screen.getByText('Main').closest('main')!;
    expect(main.style.width).toBe('100%');
    expect(window.getComputedStyle(main).boxSizing).toBe('border-box');
  });

  it('renders Sidebar as an <aside>, and keeps Header full-width above the Sidebar/Main row in sidebar-left layout', () => {
    render(
      <AppShell layout="sidebar-left">
        <AppShell.Header>Header</AppShell.Header>
        <AppShell.Sidebar>Nav</AppShell.Sidebar>
        <AppShell.Main>Main</AppShell.Main>
      </AppShell>
    );

    expect(screen.getByText('Nav').closest('aside')).toBeInTheDocument();
    // Header is a sibling of the Sidebar/Main row, not inside it -- stays
    // full-width across the top regardless of the sidebar's own width.
    const header = screen.getByText('Header').closest('header') as HTMLElement;
    const row = screen.getByText('Nav').closest('aside')!.parentElement as HTMLElement;
    expect(header.parentElement).not.toBe(row);
    expect(row.style.flexDirection).toBe('row');
  });

  // #860: the row used row-reverse on the children as written, so writing
  // Main before Sidebar put the sidebar on the wrong side. The Sidebar now
  // places itself with flex `order`, whatever the JSX order.
  it.each([
    ['sidebar-left', 'Sidebar first', '-1'],
    ['sidebar-left', 'Main first', '-1'],
    ['sidebar-right', 'Sidebar first', '1'],
    ['sidebar-right', 'Main first', '1'],
  ] as const)('places Sidebar on the named side in %s layout with %s in the JSX', (layout, written, order) => {
    render(
      <AppShell layout={layout}>
        {written === 'Main first' && <AppShell.Main>Main</AppShell.Main>}
        <AppShell.Sidebar>Nav</AppShell.Sidebar>
        {written === 'Sidebar first' && <AppShell.Main>Main</AppShell.Main>}
      </AppShell>
    );

    const aside = screen.getByText('Nav').closest('aside') as HTMLElement;
    expect((aside.parentElement as HTMLElement).style.flexDirection).toBe('row');
    expect(aside.style.order).toBe(order);
  });

  it('leaves Sidebar in source order in the default (column) layout', () => {
    render(
      <AppShell>
        <AppShell.Sidebar>Nav</AppShell.Sidebar>
      </AppShell>
    );
    expect((screen.getByText('Nav').closest('aside') as HTMLElement).style.order).toBe('');
  });

  it('borders Sidebar on the side facing Main, correctly for either layout direction', () => {
    const { rerender } = render(
      <AppShell layout="sidebar-left">
        <AppShell.Sidebar>Nav</AppShell.Sidebar>
        <AppShell.Main>Main</AppShell.Main>
      </AppShell>
    );
    let aside = screen.getByText('Nav').closest('aside') as HTMLElement;
    expect(aside.style.borderRight).not.toBe('');
    expect(aside.style.borderLeft).toBe('');

    rerender(
      <AppShell layout="sidebar-right">
        <AppShell.Sidebar>Nav</AppShell.Sidebar>
        <AppShell.Main>Main</AppShell.Main>
      </AppShell>
    );
    aside = screen.getByText('Nav').closest('aside') as HTMLElement;
    expect(aside.style.borderLeft).not.toBe('');
    expect(aside.style.borderRight).toBe('');
  });

  describe('regression: collapsing a <Sidebar> inside AppShell.Sidebar left a dead strip of empty space', () => {
    it('shrinks its own width in lockstep when a <Sidebar> inside it collapses/expands', () => {
      render(
        <AppShell layout="sidebar-left">
          <AppShell.Sidebar>
            <Sidebar items={[{ id: 'home', label: 'Home' }]} aria-label="Primary" />
          </AppShell.Sidebar>
          <AppShell.Main>Main</AppShell.Main>
        </AppShell>
      );
      const aside = screen.getByText('Home').closest('aside') as HTMLElement;
      expect(aside.style.width).toBe('var(--ai-appshell-sidebar-width, 16rem)');

      fireEvent.click(screen.getByLabelText('Collapse sidebar'));
      // Matches Sidebar's own COLLAPSED_WIDTH literal exactly -- the two
      // are meant to move in lockstep, not just both "get smaller."
      expect(aside.style.width).toBe('3.5rem');

      fireEvent.click(screen.getByLabelText('Expand sidebar'));
      expect(aside.style.width).toBe('var(--ai-appshell-sidebar-width, 16rem)');
    });

    it('stays at its default width when nothing inside ever reports a collapsed state', () => {
      render(
        <AppShell layout="sidebar-left">
          <AppShell.Sidebar>
            <span>Just some plain content, not a Sidebar</span>
          </AppShell.Sidebar>
          <AppShell.Main>Main</AppShell.Main>
        </AppShell>
      );
      const aside = screen.getByText('Just some plain content, not a Sidebar').closest('aside') as HTMLElement;
      expect(aside.style.width).toBe('var(--ai-appshell-sidebar-width, 16rem)');
    });
  });
});
