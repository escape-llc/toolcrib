import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toolbar } from '../components/Toolbar/Toolbar';

describe('Toolbar Component', () => {
  it('renders Toolbar with Left, Center, and Right slots', () => {
    render(
      <Toolbar>
        <Toolbar.Left>
          <span>Title Text</span>
        </Toolbar.Left>
        <Toolbar.Center>
          <span>Center Nav</span>
        </Toolbar.Center>
        <Toolbar.Right>
          <button>Action</button>
        </Toolbar.Right>
      </Toolbar>
    );

    expect(screen.getByText('Title Text')).toBeInTheDocument();
    expect(screen.getByText('Center Nav')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  // Regression: orientation="vertical" previously only affected Radix's
  // roving-tabindex arrow-key axis — the toolbar's own visual layout (and
  // every Left/Center/Right slot's) stayed a hardcoded horizontal row
  // regardless of the prop, a real mismatch with what the prop name promises
  // and with every other orientation-aware component in the toolkit.
  it('stacks vertically, including every slot and the end-pushing margin, when orientation="vertical"', () => {
    render(
      <Toolbar orientation="vertical">
        <Toolbar.Left>
          <span>Top</span>
        </Toolbar.Left>
        <Toolbar.Right>
          <span>Bottom</span>
        </Toolbar.Right>
      </Toolbar>
    );

    expect(screen.getByRole('toolbar')).toHaveStyle({ flexDirection: 'column' });
    const rightSlot = screen.getByText('Bottom').closest('div') as HTMLElement;
    expect(rightSlot).toHaveStyle({ flexDirection: 'column', marginTop: 'auto' });
    expect(rightSlot.style.marginLeft).toBe('');
  });

  it('lays out horizontally by default', () => {
    render(
      <Toolbar>
        <Toolbar.Left>
          <span>Title</span>
        </Toolbar.Left>
      </Toolbar>
    );
    expect(screen.getByRole('toolbar')).toHaveStyle({ flexDirection: 'row' });
  });

  it("Toolbar.Separator reads the shared --ai-separator-thickness variable instead of a hardcoded value", () => {
    render(
      <Toolbar>
        <Toolbar.Left>
          <Toolbar.Separator />
        </Toolbar.Left>
      </Toolbar>
    );
    const separator = screen.getByRole('separator') as HTMLElement;
    expect(separator.style.width).toContain('var(--ai-separator-thickness');
  });
});
