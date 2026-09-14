import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Regression for issue #425: a multi-select chip's remove button sits on
// var(--ai-color-primary) -- the same hue --ai-focus-ring itself uses
// (focus rings stay primary-anchored everywhere, by design, per this
// repo's own confirmed ruling) -- so the shared .ai-focus-ring treatment
// would produce a ring with almost no contrast against its own surface.
// Fixed with a dedicated class using --ai-color-primary-text (the
// existing WCAG-contrast-checked value for content on a primary surface)
// instead. Checks the real computed style directly -- jsdom cannot
// resolve real CSS cascade/custom-property resolution across multiple
// stylesheets (see src/__tests__/Combobox.test.tsx's own note) -- and
// this is also the test that would have caught a real, separate bug
// found during this fix: a demo-only global `button:focus-visible`
// !important rule (demo/index.css) that unintentionally overrode this
// dedicated ring, invisible to any check that doesn't read the real,
// fully-cascaded computed style in an actual browser.
test('a chip remove button\'s focus ring has real contrast against its own chip background, not the shared primary-hued ring', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Component Showcase');

  const heading = page.getByText('Multi-Select Tags (`multiple`)', { exact: false });
  await heading.scrollIntoViewIfNeeded();

  const comboboxInput = page.locator('input[role="combobox"]').last();
  await comboboxInput.waitFor({ state: 'visible' });
  await comboboxInput.click();

  // Shift+Tab from the input lands on the last chip's own remove button --
  // its natural tab-order predecessor.
  await page.keyboard.press('Shift+Tab');

  // De-flaked (matches issue #413's own fix in interaction-states.spec.ts):
  // outline-color *transitions* on --ai-transition-duration-normal (220ms
  // floor, issue #411), not a snap, so reading it via a single synchronous
  // page.evaluate() immediately after the keypress races that transition --
  // under real CI scheduling (WebKit specifically) the snapshot can land
  // mid-fade, still at its transparent starting value, producing exactly
  // the "outlineColor is rgba(0,0,0,0)" failure this test is supposed to
  // rule out. A Playwright web-first assertion polls the real computed
  // style until the transition actually finishes, instead of sampling at a
  // guessed instant.
  await expect(page.locator(':focus')).not.toHaveCSS('outline-color', 'rgba(0, 0, 0, 0)');

  const info = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    const parentBg = getComputedStyle(el.parentElement as HTMLElement).backgroundColor;
    return {
      isRemoveButton: (el.getAttribute('aria-label') ?? '').startsWith('Remove '),
      className: el.className,
      outlineColor: cs.outlineColor,
      outlineStyle: cs.outlineStyle,
      chipBackground: parentBg,
    };
  });

  expect(info.isRemoveButton).toBe(true);
  expect(info.className).toContain('ai-combobox-chip-remove');
  expect(info.outlineStyle).toBe('solid');
  // The real regression check: the ring must not be the same color as the
  // surface it sits on (the exact failure mode both the primary-hued
  // shared ring AND the demo-only !important override independently
  // produced during this fix's own development).
  expect(info.outlineColor).not.toBe(info.chipBackground);
  expect(info.outlineColor).not.toBe('rgba(0, 0, 0, 0)');
});
