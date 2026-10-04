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

  // The nested-child guard (a bubbled animationend must not cut a row's entrance
  // animation short) is a unit test in DataTable.test.tsx. A real-browser version
  // raced WebKit delivering animationstart/animationend late and batched under
  // load, so no pause or listener could be placed in time (#802).
});
