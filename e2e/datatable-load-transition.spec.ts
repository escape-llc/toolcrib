import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Real-browser confirmation that clicking "Load Data" from the empty view
// actually transitions the real row set in (issue reported directly:
// "there is no transition to the grid, it just slams"). Complements
// src/__tests__/DataTable.test.tsx's own jsdom suite, which can only assert
// the animation is APPLIED on the transitioning render -- jsdom cannot
// reliably deliver a real animationend event through to React's own
// onAnimationEnd handler (confirmed directly, not assumed), so the
// reset-after-the-real-animation-completes half of this behavior, and
// that virtualized scrolling never replays it, can only be verified here.

test.describe('DataTable empty->populated load transition', () => {
  test('a real ai-fade-in animation plays on the rows when Load Data is clicked, and never replays on reload or scroll', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');

    const animationEvents: string[] = [];
    await page.exposeFunction('reportAnimEvent', (msg: string) => animationEvents.push(msg));
    await page.evaluate(() => {
      document.addEventListener('animationstart', e => {
        if ((e.target as HTMLElement).tagName === 'TR') (window as any).reportAnimEvent(`start:${e.animationName}`);
      });
      document.addEventListener('animationend', e => {
        if ((e.target as HTMLElement).tagName === 'TR') (window as any).reportAnimEvent(`end:${e.animationName}`);
      });
    });

    // Two buttons exist while the table is empty: the toolbar's own
    // persistent reload button (icon-only, always named "Reload Data" --
    // issue #591 follow-up) and the empty state's own dedicated "Load
    // Data" action -- the empty-state one is the actual repro (clicking
    // FROM the empty view). Distinct names now, so an exact match is
    // unambiguous without needing either button's own icon/emoji as a
    // disambiguator.
    await page.getByRole('button', { name: 'Load Data', exact: true }).click();
    await expect(page.getByRole('grid').first()).toBeVisible();

    // Wait for the animation to actually finish (a real completion
    // signal, not a guessed timeout) before asserting on it.
    await expect.poll(() => animationEvents.filter(e => e.startsWith('end:')).length).toBeGreaterThan(0);
    expect(animationEvents.some(e => e === 'start:ai-fade-in')).toBe(true);
    expect(animationEvents.some(e => e === 'end:ai-fade-in')).toBe(true);

    // Reload (already populated -- not a transition) must not replay it.
    animationEvents.length = 0;
    await page.getByRole('button', { name: 'Reload Data' }).click();
    await page.waitForTimeout(300);
    expect(animationEvents).toEqual([]);

    // Ordinary virtualized scrolling must not trigger it either.
    animationEvents.length = 0;
    const scrollBody = page.locator('[role="grid"]').first().locator('xpath=..');
    await scrollBody.evaluate(el => { el.scrollTop = 2000; });
    await page.waitForTimeout(300);
    expect(animationEvents).toEqual([]);
  });

  // Regression, per an external review: onAnimationEnd bubbles the same
  // way the native DOM event does, and a column's `render` is fully
  // consumer-controlled -- nothing stops a consumer from putting their
  // own animated content (a Spinner, a pulsing Badge, anything with a
  // real CSS `animation`) inside a cell. A handler that doesn't check
  // `e.target === e.currentTarget` would have a NESTED child's own
  // animationend prematurely reset justLeftEmptyState, cutting the row's
  // own entrance animation short. Simulates that exact shape directly:
  // dispatch a real, bubbling `animationend` from a child element deep
  // inside a row WHILE the row's own real animation is still playing, and
  // confirm the row's own animation is NOT cut short by it.
  test('a bubbled animationend from a nested child does not cut the row entrance animation short', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');

    // Armed BEFORE the click that mounts the rows -- animationstart fires
    // essentially immediately once a row mounts, so attaching this
    // listener afterward risks missing it entirely (the promise below
    // would then never resolve). Stashed on window rather than returned
    // directly from this evaluate() call, so it can be awaited separately
    // after confirming the grid actually rendered.
    await page.evaluate(() => {
      (window as any).__rowAnimResult = new Promise<{ before: string; after: string }>((resolve, reject) => {
        document.addEventListener('animationstart', function handler(e) {
          const row = e.target as HTMLElement;
          if (row.tagName !== 'TR') return;
          document.removeEventListener('animationstart', handler);

          // Dispatch the fake, bubbling animationend SYNCHRONOUSLY from
          // inside the row's own real animationstart handler -- guarantees
          // the fake event lands while the real animation is provably
          // still active, with no dependency on any pause mechanism at
          // all.
          //
          // The original version of this test instead paused ALL CSS
          // animations globally first (`* { animation-play-state: paused
          // !important; }`) to buy enough time to dispatch the fake event
          // afterward -- reliable on Chromium, but a real, confirmed
          // source of flakiness on WebKit: that pause did not reliably
          // freeze the row's real entrance animation there (root cause
          // not fully pinned down -- a WebKit-specific
          // `animation-play-state` quirk is the leading candidate, per
          // issue #500's own investigation), so the real animation could
          // still complete on its own before the fake event was
          // dispatched, clearing justLeftEmptyState via the legitimate
          // path and making the "after" check empty for a reason that has
          // nothing to do with the guard this test exists to verify -- a
          // real, not merely theoretical, false-failure mode, not the
          // guard actually breaking.
          //
          // Listening for the real animationstart event sidesteps the
          // whole class of "did the pause actually take effect" question:
          // there's nothing left to race, since the fake event fires
          // inside the exact callback that fires the instant the real one
          // begins.
          // Caught in review (Gemini, PR #508): an unhandled exception
          // thrown inside this listener (e.g. a null `child`, from some
          // future unexpected DOM shape) would abort the callback before
          // resolve() ever runs -- the outer __rowAnimResult promise then
          // stays pending forever, and the test hangs to its full timeout
          // with no indication of what actually went wrong. reject(),
          // not just a thrown error, is what makes that failure surface
          // immediately with a clear message instead of a silent hang.
          const child = row.querySelector('button, span, div') as HTMLElement | null;
          if (!child) {
            reject(new Error('no button/span/div child found inside the entrance-animating row -- cannot dispatch the fake bubbled animationend'));
            return;
          }
          const before = row.style.animation;
          child.dispatchEvent(new AnimationEvent('animationend', { bubbles: true, animationName: 'not-the-real-one' }));
          // React's own state update from the dispatched event is
          // processed asynchronously relative to this synchronous
          // handler -- give it a real frame to actually commit before
          // reading the DOM again.
          requestAnimationFrame(() => requestAnimationFrame(() => resolve({ before, after: row.style.animation })));
        });
      });
    });

    await page.getByRole('button', { name: 'Load Data', exact: true }).click();
    await expect(page.getByRole('grid').first()).toBeVisible();

    const result = await page.evaluate(() => (window as any).__rowAnimResult);
    // If the guard is missing, the bubbled event would have cleared
    // justLeftEmptyState synchronously, removing the animation before it
    // was actually (and, here, provably still) playing.
    expect(result.before).toContain('ai-fade-in');
    expect(result.after).toContain('ai-fade-in');
  });
});
