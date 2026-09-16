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

  // Regression: the default gray divider is unreadable against a selected
  // option's own solid primary-colored fill -- reported directly, from a
  // real screenshot, for the exact "divider between an unselected and a
  // selected option" case. A second, higher-specificity rule must switch
  // to --ai-color-primary-text (the same WCAG-contrast-computed "readable
  // on primary" variable Calendar/Stepper already use) whenever the
  // divider's own owning item is selected OR its immediately preceding
  // sibling is -- covering both directions, since which one "owns" the
  // seam's ::before depends on which item isn't :first-child.
  it('switches the divider to a primary-contrast color when it would otherwise sit on a selected fill', () => {
    render(<Probe />);
    const style = document.getElementById('toolcrib-choice-separator');
    expect(style?.textContent).toContain('[role="radiogroup"] > .ai-btn[data-state="on"]:not(:first-child)::before');
    expect(style?.textContent).toContain('[role="toolbar"] > .ai-btn[data-state="on"]:not(:first-child)::before');
    expect(style?.textContent).toContain('[role="radiogroup"] > .ai-btn[data-state="on"] + .ai-btn::before');
    expect(style?.textContent).toContain('[role="toolbar"] > .ai-btn[data-state="on"] + .ai-btn::before');
    expect(style?.textContent).toContain('--ai-color-primary-text');
  });

  // Regression: reported directly, from a real screenshot, that the two
  // divider colors (plain gray vs. selected-adjacent primary-text) read
  // as visibly different THICKNESSES despite identical geometry --
  // confirmed via getComputedStyle(el, '::before') to be a genuine
  // anti-aliasing/color-contrast perceived-width effect, not a real
  // geometry bug (jsdom has no layout engine and can't render this
  // effect at all, so this test can only pin the structural fix, not the
  // perceptual result itself -- that's verified via real screenshots,
  // documented in this file's own header comment). The fix: widen the
  // divider so the anti-aliaser has more real pixel coverage to work
  // with, and blend the higher-contrast selected-adjacent color toward
  // transparent so it doesn't read as visually bolder than the plain
  // gray divider at the same width.
  it('widens the divider and blends the selected-adjacent color toward transparent to equalize perceived thickness', () => {
    render(<Probe />);
    const style = document.getElementById('toolcrib-choice-separator');
    expect(style?.textContent).toContain('width: 0.125rem');
    expect(style?.textContent).toContain(
      'color-mix(in srgb, var(--ai-color-primary-text, #ffffff) 65%, transparent)'
    );
  });
});
