import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

    expect(topCard.style.borderBottomLeftRadius).toBe('0');
    expect(topCard.style.borderBottomRightRadius).toBe('0');

    expect(bottomCard.style.borderTopLeftRadius).toBe('0');
    expect(bottomCard.style.borderTopRightRadius).toBe('0');
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

    expect(leftCard.style.borderTopRightRadius).toBe('0');
    expect(leftCard.style.borderBottomRightRadius).toBe('0');

    expect(rightCard.style.borderTopLeftRadius).toBe('0');
    expect(rightCard.style.borderBottomLeftRadius).toBe('0');
  });
});
