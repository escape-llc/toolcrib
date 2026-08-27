import { describe, it, expect } from 'vitest';
import { type ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { UIGroup } from '../components/UIGroup/UIGroup';
import { Button, Input } from '../components/Form/FormComponents';

// Wraps its own `trigger` child in an intermediate <div>, the same shape
// Modal/Popup/AlertDialog's own internal trigger wrapper takes (see their
// own components for the real thing) -- a minimal stand-in so this suite
// doesn't have to drag in a full Modal/Popup/AlertDialog + Radix portal
// just to prove the wrapper-div case specifically.
function WrappedTrigger({ trigger }: { trigger: ReactElement }) {
  return <div style={{ display: 'inline-flex' }}>{trigger}</div>;
}

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

// Unlike UIGroup's own CSS-based squaring (verified separately in a real
// browser, per the file-level comment above), this is an *inline* style a
// squareCorners-aware component computes itself from UIGroupContext --
// jsdom can observe it directly, no real browser needed.
describe('UIGroup automatic corner-squaring via context', () => {
  it('squares a direct-child Button based on its position: first/middle/last', () => {
    render(
      <UIGroup>
        <Button>First</Button>
        <Button>Middle</Button>
        <Button>Last</Button>
      </UIGroup>
    );

    const first = screen.getByText('First');
    const middle = screen.getByText('Middle');
    const last = screen.getByText('Last');

    // First: trailing edge (right, for horizontal) squared, leading (left) not.
    expect(first.style.borderTopRightRadius).toBe('0px');
    expect(first.style.borderBottomRightRadius).toBe('0px');
    expect(first.style.borderTopLeftRadius).not.toBe('0px');

    // Middle: every corner squared.
    expect(middle.style.borderTopLeftRadius).toBe('0px');
    expect(middle.style.borderTopRightRadius).toBe('0px');
    expect(middle.style.borderBottomLeftRadius).toBe('0px');
    expect(middle.style.borderBottomRightRadius).toBe('0px');

    // Last: leading edge (left) squared, trailing (right) not.
    expect(last.style.borderTopLeftRadius).toBe('0px');
    expect(last.style.borderBottomLeftRadius).toBe('0px');
    expect(last.style.borderTopRightRadius).not.toBe('0px');
  });

  it('does not square a single child (only member of the group)', () => {
    render(
      <UIGroup>
        <Button>Only</Button>
      </UIGroup>
    );
    const only = screen.getByText('Only');
    expect(only.style.borderTopLeftRadius).not.toBe('0px');
    expect(only.style.borderTopRightRadius).not.toBe('0px');
  });

  it('reaches a Button nested behind an intermediate wrapper <div> -- the Modal/Popup/AlertDialog trigger shape', () => {
    // This is the actual regression this context exists to fix: UIGroup's
    // own CSS only reaches *direct* DOM children, which a wrapped trigger
    // (like Modal's/Popup's/AlertDialog's own internal trigger div) never
    // is. Confirmed failing without the context (a Button here read its
    // default, unsquared radius) before this fix landed.
    render(
      <UIGroup>
        <Button>First</Button>
        <WrappedTrigger trigger={<Button>Wrapped</Button>} />
        <Button>Last</Button>
      </UIGroup>
    );

    const wrapped = screen.getByText('Wrapped');
    expect(wrapped.style.borderTopLeftRadius).toBe('0px');
    expect(wrapped.style.borderTopRightRadius).toBe('0px');
    expect(wrapped.style.borderBottomLeftRadius).toBe('0px');
    expect(wrapped.style.borderBottomRightRadius).toBe('0px');
  });

  it('lets an explicit squareCorners prop win over the automatic UIGroup value', () => {
    render(
      <UIGroup>
        <Button>First</Button>
        <Button squareCorners="none">Override</Button>
        <Button>Last</Button>
      </UIGroup>
    );

    const override = screen.getByText('Override');
    expect(override.style.borderTopLeftRadius).not.toBe('0px');
    expect(override.style.borderTopRightRadius).not.toBe('0px');
  });

  it('skips non-element children (a falsy conditional) when computing first/last position', () => {
    const showMiddle = false;
    render(
      <UIGroup>
        <Button>First</Button>
        {showMiddle && <Button>Middle</Button>}
        <Button>Last</Button>
      </UIGroup>
    );

    // With the falsy conditional correctly skipped, "Last" is still the
    // group's true last member (leading edge squared, trailing not) --
    // not treated as a middle item just because three JSX children were
    // authored.
    const last = screen.getByText('Last');
    expect(last.style.borderTopLeftRadius).toBe('0px');
    expect(last.style.borderTopRightRadius).not.toBe('0px');
  });

  it('squares top/bottom (not left/right) for a vertical group', () => {
    render(
      <UIGroup orientation="vertical">
        <Button>First</Button>
        <Button>Last</Button>
      </UIGroup>
    );

    const first = screen.getByText('First');
    const last = screen.getByText('Last');
    expect(first.style.borderBottomLeftRadius).toBe('0px');
    expect(first.style.borderBottomRightRadius).toBe('0px');
    expect(first.style.borderTopLeftRadius).not.toBe('0px');

    expect(last.style.borderTopLeftRadius).toBe('0px');
    expect(last.style.borderTopRightRadius).toBe('0px');
    expect(last.style.borderBottomLeftRadius).not.toBe('0px');
  });

  it('also squares an Input the same way -- its squareCorners prop was previously destructured but never applied at all', () => {
    render(
      <UIGroup>
        <Input aria-label="search" />
        <Button>Go</Button>
      </UIGroup>
    );
    const input = screen.getByLabelText('search');
    expect(input.style.borderTopRightRadius).toBe('0px');
    expect(input.style.borderBottomRightRadius).toBe('0px');
    expect(input.style.borderTopLeftRadius).not.toBe('0px');
  });
});
