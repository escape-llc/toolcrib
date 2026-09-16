import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useInjectChoiceSeparatorStyles } from '../theme/choiceSeparator';

function Probe() {
  useInjectChoiceSeparatorStyles();
  return null;
}

// Regression: the injected rule originally only matched
// `[role="radiogroup"] > .ai-btn` -- correct for a `type="single"`
// ToggleGroup, but Radix's own ToggleGroupPrimitive renders
// `role="toolbar"` (not `role="radiogroup"`, and not `role="group"` either
// -- confirmed directly against Radix's own source) for `type="multiple"`.
// Once ToggleGroup.tsx's own interior borders went transparent (relying on
// this rule as the sole visual divider), a multi-select group silently lost
// ALL division between its options -- caught by an external review, then
// confirmed via a real browser screenshot before fixing. jsdom can't render
// the pseudo-element itself, but it CAN read the injected `<style>` tag's
// real text content directly, which is enough to pin the selector contract
// so this exact regression can't silently reappear.
describe('choiceSeparator', () => {
  it('injects a rule covering both role="radiogroup" (single) and role="toolbar" (multiple)', () => {
    render(<Probe />);
    const style = document.getElementById('toolcrib-choice-separator');
    expect(style).toBeInTheDocument();
    expect(style?.textContent).toContain('[role="radiogroup"] > .ai-btn');
    expect(style?.textContent).toContain('[role="toolbar"] > .ai-btn');
  });
});
