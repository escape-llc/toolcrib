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

// Regression for a real bug found by frame-by-frame measurement, not by
// reading the code or by any of this file's own before/after position
// assertions above (which only ever check the SETTLED state, so they
// couldn't have caught this either): the shared .ai-focus-ring class
// (interactionStyles.ts) sets its own `transition` shorthand with
// `!important`. `transition` doesn't merge across rules -- the cascade
// picks ONE winning declaration for the whole property -- so without
// ALSO marking Toast's own `transition: transform ...` rule `!important`
// (and re-including outline-color's own transition, so winning that
// cascade doesn't cost the focus ring its fade), .ai-focus-ring's rule
// silently won outright and every stack-offset change applied with NO
// transition at all: an instant snap, not motion. jsdom cannot observe
// this at all (confirmed directly: getComputedStyle(el).transitionProperty
// on an injected-stylesheet attribute-selector rule comes back as the
// bare initial value 'all', not the real cascaded result) -- a real
// browser, sampling actual frames during the transition, is the only way
// to prove interpolation is happening rather than an instant jump.
test('a remaining toast\'s position actually interpolates across multiple frames when another toast is dismissed, not an instant snap', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Toast Subsystem');

  const fireInfo = page.getByRole('button', { name: 'Fire Info Toast', exact: true });
  await fireInfo.click();
  await fireInfo.click();
  await page.waitForTimeout(400);

  const toasts = page.locator('[data-testid="toast-item"]');
  await expect(toasts).toHaveCount(2);

  // Start sampling the SECOND toast's real position on every animation
  // frame before triggering the dismiss that moves it, so the sample
  // captures the actual transition instead of racing it.
  await page.evaluate(() => {
    window.__toastFrames = [];
    const el = document.querySelectorAll('[data-testid="toast-item"]')[1];
    let n = 0;
    const sample = () => {
      window.__toastFrames.push(el.getBoundingClientRect().top);
      if (n++ < 40) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await toasts.first().locator('button[aria-label="Dismiss toast"]').click();
  await page.waitForTimeout(500);

  const frames: number[] = await page.evaluate(() => window.__toastFrames);
  const firstY = frames[0];
  const lastY = frames[frames.length - 1];
  // A real move happened (the second toast slid up into the first's slot).
  expect(Math.abs(lastY - firstY)).toBeGreaterThan(10);

  // The bug this regresses: an instant snap means only ONE frame differs
  // from its neighbor by the full distance, with every other frame
  // reporting the pre- or post-snap value unchanged. Smooth interpolation
  // means MULTIPLE consecutive frames each differ from the previous by a
  // small fraction of the total distance -- count how many frame-to-frame
  // steps are "real but partial" (more than a rounding artifact, less
  // than 90% of the total distance covered in one step) as direct
  // evidence of actual interpolation, not a threshold this fix needs to
  // hit exactly.
  const totalDistance = Math.abs(lastY - firstY);
  let partialSteps = 0;
  for (let i = 1; i < frames.length; i++) {
    const step = Math.abs(frames[i] - frames[i - 1]);
    if (step > 0.3 && step < totalDistance * 0.9) partialSteps++;
  }
  expect(partialSteps).toBeGreaterThan(2);
});
