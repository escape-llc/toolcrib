import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Regression for issue #425: a multi-select chip's remove button sits on
// var(--ai-color-primary) -- the same hue --ai-focus-ring itself uses
// (focus rings stay primary-anchored everywhere, by design, per this
// repo's own confirmed ruling) -- so the shared .ai-focus-ring treatment
// would produce a ring with almost no contrast against its own surface.
// Fixed with a dedicated class whose ring is `currentColor` -- the chip's
// own resolved readable text color (--ai-color-primary-text, the
// WCAG-contrast-checked value, for a default chip; whatever `chipColor`
// resolves for a recolored one, issue #426). Both chip kinds are checked
// below: the demo's last chip ("PostgreSQL") uses `chipColor`'s secondary
// variant, the one before it ("TypeScript") is a default primary chip.
// Checks the real computed style directly -- jsdom cannot
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

  // By name, not `.last()` -- the multi-select Skills combobox used to be
  // the last one on its tab; on the single Encyclopedia page (issue #624)
  // the Form entry's Country combobox comes after it.
  const comboboxInput = page.getByRole('combobox', { name: 'Skills' });
  await comboboxInput.waitFor({ state: 'visible' });
  await comboboxInput.click();

  // Shift+Tab from the input lands on the last chip's own remove button --
  // its natural tab-order predecessor -- then once more onto the chip
  // before it.
  for (const expectedLabel of ['Remove PostgreSQL', 'Remove TypeScript']) {
    await page.keyboard.press('Shift+Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('aria-label', expectedLabel);

    // De-flaked (matches issue #413's own fix in interaction-states.spec.ts):
    // outline-color *transitions* on --ai-transition-duration-normal (220ms
    // floor, issue #411), not a snap, so reading it via a single synchronous
    // page.evaluate() immediately after the keypress races that transition --
    // under real CI scheduling (WebKit specifically) the snapshot can land
    // mid-fade, still at its transparent starting value. A Playwright
    // web-first assertion polls the real computed style until the
    // transition actually finishes, instead of sampling at a guessed
    // instant. The settled value must be the chip's own text color
    // (`currentColor`), which resolveColorVariant picks as readable on that
    // chip's background -- polled to equality, so a mid-fade sample can
    // never satisfy it.
    const textColor = await focused.evaluate(el => getComputedStyle(el).color);
    await expect(focused).toHaveCSS('outline-color', textColor);

    const info = await focused.evaluate(el => {
      const cs = getComputedStyle(el);
      return {
        className: el.className,
        outlineColor: cs.outlineColor,
        outlineStyle: cs.outlineStyle,
        chipBackground: getComputedStyle(el.parentElement as HTMLElement).backgroundColor,
      };
    });

    expect(info.className).toContain('ai-combobox-chip-remove');
    expect(info.outlineStyle).toBe('solid');
    // The real regression check: the ring must not be the same color as the
    // surface it sits on (the exact failure mode both the primary-hued
    // shared ring AND the demo-only !important override independently
    // produced during #425's own development).
    expect(info.outlineColor).not.toBe(info.chipBackground);
    expect(info.outlineColor).not.toBe('rgba(0, 0, 0, 0)');
  }
});
