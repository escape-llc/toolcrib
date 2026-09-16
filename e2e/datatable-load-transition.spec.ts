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

    // Two "Load Data" buttons exist (the toolbar's own reload button, and
    // the empty state's own dedicated action) -- the empty-state one is
    // the actual repro (clicking FROM the empty view).
    await page.getByRole('button', { name: '📥 Load Data' }).click();
    await expect(page.getByRole('grid').first()).toBeVisible();

    // Wait for the animation to actually finish (a real completion
    // signal, not a guessed timeout) before asserting on it.
    await expect.poll(() => animationEvents.filter(e => e.startsWith('end:')).length).toBeGreaterThan(0);
    expect(animationEvents.some(e => e === 'start:ai-fade-in')).toBe(true);
    expect(animationEvents.some(e => e === 'end:ai-fade-in')).toBe(true);

    // Reload (already populated -- not a transition) must not replay it.
    animationEvents.length = 0;
    await page.getByRole('button', { name: '🔄 Reload Data' }).click();
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
    // Slow the real animation down first (via the Theme Editor's own
    // --ai-transition-duration-normal control isn't available headlessly
    // here, so this pauses CSS animations/transitions globally at the
    // page level instead) so the fake bubbled event below is GUARANTEED
    // to land while the real row-level animation is still active --
    // without this, the real ~200ms animation can already finish (and
    // legitimately clear justLeftEmptyState on its own) before this test
    // ever gets to dispatch its fake event, making the assertion pass for
    // the wrong reason regardless of whether the guard exists. Confirmed
    // directly: this exact test PASSED even with the guard removed,
    // before this pause was added -- a real, caught false positive.
    await page.addStyleTag({ content: '* { animation-play-state: paused !important; }' });

    await page.goto('/');
    await gotoTab(page, 'Data Table');

    await page.getByRole('button', { name: '📥 Load Data' }).click();
    await expect(page.getByRole('grid').first()).toBeVisible();

    // Dispatch a fake, bubbling animationend from a real child element
    // (a row-command action button) inside the first row, simulating an
    // unrelated nested animation finishing WHILE the row's own real
    // ai-fade-in is still (paused, so definitely still) playing.
    const result = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr[aria-rowindex]')) as HTMLElement[];
      const row = rows.find(r => r.style.animation)!;
      const child = row.querySelector('button, span, div') as HTMLElement;
      const before = row.style.animation;
      child.dispatchEvent(new AnimationEvent('animationend', { bubbles: true, animationName: 'not-the-real-one' }));
      // React's own state update from the dispatched event is processed
      // asynchronously relative to this synchronous script -- give it a
      // real frame to actually commit before reading the DOM again.
      return new Promise<{ before: string; after: string }>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve({ before, after: row.style.animation })));
      });
    });
    // If the guard is missing, the bubbled event would have cleared
    // justLeftEmptyState synchronously, removing the animation before it
    // was actually (and, here, provably still) playing.
    expect(result.before).toContain('ai-fade-in');
    expect(result.after).toContain('ai-fade-in');
  });
});
