import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Regression coverage for issue #411: the shared `.ai-btn`/`.ai-tab-trigger`/
// `.ai-focus-ring` rule's own `transition` used to be `outline-color` only,
// as an `!important` shorthand -- which wins the WHOLE transition-property
// set for any element carrying one of those classes (cascade never merges
// two competing `transition` declarations, confirmed the same way as
// Toast's own #358). That silently discarded 14 real components' own inline
// transitions outright, not just shortened them, so their hover/selection
// color changes (and in ToggleGroup's case, the originally-reported bug --
// a Left/Center/Right segmented control) snapped instantly instead of
// fading.
//
// Checks the actual computed CSS mechanism directly (transitionProperty/
// transitionDuration), not simulated hover/frame-sampling -- same
// deliberate choice as toast-stacking.spec.ts's own regression test (see
// its comment): resolution-independent, doesn't depend on how many real
// animation frames a CI runner happens to deliver.

test('a ToggleGroup item transitions background-color/border-color, not just outline-color', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Component Showcase');

  const leftOption = page.getByText('◀ Left', { exact: true });
  await leftOption.waitFor({ state: 'visible' });

  const { transitionProperty, transitionDuration } = await leftOption.evaluate(el => {
    const cs = getComputedStyle(el);
    return { transitionProperty: cs.transitionProperty, transitionDuration: cs.transitionDuration };
  });

  const properties = transitionProperty.split(',').map(s => s.trim());
  expect(properties).toContain('background-color');
  expect(properties).toContain('border-color');
  expect(properties).toContain('outline-color');

  const durations = transitionDuration.split(',').map(s => s.trim());
  // Every listed property shares the one base-rule duration (issue #411's
  // own "single shared duration, not a per-property split" design) -- none
  // of them should be 0s, which would mean that property fell outside the
  // winning transition-property list entirely (the pre-fix, collision
  // signature).
  expect(durations.every(d => d !== '0s')).toBe(true);
});

test('a Checkbox transitions background-color/border-color despite its own `all: unset` reset', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Forms & Zod Engine');

  const checkbox = page.getByRole('checkbox', { name: 'I agree to terms and conditions' });
  await checkbox.waitFor({ state: 'visible' });

  const { transitionProperty, transitionDuration } = await checkbox.evaluate(el => {
    const cs = getComputedStyle(el);
    return { transitionProperty: cs.transitionProperty, transitionDuration: cs.transitionDuration };
  });

  const properties = transitionProperty.split(',').map(s => s.trim());
  expect(properties).toContain('background-color');
  expect(properties).toContain('border-color');
  expect(properties).toContain('outline-color');

  const durations = transitionDuration.split(',').map(s => s.trim());
  expect(durations.every(d => d !== '0s')).toBe(true);
});
