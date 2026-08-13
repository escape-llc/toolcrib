import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
