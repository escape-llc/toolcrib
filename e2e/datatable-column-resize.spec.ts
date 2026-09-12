import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Real-browser confirmation of issue #318's drag-to-resize columns --
// complements src/__tests__/DataTable.test.tsx's own jsdom suite (which
// already covers the underlying hook logic exhaustively via simulated
// mouse events on a mocked getBoundingClientRect) the same way
// datatable-grid-nav.spec.ts's own header comment already explains for
// #316: jsdom has no real layout engine, so the one thing genuinely worth
// re-confirming here is that a real pointer drag actually resizes the
// column end to end in a real browser.
//
// demo/App.tsx's "User Name" and "Email Address" columns are the two
// marked `resizable: true` for this table -- located via the <th> that
// CONTAINS each column's own sort button (scoped with `has:`) rather than
// by accessible name/data-grid-row/col directly, since a sortable
// column's own <th> carries neither (see useTableKeyboardNav's "cell
// contains one widget" comment -- the sort <button> is the real grid-nav
// target, not the <th> itself), and the resize handle is deliberately NOT
// part of that roving-tabindex coordinate model either (see
// useTableColumnResize's own header comment), so it carries no
// data-grid-row/col of its own to query by.
//
// These tests only ever touch the header row (sortable buttons, resize
// handles), which renders from `columns` regardless of whether any data
// has been loaded -- the table starts empty (see demo/App.tsx's own
// comment) and the resize handle doesn't need real rows, so no
// loadDemoTableData() call is needed here the way datatable-grid-nav.spec.ts
// needs one for its own body-row assertions.

test.describe('DataTable column resize (issue #318)', () => {
  test('a resizable column exposes a real WAI-ARIA separator handle, confirmed against the W3C APG Window Splitter pattern', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');

    const mainGrid = page.getByRole('grid').first();
    const nameHeader = mainGrid.locator('th').filter({ has: page.getByRole('button', { name: 'User Name' }) });
    const handle = nameHeader.getByRole('separator');
    await expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    await expect(handle).toHaveAttribute('aria-valuemin', '40');
    await expect(handle).toHaveAttribute('tabindex', '0');
  });

  test('a non-resizable column has no separator handle', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');

    // "Role Level" is sortable but not marked resizable in demo/App.tsx.
    const mainGrid = page.getByRole('grid').first();
    const roleHeader = mainGrid.locator('th').filter({ has: page.getByRole('button', { name: 'Role Level' }) });
    await expect(roleHeader.getByRole('separator')).toHaveCount(0);
  });

  test('dragging the handle resizes the column in a real browser', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');

    const mainGrid = page.getByRole('grid').first();
    const nameHeader = mainGrid.locator('th').filter({ has: page.getByRole('button', { name: 'User Name' }) });
    const handle = nameHeader.getByRole('separator');

    const before = await nameHeader.boundingBox();
    expect(before).not.toBeNull();

    // .hover(), not a raw boundingBox()-computed page.mouse.move() -- found
    // for real while writing this test: a manually-computed center point
    // (even after scrollIntoViewIfNeeded()) landed on a DIFFERENT card's
    // header a few pixels away, confirmed via document.elementFromPoint(),
    // because a plain boundingBox() call doesn't wait for the same
    // actionability/stability guarantees a real interaction (.hover(),
    // .click()) does. .hover() moves the real mouse to the actual
    // resolved, stable position of this exact element.
    await handle.hover();
    const handleBox = await handle.boundingBox();
    expect(handleBox).not.toBeNull();

    await page.mouse.down();
    await page.mouse.move(handleBox!.x + 80, handleBox!.y + handleBox!.height / 2, { steps: 5 });
    await page.mouse.up();

    // Auto-retrying poll, not a one-shot boundingBox() snapshot -- the
    // resized width only lands in the DOM once the commit-on-release
    // setState/re-render cycle actually completes, same reasoning as
    // datatable-grid-nav.spec.ts's own toBeFocused() polling for its
    // scroll-then-focus path.
    await expect.poll(async () => (await nameHeader.boundingBox())?.width ?? 0).toBeGreaterThan(before!.width + 60);
  });

  test('Arrow keys resize the focused handle; Home/End jump to the min/max bounds', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');

    const mainGrid = page.getByRole('grid').first();
    const emailHeader = mainGrid.locator('th').filter({ has: page.getByRole('button', { name: 'Email Address' }) });
    const handle = emailHeader.getByRole('separator');
    await handle.focus();

    const before = (await emailHeader.boundingBox())!.width;

    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await emailHeader.boundingBox())?.width ?? 0).toBeGreaterThan(before + 5);

    await page.keyboard.press('Home');
    await expect(handle).toHaveAttribute('aria-valuenow', '40');
    await expect.poll(async () => (await emailHeader.boundingBox())?.width ?? 0).toBeLessThan(before);
  });
});
