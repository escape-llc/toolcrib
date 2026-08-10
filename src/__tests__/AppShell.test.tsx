import React from 'react';
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
});
