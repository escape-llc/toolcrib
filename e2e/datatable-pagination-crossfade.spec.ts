import { test, expect, type Page } from '@playwright/test';
import { gotoTab, loadDemoTableData } from './nav';

// Scoped to the DataTable's own Encyclopedia entry: since issue #624 every
// component shares one page, so page-wide getByRole('grid') / locator('table')
// / 'Next page' also match the inline Calendar's grid and the standalone
// Pagination demos.
const dataTable = (page: Page) => page.locator('#enc-DataTable');


// Real-browser confirmation for issue #517 (the pagination half of
// #499's own split): a page change used to snap the row set instantly,
// same as density used to. useRowSetCrossFade (src/components/DataTable/,
// generalized from useDensityCrossFade) clones the OUTGOING page's real
// rendered DOM as a static, inert overlay that fades out on top of the
// live table (which re-renders normally, immediately, with the new
// page's rows underneath) -- see that hook's own comment for the full
// approach.
//
// The one thing genuinely NEW for this trigger (density never remounts
// any row, since the same records/keys persist across a density change):
// the demo's own DataTable uses a real, data-derived `rowKey={rec =>
// rec.id}` -- a page change gives every row a different key, so React
// unmounts every old row and mounts new ones. If real keyboard focus was
// on one of them, this is a genuine, pre-existing (not introduced by
// this feature) focus-loss gap useRowSetCrossFade's own `onFocusLost`
// callback now closes by restoring focus to the same grid coordinate on
// the new page.

test.describe('DataTable pagination cross-fade (issue #517)', () => {
  test('a real transitionend removes the snapshot clone after a page change, leaving exactly one role="grid"', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    await expect(dataTable(page).getByRole('grid')).toHaveCount(1);

    const nextButton = dataTable(page).getByRole('button', { name: 'Next page' });
    await nextButton.click();

    await expect.poll(() => dataTable(page).locator('table').count()).toBe(1);
    await expect(dataTable(page).getByRole('grid')).toHaveCount(1);
  });

  test('the snapshot clone is inert while fading', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    // Slowed down first so there's a real window to catch the clone
    // mid-fade -- same established pattern as the density suite's own
    // identical need.
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--ai-transition-duration-normal', '1s');
    });

    await dataTable(page).getByRole('button', { name: 'Next page' }).click();

    const inertTable = dataTable(page).locator('table[inert]').first();
    await expect(inertTable).toHaveAttribute('aria-hidden', 'true');

    await page.evaluate(() => {
      document.documentElement.style.removeProperty('--ai-transition-duration-normal');
    });
  });

  // No "restores focus after a page change" test here -- confirmed
  // directly (not assumed) that it's structurally unreachable via a
  // real click, which is the ONLY way to trigger a page change in this
  // demo: a REAL browser click on ANY button (DataTable's own
  // Next-page, or an external consumer's own control, doesn't matter
  // which) moves real focus to that button as native default behavior
  // BEFORE React's own click handler/re-render even runs. By the time
  // useRowSetCrossFade's render-phase check reads
  // document.activeElement, focus has ALREADY, correctly, moved to the
  // clicked button -- exactly the "does not steal focus" case below,
  // not a restoration case. onFocusLost's own real, reachable trigger
  // is a `page` prop changing from something that ISN'T a click inside
  // this table's own UI (a URL/history sync, a live collaborative
  // update, a timer-driven auto-advance) -- covered directly at the
  // jsdom level instead (`DataTable.test.tsx`, via `fireEvent.click`,
  // which -- unlike a real browser -- does NOT also move real focus
  // first, so it correctly exercises the underlying restore logic
  // using a representative "the page changed" trigger). See
  // useRowSetCrossFade's own comment for the full account of this
  // real e2e-vs-jsdom discrepancy.

  test('does not steal focus onto the grid when the page change was triggered from outside it', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    const nextButton = dataTable(page).getByRole('button', { name: 'Next page' });
    await nextButton.focus();
    await expect(nextButton).toBeFocused();

    await nextButton.click();

    // NOT "the button specifically stays focused" -- confirmed directly
    // that assumption doesn't hold cross-browser: WebKit/Safari, unlike
    // Chromium, does not give a plain <button> focus on click by
    // default (a real, well-known, longstanding engine difference, not
    // a bug in either). The actual invariant this test cares about is
    // narrower and holds on both: restoreFocus's own guard must never
    // FORCE focus INTO the grid just because a page changed from
    // outside it -- wherever real focus actually lands after the click
    // (the button on Chromium, elsewhere on WebKit) is the browser's own
    // business, not this feature's.
    await expect.poll(() => dataTable(page).locator('table').count()).toBe(1);
    const focusInsideGrid = await page.evaluate(() => {
      const grid = document.querySelector('[role="grid"]');
      return !!grid && !!document.activeElement && grid.contains(document.activeElement);
    });
    expect(focusInsideGrid).toBe(false);
  });
});
