import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from '../components/AppShell/AppShell';

describe('AppShell Component', () => {
  it('renders AppShell with Header and Main slots', () => {
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

  it('reverses the row so Sidebar renders visually on the right in sidebar-right layout, without requiring the consumer to reorder their JSX', () => {
    render(
      <AppShell layout="sidebar-right">
        <AppShell.Sidebar>Nav</AppShell.Sidebar>
        <AppShell.Main>Main</AppShell.Main>
      </AppShell>
    );

    const row = screen.getByText('Nav').closest('aside')!.parentElement as HTMLElement;
    expect(row.style.flexDirection).toBe('row-reverse');
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
});
