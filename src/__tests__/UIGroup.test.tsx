import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UIGroup } from '../components/UIGroup/UIGroup';

// Corner-radius merging is applied via an injected global stylesheet
// (`.toolcrib-group[data-orientation=...] > *` selectors), not inline
// style on each child — jsdom doesn't run a CSS engine, so
// `element.style.borderRadius` can't observe stylesheet-applied values
// here the way a real browser can. These tests check the structural
// contract UIGroup renders (wrapper attributes, the CSS variable carrying
// the configured radius, children rendered unmodified) — the actual
// visual corner-squaring is verified separately in a real browser.
describe('UIGroup Component', () => {
  it('renders all children inside a single group wrapper with the right orientation attribute', () => {
    render(
      <UIGroup borderRadius="0.375rem">
        <button>First</button>
        <button>Middle</button>
        <button>Last</button>
      </UIGroup>
    );

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Middle')).toBeInTheDocument();
    expect(screen.getByText('Last')).toBeInTheDocument();

    const group = screen.getByRole('group');
    expect(group.className).toBe('toolcrib-group');
    expect(group.getAttribute('data-orientation')).toBe('horizontal');
    expect(group.style.getPropertyValue('--toolcrib-group-radius')).toBe('0.375rem');
  });

  it('defaults to horizontal orientation and the theme radius token', () => {
    render(
      <UIGroup>
        <button>Only</button>
      </UIGroup>
    );

    const group = screen.getByRole('group');
    expect(group.getAttribute('data-orientation')).toBe('horizontal');
    expect(group.style.getPropertyValue('--toolcrib-group-radius')).toBe('var(--ai-radius-md, 0.375rem)');
  });

  it('supports vertical orientation', () => {
    render(
      <UIGroup orientation="vertical" borderRadius="0.375rem">
        <button>Menu Item 1</button>
        <button>Menu Item 2</button>
        <button>Menu Item 3</button>
      </UIGroup>
    );

    const group = screen.getByRole('group');
    expect(group.getAttribute('data-orientation')).toBe('vertical');
    expect(screen.getByText('Menu Item 1')).toBeInTheDocument();
    expect(screen.getByText('Menu Item 2')).toBeInTheDocument();
    expect(screen.getByText('Menu Item 3')).toBeInTheDocument();
  });

  it('renders mixed plain-element and component children without modifying their own props', () => {
    render(
      <UIGroup borderRadius="0.375rem">
        <div style={{ padding: '0.5rem' }}>Badge Text</div>
        <button>Action Button</button>
      </UIGroup>
    );

    const badge = screen.getByText('Badge Text');
    // The child's own inline style is left untouched — UIGroup no longer
    // clones/injects props into children at all.
    expect(badge.style.padding).toBe('0.5rem');
    expect(screen.getByText('Action Button')).toBeInTheDocument();
  });

  it('injects the group stylesheet into the document exactly once', () => {
    render(
      <>
        <UIGroup><button>A</button></UIGroup>
        <UIGroup><button>B</button></UIGroup>
      </>
    );
    expect(document.querySelectorAll('#toolcrib-group-styles').length).toBe(1);
  });
});
