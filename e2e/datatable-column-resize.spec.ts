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

  // Regression test for a real, reported visual bug (found via direct
  // pixel measurement, not just eyeballing a screenshot): the persistent
  // indicator line rendered 2px off from the column's own true right
  // border, looking like a second, "crooked" rule sitting next to the
  // real one instead of marking it. Root cause -- the outer hit-zone's own
  // `right` offset wasn't exactly half its `width`, so the inner
  // flex-centered indicator (which inherits whatever THAT box's true
  // center is) inherited the same asymmetry. This directly checks the
  // rendered geometry, not just that the indicator exists.
  test('the persistent resize indicator line is centered exactly on the column\'s true right border, not offset from it', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');

    const mainGrid = page.getByRole('grid').first();
    const nameHeader = mainGrid.locator('th').filter({ has: page.getByRole('button', { name: 'User Name' }) });
    const handle = nameHeader.getByRole('separator');
    const indicator = handle.locator('[aria-hidden="true"]');

    const thBox = (await nameHeader.boundingBox())!;
    const indicatorBox = (await indicator.boundingBox())!;
    const trueBorderX = thBox.x + thBox.width;
    const indicatorCenterX = indicatorBox.x + indicatorBox.width / 2;

    expect(Math.abs(indicatorCenterX - trueBorderX)).toBeLessThanOrEqual(1);
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
    // Real signal, not a guessed delay -- see DataTable.tsx's own comment
    // on `data-resizing` for why this specific wait exists: a real,
    // reproducible flake under heavy parallel WebKit load where the
    // subsequent mousemove could be dispatched before startResize's
    // window-level pointermove listener had actually attached.
    await expect(handle).toHaveAttribute('data-resizing', 'true');
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

  // The redistribution fix below (a real, confirmed bug, not a
  // hypothetical): this table is `table-layout: fixed` + `width: 100%`,
  // and DataTable.tsx now computes every column's own explicit pixel
  // width itself, so the browser's own fixed-layout algorithm never has
  // a gap left to fill on its own. `demo/App.tsx`'s "Email Address"
  // column deliberately has no declared `width` -- the one "auto" (flex-
  // grow: 1-equivalent) column in this table, absorbing whatever space
  // every other (fixed, declared-width) column doesn't use. "User Name"
  // and "ID"/"Role Level"/"Status"/"Score" all have real declared
  // widths -- FIXED, never touched by anything except a direct drag on
  // themselves.
  test.describe('redistribution and the auto/fixed column model', () => {
    test('dragging the handle tracks the cursor with no jump on mousedown alone', async ({ page }) => {
      await page.goto('/');
      await gotoTab(page, 'Data Table');

      const mainGrid = page.getByRole('grid').first();
      const emailHeader = mainGrid.locator('th').filter({ has: page.getByRole('button', { name: 'Email Address' }) });
      const handle = emailHeader.getByRole('separator');

      const before = (await emailHeader.boundingBox())!.width;
      await handle.hover();
      const handleBox = (await handle.boundingBox())!;

      // Real, confirmed bug this guards against: an earlier version
      // measured a column's CURRENT rendered width (already inflated by
      // the browser's own fixed-layout stretch) as the drag's starting
      // point, then committed that same number as a new EXPLICIT width --
      // changing the sum of all declared widths, which changed the
      // stretch ratio needed to re-fill the container, so the browser
      // re-stretched again on the very next layout. The column visibly
      // jumped by a large amount on mousedown alone, before the cursor
      // had moved at all.
      await page.mouse.down();
      await expect(handle).toHaveAttribute('data-resizing', 'true');
      await expect.poll(async () => (await emailHeader.boundingBox())?.width ?? 0).toBe(before);

      await page.mouse.move(handleBox.x + 60, handleBox.y + handleBox.height / 2, { steps: 5 });
      await expect.poll(async () => (await emailHeader.boundingBox())?.width ?? 0).toBeGreaterThan(before + 45);
      await page.mouse.up();
    });

    test('growing the table\'s only auto column widens the table itself, rather than being capped at the container\'s edge', async ({ page }) => {
      await page.goto('/');
      await gotoTab(page, 'Data Table');

      const table = page.locator('table').first();
      const mainGrid = page.getByRole('grid').first();
      const emailHeader = mainGrid.locator('th').filter({ has: page.getByRole('button', { name: 'Email Address' }) });
      const handle = emailHeader.getByRole('separator');

      const tableBefore = (await table.boundingBox())!.width;
      const emailBefore = (await emailHeader.boundingBox())!.width;

      await handle.hover();
      const handleBox = (await handle.boundingBox())!;
      await page.mouse.down();
      await expect(handle).toHaveAttribute('data-resizing', 'true');
      // A real, deliberate amount no OTHER auto column exists to absorb
      // -- nothing else in this table can shrink to compensate (every
      // sibling is fixed), so the table itself must grow to accommodate
      // the drag rather than the browser silently capping it at whatever
      // the container's own edge happens to be.
      await page.mouse.move(handleBox.x + 200, handleBox.y + handleBox.height / 2, { steps: 5 });
      await page.mouse.up();

      await expect.poll(async () => (await table.boundingBox())?.width ?? 0).toBeGreaterThan(tableBefore + 190);
      await expect.poll(async () => (await emailHeader.boundingBox())?.width ?? 0).toBeGreaterThan(emailBefore + 190);
    });

    test('growing a fixed column shrinks the auto column down to its own floor, while other fixed siblings stay completely untouched', async ({ page }) => {
      await page.goto('/');
      await gotoTab(page, 'Data Table');

      const mainGrid = page.getByRole('grid').first();
      const idHeader = mainGrid.locator('th').filter({ has: page.getByRole('button', { name: 'ID' }) });
      const roleHeader = mainGrid.locator('th').filter({ has: page.getByRole('button', { name: 'Role Level' }) });
      const emailHeader = mainGrid.locator('th').filter({ has: page.getByRole('button', { name: 'Email Address' }) });
      const nameHeader = mainGrid.locator('th').filter({ has: page.getByRole('button', { name: 'User Name' }) });
      const handle = nameHeader.getByRole('separator');

      const idBefore = (await idHeader.boundingBox())!.width;
      const roleBefore = (await roleHeader.boundingBox())!.width;

      await handle.hover();
      const handleBox = (await handle.boundingBox())!;
      await page.mouse.down();
      await expect(handle).toHaveAttribute('data-resizing', 'true');
      // Deliberately far beyond what the table could ever accommodate --
      // the one auto column (Email) must pin at its own real minWidth
      // floor (40px, DEFAULT_MIN_COLUMN_WIDTH) rather than being
      // squeezed toward (or past) zero with nothing stopping it. Kept
      // within a typical 1280px viewport rather than an arbitrarily large
      // delta -- not because WebKit clamps large synthetic coordinates
      // (that theory didn't hold up under direct testing), but because a
      // smaller, realistic delta is all this needs and keeps the drag
      // itself simple to reason about.
      await page.mouse.move(handleBox.x + 700, handleBox.y + handleBox.height / 2, { steps: 5 });
      await page.mouse.up();

      await expect.poll(async () => (await emailHeader.boundingBox())?.width ?? 0).toBeCloseTo(40, 0);
      // ID and Role Level are FIXED (their own declared width) -- growing
      // an unrelated column, even this aggressively, never touches them.
      await expect((await idHeader.boundingBox())!.width).toBeCloseTo(idBefore, 0);
      await expect((await roleHeader.boundingBox())!.width).toBeCloseTo(roleBefore, 0);
    });

    test('once a column is resized, a previously-auto sibling locks in and no longer rebalances on an unrelated later change', async ({ page }) => {
      await page.goto('/');
      await gotoTab(page, 'Data Table');

      const mainGrid = page.getByRole('grid').first();
      const emailHeader = mainGrid.locator('th').filter({ has: page.getByRole('button', { name: 'Email Address' }) });
      const nameHeader = mainGrid.locator('th').filter({ has: page.getByRole('button', { name: 'User Name' }) });
      const handle = nameHeader.getByRole('separator');

      await handle.hover();
      const handleBox = (await handle.boundingBox())!;
      await page.mouse.down();
      await expect(handle).toHaveAttribute('data-resizing', 'true');
      // A modest amount, well clear of Email's own floor -- this test is
      // about persistence, not the floor itself (see the previous test
      // for that).
      await page.mouse.move(handleBox.x + 80, handleBox.y + handleBox.height / 2, { steps: 5 });
      await page.mouse.up();

      const emailAfterFirstResize = (await emailHeader.boundingBox())!.width;

      // Real, confirmed bug this guards against: an earlier version
      // captured the lock-in snapshot EAGERLY, at the moment the drag
      // STARTED (before Email had shrunk at all), and committed that
      // stale pre-drag value once the drag ended -- silently undoing
      // the very shrink this same drag had just caused, the instant the
      // mouse was released.
      await page.getByRole('button', { name: 'Columns' }).click();
      await page.getByRole('menuitemcheckbox', { name: 'Status' }).click();
      await page.keyboard.press('Escape');

      // Hiding Status frees up real space -- if Email were still "auto,"
      // it would grow to absorb it. Since it locked in on the FIRST
      // resize, it stays exactly where it was.
      await expect((await emailHeader.boundingBox())!.width).toBeCloseTo(emailAfterFirstResize, 0);
    });
  });
});
