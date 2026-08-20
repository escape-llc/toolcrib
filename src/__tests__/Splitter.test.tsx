import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Splitter } from '../components/Splitter/Splitter';

describe('Splitter Component & Corner Squaring', () => {
  it('renders split panes and separator handle', () => {
    render(
      <Splitter orientation="vertical" initialSplit={60}>
        <div>Top Pane Content</div>
        <div>Bottom Pane Content</div>
      </Splitter>
    );

    expect(screen.getByText('Top Pane Content')).toBeInTheDocument();
    expect(screen.getByText('Bottom Pane Content')).toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('squares off joining bottom corners for top pane and top corners for bottom pane in vertical orientation', () => {
    render(
      <Splitter orientation="vertical" initialSplit={50}>
        <Splitter.Panel>
          <div data-testid="top-card">Top Card</div>
        </Splitter.Panel>
        <Splitter.Panel>
          <div data-testid="bottom-card">Bottom Card</div>
        </Splitter.Panel>
      </Splitter>
    );

    const topCard = screen.getByTestId('top-card');
    const bottomCard = screen.getByTestId('bottom-card');

    expect(topCard.style.borderBottomLeftRadius).toBe('0rem');
    expect(topCard.style.borderBottomRightRadius).toBe('0rem');

    expect(bottomCard.style.borderTopLeftRadius).toBe('0rem');
    expect(bottomCard.style.borderTopRightRadius).toBe('0rem');
  });

  it('squares off joining right corners for left pane and left corners for right pane in horizontal orientation', () => {
    render(
      <Splitter orientation="horizontal" initialSplit={40}>
        <Splitter.Panel>
          <div data-testid="left-card">Left Card</div>
        </Splitter.Panel>
        <Splitter.Panel>
          <div data-testid="right-card">Right Card</div>
        </Splitter.Panel>
      </Splitter>
    );

    const leftCard = screen.getByTestId('left-card');
    const rightCard = screen.getByTestId('right-card');

    expect(leftCard.style.borderTopRightRadius).toBe('0rem');
    expect(leftCard.style.borderBottomRightRadius).toBe('0rem');

    expect(rightCard.style.borderTopLeftRadius).toBe('0rem');
    expect(rightCard.style.borderBottomLeftRadius).toBe('0rem');
  });

  it('regression: layout domain id is deterministic across independent server renders (SSR/hydration safety)', () => {
    // Splitter renders its layout domain id directly into
    // `data-ai-layout-domain` on both panel wrappers. It previously
    // generated that id via Math.random() in a useRef, which produces a
    // different value on every fresh render call — harmless client-only,
    // but for anyone server-rendering, the server's render and the
    // client's first (pre-hydration) render must produce byte-identical
    // markup or React logs a hydration mismatch (and, worse here, the
    // mismatched attribute would desync LayoutDomainProvider's context
    // value from what corner-squaring children actually read). Two
    // independent renderToString() calls simulate exactly that: same
    // props, no shared client-side state between them, same output
    // expected.
    const render1 = renderToString(
      <Splitter orientation="vertical" initialSplit={60}>
        <div>a</div>
        <div>b</div>
      </Splitter>
    );
    const render2 = renderToString(
      <Splitter orientation="vertical" initialSplit={60}>
        <div>a</div>
        <div>b</div>
      </Splitter>
    );
    expect(render1).toBe(render2);
  });

  describe('regression: resize handle was mouse/pointer-drag only, unreachable by keyboard', () => {
    // role="separator" + aria-orientation were already present, but with no
    // tabIndex/onKeyDown/aria-valuenow the handle could never be reached or
    // operated via keyboard at all, contradicting the WAI-ARIA APG Window
    // Splitter pattern a "separator" role like this one implies.
    it('is keyboard-focusable and exposes its current split as aria-valuenow/min/max', () => {
      render(
        <Splitter orientation="vertical" initialSplit={60} minSize={10}>
          <div>Top</div>
          <div>Bottom</div>
        </Splitter>
      );
      const handle = screen.getByRole('separator');
      expect(handle).toHaveAttribute('tabindex', '0');
      expect(handle).toHaveAttribute('aria-valuenow', '60');
      expect(handle).toHaveAttribute('aria-valuemin', '10');
      expect(handle).toHaveAttribute('aria-valuemax', '90');
    });

    it('resizes via arrow keys, matching the drag orientation (ArrowDown/Up for vertical)', () => {
      const { container } = render(
        <Splitter orientation="vertical" initialSplit={60} minSize={10}>
          <Splitter.Panel><div>Top</div></Splitter.Panel>
          <Splitter.Panel><div>Bottom</div></Splitter.Panel>
        </Splitter>
      );
      const handle = screen.getByRole('separator');
      const firstPanel = container.querySelector('[data-ai-layout-slot="first"]') as HTMLElement;

      fireEvent.keyDown(handle, { key: 'ArrowDown' });
      expect(handle).toHaveAttribute('aria-valuenow', '62');
      expect(firstPanel.style.flex).toContain('62%');

      fireEvent.keyDown(handle, { key: 'ArrowUp' });
      expect(handle).toHaveAttribute('aria-valuenow', '60');
    });

    it('resizes horizontally via ArrowLeft/ArrowRight and clamps to minSize/maxSize via Home/End', () => {
      render(
        <Splitter orientation="horizontal" initialSplit={50} minSize={20}>
          <div>Left</div>
          <div>Right</div>
        </Splitter>
      );
      const handle = screen.getByRole('separator');

      fireEvent.keyDown(handle, { key: 'ArrowRight' });
      expect(handle).toHaveAttribute('aria-valuenow', '52');

      fireEvent.keyDown(handle, { key: 'End' });
      expect(handle).toHaveAttribute('aria-valuenow', '80');

      fireEvent.keyDown(handle, { key: 'Home' });
      expect(handle).toHaveAttribute('aria-valuenow', '20');
    });
  });
});
