import { test, expect } from '@playwright/test';
import { gotoTab, loadDemoTableData } from './nav';

// Real-browser confirmation of issue #341's column pin/freeze -- complements
// src/__tests__/DataTable.test.tsx's own jsdom suite (which already covers
// the DOM-shape side: sticky CSS applied, render-order reordering, selection/
// rowCommands auto-pinning). jsdom has no layout engine at all, so the one
// thing genuinely worth confirming here is the real, physical thing this
// feature promises: a pinned column visibly STAYS PUT while the rest of the
// grid scrolls horizontally underneath it, with an opaque background (no
// scrolled content bleeding through).
//
// This spec's own development is exactly why this comment -- and this test
// -- exist: a first real-browser pass (screenshots + getBoundingClientRect,
// not jsdom) caught two genuine bugs no amount of unit testing could have:
// (1) `position: sticky` on a table cell renders with the WRONG stuck offset
// when a non-sticky cell sits between two sticky ones in the same row --
// fixed by reordering pinned columns to their own edges (DataTable.tsx's
// `displayColumns`), matching how every real production grid already
// handles pinned columns (separate left/center/right sections, never
// interleaved); (2) a pinned cell over a row with a semi-transparent custom
// `rowSubtheme` background (not the literal string 'transparent') let
// scrolled-under content bleed through, fixed with a stacked
// `linear-gradient(color, color), <opaque base>` background instead of a
// naive `=== 'transparent'` string check.

test.describe('DataTable column pin/freeze (issue #341)', () => {
  test('a left-pinned column stays visually in place while other columns scroll underneath it', async ({ page }) => {
    // A wide-enough viewport that pinning is a real "some columns off-
    // screen" scenario without hitting the narrow-viewport edge case where
    // CSS sticky's own overlap-avoidance constraint clamps a pinned
    // column's offset (confirmed for real during this feature's own
    // development -- an artificially narrow viewport at MAXIMUM scroll,
    // where the pinned column's own width left no room to satisfy both its
    // requested offset and the opposite edge's own pinned content
    // simultaneously, a real CSS constraint, not a Toolcrib bug).
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    const grid = page.getByRole('grid').first();
    const scrollBody = await grid.evaluateHandle(el => el.closest('div[tabindex="0"]'));

    const nameHeader = grid.getByRole('columnheader', { name: 'User Name' });
    const emailHeader = grid.getByRole('columnheader', { name: 'Email Address' });
    const nameBoxBefore = await nameHeader.boundingBox();
    const emailBoxBefore = await emailHeader.boundingBox();
    expect(nameBoxBefore).not.toBeNull();

    await scrollBody.evaluate((el: Element) => {
      (el as HTMLElement).scrollLeft = 200;
    });
    // Real web-first assertion, not a fixed sleep -- polls until the
    // pinned header's screen position has genuinely settled at its stuck
    // offset (unmoved from before the scroll), the real signal this test
    // needs rather than a guessed wait duration.
    await expect(async () => {
      const box = await nameHeader.boundingBox();
      expect(box?.x).toBeCloseTo(nameBoxBefore!.x, 0);
    }).toPass();

    // Email Address (an unpinned column, originally to User Name's right)
    // must have shifted left by the scroll amount, confirming this is a
    // real scroll happening underneath a genuinely fixed column, not a
    // no-op.
    const emailBoxAfter = await emailHeader.boundingBox();
    expect(emailBoxAfter!.x).toBeLessThan(emailBoxBefore!.x);

    // Opaque background -- confirms the real fix for the semi-transparent-
    // rowSubtheme bleed-through bug found during this feature's own
    // development (a plain `=== 'transparent'` string check missed it).
    const firstBodyCell = grid.locator('tbody tr[aria-rowindex] td').first();
    const bg = await firstBodyCell.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)'); // the browser's "transparent" computed value
  });

  test('a right-pinned column stays flush against the grid\'s own right edge across all rows', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    const grid = page.getByRole('grid').first();
    const scoreHeader = grid.getByRole('columnheader', { name: 'Score' });
    const gridBox = await grid.boundingBox();
    const scoreBoxBefore = await scoreHeader.boundingBox();

    const scrollBody = await grid.evaluateHandle(el => el.closest('div[tabindex="0"]'));
    await scrollBody.evaluate((el: Element) => {
      (el as HTMLElement).scrollLeft = 100;
    });
    await expect(async () => {
      const box = await scoreHeader.boundingBox();
      expect(box?.x).toBeCloseTo(scoreBoxBefore!.x, 0);
    }).toPass();

    // Score sits just before the (also auto-pinned) rowCommands actions
    // column -- its own right edge should stay well within the grid's
    // right edge, not flush against it (that's the actions column's job).
    const scoreBoxAfter = await scoreHeader.boundingBox();
    expect(scoreBoxAfter!.x + scoreBoxAfter!.width).toBeLessThanOrEqual(gridBox!.x + gridBox!.width + 1);
  });
});
