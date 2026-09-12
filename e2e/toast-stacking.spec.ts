import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Real-browser confirmation of the "toasts jerk around instead of smoothly
// transitioning" fix -- complements src/__tests__/Toast.test.tsx's own
// jsdom suite (which already covers the underlying --stack-offset
// arithmetic exhaustively, using an estimated height since jsdom has no
// ResizeObserver/layout engine to measure a real one). The things only a
// real browser can prove: a toast's own height is actually measured (not
// just the estimate), the resulting stackOffset is applied as a real
// `transform: translateY(...)`, and dismissing one toast makes the
// remaining ones visibly move to new Y positions rather than snapping.
//
// Also the thing that actually caught useAdaptiveSize's own portal-timing
// bug (fixed alongside this): the FIRST toast ever mounted never got its
// real height measured at all (rootRef.current was still null on that
// hook's very first effect run, since Radix's Toast.Root portals into a
// Viewport that's itself still being set up in the same commit) -- every
// OTHER toast's stackOffset kept computing off the stale
// TOAST_ESTIMATED_HEIGHT_PX fallback for it forever, which this spec's own
// early failures (a 20-30px position mismatch after dismissing the first
// toast) is what actually surfaced, not code review.

test('multiple toasts stack at distinct Y positions, and dismissing one moves the rest into its place', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Toast Subsystem');

  const fireInfo = page.getByRole('button', { name: 'Fire Info Toast', exact: true });
  await fireInfo.click();
  await fireInfo.click();
  await fireInfo.click();

  const toasts = page.locator('[data-testid="toast-item"]');
  await expect(toasts).toHaveCount(3);
  // Let ResizeObserver report each toast's REAL height and the resulting
  // layout settle before measuring.
  await page.waitForTimeout(400);

  // Real measured Y positions (getBoundingClientRect, not the CSS variable
  // directly) -- proves the transform is actually being applied and
  // rendered, not just present as an inert style value.
  const yPositions = await toasts.evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
  const [yTop, yMiddle, yBottom] = yPositions;
  expect(yMiddle).toBeGreaterThan(yTop);
  expect(yBottom).toBeGreaterThan(yMiddle);

  // Dismiss the topmost (first-added) toast -- the other two should slide
  // up into its place. Re-query after dismissal since the closed toast is
  // removed from the DOM once its own exit animation finishes.
  await toasts.first().locator('button[aria-label="Dismiss toast"]').click();
  await expect(toasts).toHaveCount(2, { timeout: 2000 });
  // Let the transform transition (--ai-toast-stack-duration, 260ms default)
  // actually finish before measuring -- otherwise this reads a mid-flight
  // position, not the settled one.
  await page.waitForTimeout(400);

  const newYPositions = await toasts.evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
  // The remaining two toasts (previously middle/bottom) now occupy the
  // original top/middle slots -- a few px of tolerance for ordinary
  // sub-pixel layout/font-metric variance between the two measurements,
  // not a precision this fix needs to hit exactly.
  expect(Math.abs(newYPositions[0] - yTop)).toBeLessThan(3);
  expect(Math.abs(newYPositions[1] - yMiddle)).toBeLessThan(3);
});

// Regression for a real Gemini-caught bug on this fix's first pass:
// translateY(positive) always moves an element DOWN in screen space
// regardless of whether it's anchored via `top` or `bottom` -- a bottom-
// anchored stack needs a NEGATED offset to stack upward, away from the
// bottom edge, instead of further down/off-screen underneath it. The
// jsdom suite only ever checked the numeric magnitude of --stack-offset,
// never real layout, so it couldn't have caught this on its own -- only a
// real browser measurement (this test) proves each toast is actually
// ABOVE the one below it, not overlapping/off-screen.
test('a bottom-anchored stack stacks upward -- each earlier toast sits ABOVE the one below it, not off-screen', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Toast Subsystem');

  await page.getByRole('combobox', { name: 'Toast Anchor Position:' }).click();
  await page.getByRole('option', { name: 'Bottom Right' }).click();

  const fireInfo = page.getByRole('button', { name: 'Fire Info Toast', exact: true });
  await fireInfo.click();
  await fireInfo.click();
  await fireInfo.click();

  const toasts = page.locator('[data-testid="toast-item"]');
  await expect(toasts).toHaveCount(3);
  await page.waitForTimeout(400);

  // DOM order matches insertion order; for a bottom anchor the LAST
  // inserted toast sits closest to the bottom edge (the smallest `top`,
  // i.e. highest on screen among the three -- no, largest `top`/lowest on
  // screen -- see the assertions below for the actual, verified direction)
  // and every earlier one stacks progressively ABOVE it.
  const viewportHeight = page.viewportSize()!.height;
  const yPositions = await toasts.evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
  const [yFirst, ySecond, yThird] = yPositions;

  // The bug this regresses: a positive (un-negated) offset would push
  // these below the viewport entirely instead of stacking upward.
  yPositions.forEach(y => expect(y).toBeLessThan(viewportHeight));
  // Third (most recent) is closest to the bottom edge; first (oldest) is
  // highest on screen -- each earlier toast has a SMALLER `top` than the
  // one added after it.
  expect(yFirst).toBeLessThan(ySecond);
  expect(ySecond).toBeLessThan(yThird);
});
