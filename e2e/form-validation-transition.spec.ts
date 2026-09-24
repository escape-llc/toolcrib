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
  // Located via FormComponents.tsx's own `data-testid` hook (a real,
  // named DOM attribute, immune to markup shape changes), not by the
  // helper text itself -- that text node is REPLACED once the error
  // appears, and Playwright locators re-resolve lazily on every use, so
  // a locator anchored to text that later disappears goes stale mid-test
  // (confirmed directly: the first attempt at this test used exactly
  // that anchor and timed out on the post-blur poll for this reason).
  // Previously an XPath sibling relationship
  // (`usernameInput.locator('xpath=following-sibling::div[1]')`) --
  // fragile the moment FormField's own markup shape changes; the
  // data-testid is what that fragility was meant to be replaced with.
  const errorWrapper = page.getByTestId('form-field-error-region-username');

  await expect(page.getByText('Unique username handle')).toBeVisible();
  await expect.poll(() => errorWrapper.evaluate(el => el.style.gridTemplateRows)).toBe('1fr');

  const { transitionProperty, transitionDuration, visibility } = await errorWrapper.evaluate(el => {
    const cs = getComputedStyle(el);
    return { transitionProperty: cs.transitionProperty, transitionDuration: cs.transitionDuration, visibility: cs.visibility };
  });
  expect(transitionProperty.split(',').map(s => s.trim())).toContain('grid-template-rows');
  expect(transitionDuration.split(',').every(d => d !== '0s')).toBe(true);
  // Real-browser confirmation for a follow-up Gemini finding on the same
  // PR: an already-expanded row (helperText occupying it before any error)
  // must read as 'visible', not just be laid out at non-zero height --
  // visibility is the property that actually keeps content out of a
  // browser's native "Find on Page" once collapsed, which neither
  // aria-hidden nor overflow:hidden affects on their own.
  expect(visibility).toBe('visible');

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
  // FormComponents.tsx's own `data-testid` hook, not an XPath ancestor
  // relationship -- only one summary banner exists per form, so a bare
  // shared id (unlike the per-field named variants) is unambiguous here.
  const bannerWrapper = page.getByTestId('form-error-summary-region');

  // Collapsed at mount -- confirms the always-rendered wrapper genuinely
  // starts at zero visible height, not just zero opacity (the banner text
  // node exists in the DOM per FormComponents.tsx's own design, but the
  // wrapper's real rendered height should still be ~0).
  await expect.poll(() => bannerWrapper.evaluate(el => el.style.gridTemplateRows)).toBe('0fr');
  const collapsedBox = await bannerWrapper.boundingBox();
  expect(collapsedBox?.height ?? 0).toBeLessThan(2);
  // Load-bearing regression, not defense-in-depth: this banner's text is
  // a *static* string always in the DOM regardless of hasErrors, so
  // `visibility: hidden` is what actually keeps a browser's native "Find
  // on Page" (Ctrl+F) from matching and scrolling to it while collapsed --
  // aria-hidden and overflow:hidden don't affect that on their own (a
  // follow-up finding, Gemini, PR #506, on top of the original aria-hidden
  // fix from the same review).
  await expect.poll(() => bannerWrapper.evaluate(el => getComputedStyle(el).visibility)).toBe('hidden');

  await usernameInput.fill('a');
  await usernameInput.blur();

  await expect.poll(() => bannerWrapper.evaluate(el => el.style.gridTemplateRows)).toBe('1fr');
  await expect(bannerText).toBeVisible();
  await expect.poll(() => bannerWrapper.evaluate(el => getComputedStyle(el).visibility)).toBe('visible');
  const expandedBox = await bannerWrapper.boundingBox();
  // >2, matching the collapsed-state threshold's own magnitude (not a
  // separately-guessed "should be a full line of text tall" number) --
  // the real point being verified is "grew from genuinely zero," not any
  // particular absolute size.
  expect(expandedBox?.height ?? 0).toBeGreaterThan(2);
});

