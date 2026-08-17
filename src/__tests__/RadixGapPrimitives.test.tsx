import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HoverCard } from '../components/HoverCard/HoverCard';
import { AspectRatio } from '../components/Layout/AspectRatio';
import { Toolbar } from '../components/Toolbar/Toolbar';
import { aiBus } from '../eventBus/eventBus';

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

describe('HoverCard Component', () => {
  it('opens on hover and closes when the pointer leaves, emitting hovercard:shown/hidden', async () => {
    const shownFn = vi.fn();
    const hiddenFn = vi.fn();
    const unsubShown = aiBus.on('hovercard:shown', shownFn);
    const unsubHidden = aiBus.on('hovercard:hidden', hiddenFn);

    render(
      <HoverCard id="test-hovercard" content={<span>Rich preview content</span>} openDelay={0} closeDelay={0}>
        <a href="#profile">@jane</a>
      </HoverCard>
    );

    const trigger = screen.getByText('@jane');
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    await waitFor(() => expect(screen.getByText('Rich preview content')).toBeInTheDocument());
    expect(shownFn).toHaveBeenCalledWith({ id: 'test-hovercard' });

    fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
    await waitFor(() => expect(screen.queryByText('Rich preview content')).not.toBeInTheDocument());
    expect(hiddenFn).toHaveBeenCalledWith({ id: 'test-hovercard' });

    unsubShown();
    unsubHidden();
  });

  it('applies overrides (shadowDepth/borderStyle) as scoped CSS custom properties on the content', async () => {
    render(
      <HoverCard
        content={<span>Preview</span>}
        openDelay={0}
        closeDelay={0}
        overrides={{ shadowDepth: 'elevated', borderStyle: 'borderless' }}
      >
        <a href="#profile">@jane</a>
      </HoverCard>
    );

    fireEvent.pointerEnter(screen.getByText('@jane'), { pointerType: 'mouse' });
    await waitFor(() => expect(screen.getByText('Preview')).toBeInTheDocument());
    const content = document.querySelector('.ai-focus-ring') as HTMLElement;

    expect(content.style.getPropertyValue('--ai-hovercard-shadow')).not.toBe('');
    expect(content.style.getPropertyValue('--ai-hovercard-border')).toBe('none');
  });
});

describe('AspectRatio Component', () => {
  it('renders its child content', () => {
    render(
      <AspectRatio ratio={16 / 9}>
        <img src="thumb.png" alt="A thumbnail" />
      </AspectRatio>
    );
    expect(screen.getByAltText('A thumbnail')).toBeInTheDocument();
  });

  // The `ratio` prop is the entire point of this component — worth
  // confirming it actually changes the rendered box, not just that
  // *a* box with *some* ratio renders (the padding-bottom-percentage
  // technique Radix uses is easy to get right for one ratio and wrong for
  // a different one without either failing the "renders" assertion alone).
  it('produces a different padding-bottom percentage for different ratios', () => {
    const { container: square } = render(
      <AspectRatio ratio={1}>
        <img src="a.png" alt="square" />
      </AspectRatio>
    );
    const { container: wide } = render(
      <AspectRatio ratio={16 / 9}>
        <img src="b.png" alt="wide" />
      </AspectRatio>
    );
    const squareWrapper = square.querySelector('[data-radix-aspect-ratio-wrapper]') as HTMLElement;
    const wideWrapper = wide.querySelector('[data-radix-aspect-ratio-wrapper]') as HTMLElement;

    expect(squareWrapper.style.paddingBottom).toBe('100%');
    expect(wideWrapper.style.paddingBottom).toBe('56.25%');
  });
});

describe('Toolbar roving-focus upgrade', () => {
  it('exposes an accessible toolbar landmark role', () => {
    render(
      <Toolbar>
        <Toolbar.Left>
          <span>Title</span>
        </Toolbar.Left>
      </Toolbar>
    );
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('still renders arbitrary (non-Toolbar.Button) children unaffected', () => {
    render(
      <Toolbar>
        <Toolbar.Left>
          <span>Title Text</span>
        </Toolbar.Left>
        <Toolbar.Right>
          <button>Plain Action</button>
        </Toolbar.Right>
      </Toolbar>
    );
    expect(screen.getByText('Title Text')).toBeInTheDocument();
    expect(screen.getByText('Plain Action')).toBeInTheDocument();
  });

  it('registers Toolbar.Button items with the roving-focus group, unlike a plain button', () => {
    // Confirms the mechanism-level fact ("did this button join Radix's
    // RovingFocusGroup Collection") rather than the timing-sensitive
    // tabIndex bookkeeping the group derives from it — jsdom's effect
    // ordering for Radix's Collection-backed roving group doesn't reliably
    // match a real browser's settled state within one synchronous render.
    render(
      <Toolbar>
        <Toolbar.Left>
          <Toolbar.Button>Roving</Toolbar.Button>
          <button>Plain</button>
        </Toolbar.Left>
      </Toolbar>
    );

    expect(screen.getByText('Roving')).toHaveAttribute('data-radix-collection-item');
    expect(screen.getByText('Plain')).not.toHaveAttribute('data-radix-collection-item');
  });

  it('applies a slotGap override as a scoped CSS custom property on the root', () => {
    render(
      <Toolbar overrides={{ slotGap: 'spacious' }}>
        <Toolbar.Left>
          <span>Title</span>
        </Toolbar.Left>
      </Toolbar>
    );
    expect(screen.getByRole('toolbar').style.getPropertyValue('--ai-toolbar-slot-gap')).toContain('0.875rem');
  });

  // Toolbar.Button is composed via Radix's asChild (ToolbarPrimitive.Button
  // wrapping toolcrib's own <Button>) — a real place a prop like `disabled`
  // could get lost in transit without ever surfacing as a type error, since
  // both layers separately accept a `disabled` prop of the same name.
  it('forwards disabled through to the real button and blocks its onClick', () => {
    const onClick = vi.fn();
    render(
      <Toolbar>
        <Toolbar.Left>
          <Toolbar.Button disabled onClick={onClick}>
            Action
          </Toolbar.Button>
        </Toolbar.Left>
      </Toolbar>
    );
    const button = screen.getByText('Action').closest('button') as HTMLButtonElement;
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
