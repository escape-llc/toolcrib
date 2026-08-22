import { describe, it, expect } from 'vitest';
import React from 'react';
import { computeCornerSquaring, renderTriggerWithCornerSquaring } from '../theme/connectedPopoverStyles';

describe('computeCornerSquaring', () => {
  it('squares the popup\'s top-left and the trigger\'s bottom-left for bottom-start (the common default)', () => {
    const result = computeCornerSquaring('bottom', 'start', true);
    expect(result.popupCornerStyle.borderTopLeftRadius).toBe(0);
    expect(result.popupCornerStyle.borderTopRightRadius).not.toBe(0);
    expect(result.popupCornerStyle.borderBottomLeftRadius).not.toBe(0);
    expect(result.popupCornerStyle.borderBottomRightRadius).not.toBe(0);
    expect(result.triggerCornerStyle.borderBottomLeftRadius).toBe(0);
    expect(result.triggerSquareCorners).toEqual(['bottom-left']);
  });

  it('squares the opposite corners for bottom-end, top-start, and top-end', () => {
    expect(computeCornerSquaring('bottom', 'end', true).popupCornerStyle.borderTopRightRadius).toBe(0);
    expect(computeCornerSquaring('bottom', 'end', true).triggerCornerStyle.borderBottomRightRadius).toBe(0);

    expect(computeCornerSquaring('top', 'start', true).popupCornerStyle.borderBottomLeftRadius).toBe(0);
    expect(computeCornerSquaring('top', 'start', true).triggerCornerStyle.borderTopLeftRadius).toBe(0);

    expect(computeCornerSquaring('top', 'end', true).popupCornerStyle.borderBottomRightRadius).toBe(0);
    expect(computeCornerSquaring('top', 'end', true).triggerCornerStyle.borderTopRightRadius).toBe(0);
  });

  it('handles left/right sides the same way as top/bottom', () => {
    expect(computeCornerSquaring('right', 'start', true).popupCornerStyle.borderTopLeftRadius).toBe(0);
    expect(computeCornerSquaring('right', 'start', true).triggerCornerStyle.borderTopRightRadius).toBe(0);

    expect(computeCornerSquaring('right', 'end', true).popupCornerStyle.borderBottomLeftRadius).toBe(0);
    expect(computeCornerSquaring('right', 'end', true).triggerCornerStyle.borderBottomRightRadius).toBe(0);

    expect(computeCornerSquaring('left', 'start', true).popupCornerStyle.borderTopRightRadius).toBe(0);
    expect(computeCornerSquaring('left', 'start', true).triggerCornerStyle.borderTopLeftRadius).toBe(0);

    expect(computeCornerSquaring('left', 'end', true).popupCornerStyle.borderBottomRightRadius).toBe(0);
    expect(computeCornerSquaring('left', 'end', true).triggerCornerStyle.borderBottomLeftRadius).toBe(0);
  });

  it('degrades gracefully for align="center" -- no single connecting corner, so nothing squares', () => {
    const result = computeCornerSquaring('bottom', 'center', true);
    expect(result.popupCornerStyle.borderTopLeftRadius).not.toBe(0);
    expect(result.popupCornerStyle.borderTopRightRadius).not.toBe(0);
    expect(result.triggerCornerStyle).toEqual({});
    expect(result.triggerSquareCorners).toBe('none');
  });

  it('only squares the trigger while actually open, so a closed trigger keeps its normal shape', () => {
    const closed = computeCornerSquaring('bottom', 'start', false);
    expect(closed.triggerCornerStyle.borderBottomLeftRadius).toBe('inherit');
    expect(closed.triggerSquareCorners).toBe('none');
    // The popup's own corner style is independent of isOpen -- Radix only
    // mounts Content while open anyway, so there's nothing to gate there.
    expect(closed.popupCornerStyle.borderTopLeftRadius).toBe(0);
  });

  it('always returns a small negative sideOffset, for a seamless connected look', () => {
    expect(computeCornerSquaring('bottom', 'start', true).sideOffset).toBeLessThan(0);
  });

  it('accepts a custom radius token, matching whichever radius scale the caller already uses', () => {
    const result = computeCornerSquaring('bottom', 'start', true, 'var(--ai-radius-md, 0.375rem)');
    expect(result.popupCornerStyle.borderTopRightRadius).toBe('var(--ai-radius-md, 0.375rem)');
  });
});

describe('renderTriggerWithCornerSquaring', () => {
  it('clones squareCorners onto a toolcrib-native (non-DOM-string) trigger element', () => {
    const Fake = (_props: { squareCorners?: unknown }) => null;
    const squaring = computeCornerSquaring('bottom', 'start', true);
    const trigger = React.createElement(Fake, {});
    const result = renderTriggerWithCornerSquaring(trigger, squaring) as React.ReactElement<{ squareCorners?: unknown }>;
    expect(result.props.squareCorners).toEqual(['bottom-left']);
  });

  it('patches a direct style onto a plain DOM element trigger instead', () => {
    const squaring = computeCornerSquaring('bottom', 'start', true);
    const trigger = React.createElement('button', { style: { color: 'red' } });
    const result = renderTriggerWithCornerSquaring(trigger, squaring) as React.ReactElement<{ style?: React.CSSProperties }>;
    expect(result.props.style?.color).toBe('red'); // original style preserved
    expect(result.props.style?.borderBottomLeftRadius).toBe(0);
  });

  it('passes non-element children through untouched', () => {
    expect(renderTriggerWithCornerSquaring('plain text', computeCornerSquaring('bottom', 'start', true))).toBe('plain text');
  });
});
