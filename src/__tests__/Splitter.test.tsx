import { describe, it, expect, vi } from 'vitest';
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
    // Splitter's drag-listener effect is deliberately useLayoutEffect, not
    // useEffect (see Splitter.tsx's own comment: the window-level pointer
    // listeners must attach synchronously in the same commit isDragging
    // becomes true, or a fast enough drag's first pointermove can fire
    // before a useEffect version has attached). React logs "useLayoutEffect
    // does nothing on the server" for exactly that combination — expected
    // and harmless for this test specifically, which only asserts on the
    // static SSR markup (the layout domain id), never on drag behavior.
    // Scoped to just these two calls so a real, unrelated console.error
    // elsewhere in this file still fails the test normally.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    consoleError.mockRestore();
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

  it('logs a console error when given a child count other than 2', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <Splitter orientation="vertical">
        {[<div key="only">Only Pane</div>] as any}
      </Splitter>
    );
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('requires exactly 2 children'));
    consoleError.mockRestore();
  });

  it('double-clicking the handle resets the split back to initialSplit', () => {
    render(
      <Splitter orientation="vertical" initialSplit={60} minSize={10}>
        <div>Top</div>
        <div>Bottom</div>
      </Splitter>
    );
    const handle = screen.getByRole('separator');

    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(handle).toHaveAttribute('aria-valuenow', '62');

    fireEvent.doubleClick(handle);
    expect(handle).toHaveAttribute('aria-valuenow', '60');
  });

  describe('regression coverage: mouse/pointer drag resizing', () => {
    it('dragging the handle (mousedown -> window mousemove -> window mouseup) resizes the vertical split and clears isDragging afterward', () => {
      const { container } = render(
        <Splitter orientation="vertical" initialSplit={50} minSize={10}>
          <div>Top</div>
          <div>Bottom</div>
        </Splitter>
      );
      const handle = screen.getByRole('separator');
      const outer = container.firstElementChild as HTMLElement;
      outer.getBoundingClientRect = () => ({
        top: 0, left: 0, right: 100, bottom: 200, width: 100, height: 200, x: 0, y: 0, toJSON: () => {},
      });

      fireEvent.mouseDown(handle);
      expect(handle.parentElement).not.toBeNull(); // dragging state now true — background switches to the "active" color
      expect(outer.style.userSelect).toBe('none');

      fireEvent.mouseMove(window, { clientY: 150 }); // 150/200 = 75%
      expect(handle).toHaveAttribute('aria-valuenow', '75');

      fireEvent.mouseUp(window);
      expect(outer.style.userSelect).toBe('auto');

      // A further move after mouseup shouldn't do anything — listeners were removed.
      fireEvent.mouseMove(window, { clientY: 20 });
      expect(handle).toHaveAttribute('aria-valuenow', '75');
    });

    it('dragging horizontally uses clientX/width instead of clientY/height', () => {
      const { container } = render(
        <Splitter orientation="horizontal" initialSplit={50} minSize={10}>
          <div>Left</div>
          <div>Right</div>
        </Splitter>
      );
      const handle = screen.getByRole('separator');
      const outer = container.firstElementChild as HTMLElement;
      outer.getBoundingClientRect = () => ({
        top: 0, left: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON: () => {},
      });

      fireEvent.mouseDown(handle);
      fireEvent.mouseMove(window, { clientX: 40 }); // 40/200 = 20%, clamped to minSize=10 -> stays 20
      expect(handle).toHaveAttribute('aria-valuenow', '20');
      fireEvent.mouseUp(window);
    });
  });

  describe('regression coverage: Splitter.Panel explicit squareCorners overrides', () => {
    it.each([
      ['top', { borderTopLeftRadius: '0px', borderTopRightRadius: '0px' }],
      ['bottom', { borderBottomLeftRadius: '0px', borderBottomRightRadius: '0px' }],
      ['left', { borderTopLeftRadius: '0px', borderBottomLeftRadius: '0px' }],
      ['right', { borderTopRightRadius: '0px', borderBottomRightRadius: '0px' }],
    ] as const)('squareCorners="%s" squares exactly those two corners', (squareCorners, expectedStyle) => {
      const { container } = render(
        <Splitter.Panel squareCorners={squareCorners}>
          <span>Content</span>
        </Splitter.Panel>
      );
      const panel = container.firstElementChild as HTMLElement;
      for (const [prop, value] of Object.entries(expectedStyle)) {
        expect(panel.style[prop as any]).toBe(value);
      }
    });

    it('squareCorners="none" applies no corner override at all', () => {
      const { container } = render(
        <Splitter.Panel squareCorners="none">
          <span>Content</span>
        </Splitter.Panel>
      );
      const panel = container.firstElementChild as HTMLElement;
      expect(panel.style.borderTopLeftRadius).toBe('');
      expect(panel.style.borderTopRightRadius).toBe('');
      expect(panel.style.borderBottomLeftRadius).toBe('');
      expect(panel.style.borderBottomRightRadius).toBe('');
    });

    it('injects width/boxSizing/radius directly into a plain DOM element child, but leaves a toolcrib/React component child alone', () => {
      const CustomComponent = ({ label }: { label: string }) => <span>{label}</span>;
      const { container } = render(
        <Splitter.Panel squareCorners="top">
          <div data-testid="plain-child" style={{ color: 'red' }}>Plain</div>
          <CustomComponent label="Component Child" />
        </Splitter.Panel>
      );

      const plainChild = screen.getByTestId('plain-child');
      expect(plainChild.style.borderTopLeftRadius).toBe('0px');
      expect(plainChild.style.width).toBe('100%');
      expect(plainChild.style.color).toBe('red'); // original style preserved

      // The component child renders untouched — no radius injected into it
      // (it has no way to consult a `style` prop the way a plain DOM node
      // does; see processDirectChild's own comment on why).
      expect(screen.getByText('Component Child')).toBeInTheDocument();
      expect(container.querySelector('span')?.style.borderTopLeftRadius).toBeFalsy();
    });
  });
});
