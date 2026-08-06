import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UIGroup } from '../components/UIGroup/UIGroup';

describe('UIGroup Component - Extensive CSS & Corner Combination Tests', () => {
  it('correctly styles a 3-button horizontal toolbar', () => {
    render(
      <UIGroup borderRadius="0.375rem">
        <button>First</button>
        <button>Middle</button>
        <button>Last</button>
      </UIGroup>
    );

    const first = screen.getByText('First');
    const middle = screen.getByText('Middle');
    const last = screen.getByText('Last');

    expect(first.style.borderRadius).toBe('0.375rem 0 0 0.375rem');
    expect(first.style.alignSelf).toBe('stretch');

    expect(middle.style.borderRadius).toBe('0');
    expect(middle.style.marginLeft).toBe('-0.0625rem');
    expect(middle.style.alignSelf).toBe('stretch');

    expect(last.style.borderRadius).toBe('0 0.375rem 0.375rem 0');
    expect(last.style.marginLeft).toBe('-0.0625rem');
    expect(last.style.alignSelf).toBe('stretch');
  });

  it('correctly styles a mixed badge div + button toolbar combination', () => {
    render(
      <UIGroup borderRadius="0.375rem">
        <div style={{ padding: '0.5rem' }}>Badge Text</div>
        <button>Action Button</button>
      </UIGroup>
    );

    const badge = screen.getByText('Badge Text');
    const button = screen.getByText('Action Button');

    expect(badge.style.borderRadius).toBe('0.375rem 0 0 0.375rem');

    expect(button.style.borderRadius).toBe('0 0.375rem 0.375rem 0');
    expect(button.style.marginLeft).toBe('-0.0625rem');
    expect(button.style.alignSelf).toBe('stretch');
  });

  it('correctly styles a 4-element DataTable pagination toolbar (select + button + span + button)', () => {
    render(
      <UIGroup borderRadius="0.25rem">
        <select data-testid="select">
          <option>10 per page</option>
        </select>
        <button>◀</button>
        <span>1 / 10</span>
        <button>▶</button>
      </UIGroup>
    );

    const select = screen.getByTestId('select');
    const prevBtn = screen.getByText('◀');
    const pageSpan = screen.getByText('1 / 10');
    const nextBtn = screen.getByText('▶');

    expect(select.style.borderRadius).toBe('0.25rem 0 0 0.25rem');

    expect(prevBtn.style.borderRadius).toBe('0');
    expect(prevBtn.style.marginLeft).toBe('-0.0625rem');

    expect(pageSpan.style.borderRadius).toBe('0');
    expect(pageSpan.style.marginLeft).toBe('-0.0625rem');

    expect(nextBtn.style.borderRadius).toBe('0 0.25rem 0.25rem 0');
    expect(nextBtn.style.marginLeft).toBe('-0.0625rem');
  });

  it('correctly styles a vertical layout combination (Popup menu items)', () => {
    render(
      <UIGroup orientation="vertical" borderRadius="0.375rem">
        <button>Menu Item 1</button>
        <button>Menu Item 2</button>
        <button>Menu Item 3</button>
      </UIGroup>
    );

    const item1 = screen.getByText('Menu Item 1');
    const item2 = screen.getByText('Menu Item 2');
    const item3 = screen.getByText('Menu Item 3');

    expect(item1.style.borderRadius).toBe('0.375rem 0.375rem 0 0');

    expect(item2.style.borderRadius).toBe('0');
    expect(item2.style.marginTop).toBe('-0.0625rem');

    expect(item3.style.borderRadius).toBe('0 0 0.375rem 0.375rem');
    expect(item3.style.marginTop).toBe('-0.0625rem');
  });

  it('handles a single child gracefully with all 4 rounded corners', () => {
    render(
      <UIGroup borderRadius="0.5rem">
        <button>Single Child</button>
      </UIGroup>
    );

    const button = screen.getByText('Single Child');
    expect(button.style.borderRadius).toBe('0.5rem');
  });
});
