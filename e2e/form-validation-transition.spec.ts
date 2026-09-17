import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Real-browser confirmation for issue #503: validation error messages used
// to slam open/closed -- a plain conditional render with no transition at
// all. FormField/FormError now share a `grid-template-rows: 0fr -> 1fr`
// mechanism (the standard technique for animating to/from intrinsic height
// with no JS measurement).
//
// Asserts on the *inline authored* style (`el.style.gridTemplateRows`),
// not `getComputedStyle()` -- confirmed directly, not assumed: a real
// browser resolves an authored `1fr`/`0fr` grid-template-rows into its
// resolved pixel size once laid out (e.g. "20px"/"0px"), so
// `toHaveCSS('grid-template-rows', '1fr')` never matches in a real browser
// even when the mechanism is working correctly -- only jsdom (no real
// layout engine) echoes the literal authored string back, which is why
// this repo's own jsdom unit tests (Form.test.tsx) read `.style.
// gridTemplateRows` directly rather than a computed-style API. `expect.
// poll` here is the real-signal wait (retries until the authored value
// flips or times out), not a fixed sleep.

test('the error-region wrapper transitions grid-template-rows, swapping content without collapsing (helperText -> error)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Forms & Zod Engine');

  const usernameInput = page.getByPlaceholder('johndoe');
  await usernameInput.waitFor({ state: 'visible' });

  // Username's own FormField has helperText ("Unique username handle"),
  // already occupying the row at 1fr before any error -- confirms the
  // "swap content, no height jump" case, not just "grow from zero."
  // Located via the input's own next sibling (a stable structural
  // relationship) rather than by the helper text itself -- that text node
  // is REPLACED once the error appears, and Playwright locators re-
  // resolve lazily on every use, so a locator anchored to text that later
  // disappears goes stale mid-test (confirmed directly: the first attempt
  // at this test used exactly that anchor and timed out on the post-blur
  // poll for this reason).
  const errorWrapper = usernameInput.locator('xpath=following-sibling::div[1]');

  await expect(page.getByText('Unique username handle')).toBeVisible();
  await expect.poll(() => errorWrapper.evaluate(el => el.style.gridTemplateRows)).toBe('1fr');

  const { transitionProperty, transitionDuration } = await errorWrapper.evaluate(el => {
    const cs = getComputedStyle(el);
    return { transitionProperty: cs.transitionProperty, transitionDuration: cs.transitionDuration };
  });
  expect(transitionProperty.split(',').map(s => s.trim())).toContain('grid-template-rows');
  expect(transitionDuration.split(',').every(d => d !== '0s')).toBe(true);

  // Trigger a real error: onChange computes it, blur reveals it (same
  // established pattern as this repo's own unit tests -- blur alone,
  // with nothing ever computed, has no error to reveal).
  await usernameInput.fill('a');
  await usernameInput.blur();

  // .first() -- the demo's own live event-bus monitor panel also renders
  // this exact string, verbatim, inside a raw JSON debug dump; the real
  // error span (inside errorWrapper) is the first match in DOM order.
  await expect(page.getByText('Username must be at least 3 characters').first()).toBeVisible();
  // Still 1fr throughout -- confirms the swap never collapsed to 0fr and
  // back (which would read as a flash/flicker), it just swapped content
  // within an already-expanded row.
  await expect.poll(() => errorWrapper.evaluate(el => el.style.gridTemplateRows)).toBe('1fr');
});

test('the summary FormError banner starts genuinely zero-height and grows once a field is touched and invalid', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Forms & Zod Engine');

  const usernameInput = page.getByPlaceholder('johndoe');
  await usernameInput.waitFor({ state: 'visible' });

  const bannerText = page.getByText('Please correct the errors in the form before submitting.');
  const bannerWrapper = bannerText.locator('xpath=ancestor::div[2]');

  // Collapsed at mount -- confirms the always-rendered wrapper genuinely
  // starts at zero visible height, not just zero opacity (the banner text
  // node exists in the DOM per FormComponents.tsx's own design, but the
  // wrapper's real rendered height should still be ~0).
  await expect.poll(() => bannerWrapper.evaluate(el => el.style.gridTemplateRows)).toBe('0fr');
  const collapsedBox = await bannerWrapper.boundingBox();
  expect(collapsedBox?.height ?? 0).toBeLessThan(2);

  await usernameInput.fill('a');
  await usernameInput.blur();

  await expect.poll(() => bannerWrapper.evaluate(el => el.style.gridTemplateRows)).toBe('1fr');
  await expect(bannerText).toBeVisible();
  const expandedBox = await bannerWrapper.boundingBox();
  // >2, matching the collapsed-state threshold's own magnitude (not a
  // separately-guessed "should be a full line of text tall" number) --
  // the real point being verified is "grew from genuinely zero," not any
  // particular absolute size.
  expect(expandedBox?.height ?? 0).toBeGreaterThan(2);
});