// Real-browser confirmation for issue #507: a plain `{condition &&
// <span>...}` used to unmount the error text the instant the underlying
// condition went false -- before the wrapper's own grid-template-rows
// collapse transition had actually run, so the collapse animated an
// already-empty region instead of the text visibly sliding away with it.
// useDeferredCollapseContent (FormComponents.tsx) now holds the last-
// shown text through the real transition, clearing it only once a real
// `transitionend` fires for the wrapper's own `grid-template-rows`.
//
// Uses the Email field specifically, not Username -- Username always has
// helperText ("Unique username handle") backing it up, so clearing its
// error only ever SWAPS content within an already-expanded row (see the
// first test in this file); Email has no helperText, so clearing its
// error is the real full-collapse case this fix targets.
test('the error region keeps the error text rendered through the full collapse, not unmounted the instant it clears (issue #507)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Forms & Zod Engine');

  const emailInput = page.getByPlaceholder('john@example.com');
  await emailInput.waitFor({ state: 'visible' });

  // Locate the real wrapper via FormComponents.tsx's own `data-testid`
  // hook (matching this file's other two tests, above), not by the error
  // text itself -- the demo's own live event-bus debug panel separately
  // renders this exact string verbatim inside a raw JSON dump elsewhere
  // on the page, a known duplicate-text footgun.
  const errorWrapper = page.getByTestId('form-field-error-region-email');

  // Attached BEFORE the first interaction, as a running count rather than
  // a one-shot boolean -- BOTH the initial expand (error first appearing)
  // and the later collapse (this test's real target) fire their own
  // grid-template-rows transitionend on this same wrapper. A boolean
  // would be satisfied by the first, unrelated one; the count lets each
  // phase below wait for its own specific occurrence.
  //
  // The actual "stayed attached through the collapse" claim is recorded
  // as `data-*` attributes on the element itself, written by a
  // MutationObserver INSIDE the browser -- not via a separate Playwright
  // `toBeAttached()` check issued after polling for `gridTemplateRows
  // === '0fr'`. That sequential-round-trip version (each
  // `expect.poll`/assertion is its own CDP round trip) was a real,
  // confirmed flake under full-suite load, webkit specifically: the
  // authored inline style flips to '0fr' synchronously the instant React
  // re-renders, but the REAL CSS transition (and therefore the held
  // text's own removal on transitionend) runs independently on the
  // browser's own clock. Under heavy CPU contention from the other
  // parallel workers, the gap between "Node observes 0fr" and "Node's
  // next command actually runs" can exceed the transition's own
  // duration, so the text was already gone by the time the "still
  // attached" check fired -- not a component bug, a race in how the test
  // was OBSERVING it. If the transition leaves real evidence behind IN
  // THE DOM the instant it happens, timing stops mattering: the
  // attribute is written exactly once, exactly when the DOM actually
  // changes, and reading it afterward -- whenever Node/Playwright
  // happens to get around to it -- always sees the same, already-settled
  // answer.
  await errorWrapper.evaluate(el => {
    el.dataset.transitionendCount = '0';
    el.dataset.textRemovedEarly = 'false';
    el.addEventListener('transitionend', (e: TransitionEvent) => {
      if (e.propertyName === 'grid-template-rows') {
        el.dataset.transitionendCount = String(Number(el.dataset.transitionendCount) + 1);
      }
    });
    // Fires synchronously whenever the DOM actually changes -- the
    // transitionend listener above updates this SAME element's own
    // dataset, so there's no cross-context ordering concern with what
    // this observer reads.
    new MutationObserver(() => {
      const stillHeld = el.textContent?.includes('Please enter a valid email address') ?? false;
      if (!stillHeld && Number(el.dataset.transitionendCount) < 2) {
        el.dataset.textRemovedEarly = 'true';
      }
    }).observe(el, { childList: true, subtree: true, characterData: true });
  });

  await emailInput.fill('not-an-email');
  await emailInput.blur();

  await expect.poll(() => errorWrapper.evaluate(el => el.style.gridTemplateRows)).toBe('1fr');
  await expect(errorWrapper.getByText('Please enter a valid email address')).toBeAttached();
  // Wait for the EXPAND's own transitionend before moving on, or the
  // still-in-flight event could be misattributed to the collapse below.
  await expect.poll(() => errorWrapper.getAttribute('data-transitionend-count')).toBe('1');

  await emailInput.fill('john@example.com');
  await emailInput.blur();

  // Wait for the collapse to genuinely finish (real state driving the
  // real transition) -- once transitionend has fired for it, the
  // MutationObserver above has already recorded, as a real DOM
  // attribute, whether the text was ever removed before this point.
  await expect.poll(() => errorWrapper.getAttribute('data-transitionend-count')).toBe('2');
  expect(
    await errorWrapper.getAttribute('data-text-removed-early'),
    'held error text was removed before the collapse transition actually finished'
  ).toBe('false');
  await expect(errorWrapper.getByText('Please enter a valid email address')).not.toBeAttached();
});
