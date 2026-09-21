import { test, expect } from '@playwright/test';
import { gotoTab, loadDemoTableData } from './nav';

// Real-browser confirmation of issue #340's column show/hide -- complements
// src/__tests__/DataTable.test.tsx's own jsdom suite (which already covers
// the controlled/uncontrolled state, the event payload, and the CSV-export
// interaction exhaustively). The one thing genuinely worth re-confirming
// here is that unchecking a real menu item actually removes a real column
// from the real rendered grid, and that the menu itself opens/behaves
// correctly in a real browser (jsdom's Radix DropdownMenu quirks -- opens on
// pointerdown, background aria-hidden while open -- are themselves jsdom
// artifacts, not necessarily proof of real-browser behavior).
//
// "Role Level" (below), not "User Name" -- User Name is pinned-left in
// demo/App.tsx, and pinned columns are deliberately excluded from this
// menu entirely (see the dedicated test further down for that exact
// behavior) -- an earlier version of this test used User Name and started
// failing the moment that exclusion shipped, which is exactly the kind of
// real-browser drift a jsdom-only suite wouldn't have caught on its own.

test.describe('DataTable column show/hide (issue #340)', () => {
  test('unchecking a column in the Columns menu removes it from the real grid, re-checking brings it back', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    const grid = page.getByRole('grid').first();
    await expect(grid.getByRole('columnheader', { name: 'Role Level' })).toBeVisible();

    await page.getByRole('button', { name: 'Columns' }).click();
    const roleItem = page.getByRole('menuitemcheckbox', { name: 'Role Level' });
    await expect(roleItem).toHaveAttribute('aria-checked', 'true');
    await roleItem.click();
    await page.keyboard.press('Escape');

    await expect(grid.getByRole('columnheader', { name: 'Role Level' })).not.toBeVisible();
    // A different column is unaffected.
    await expect(grid.getByRole('columnheader', { name: 'Email Address' })).toBeVisible();

    await page.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Role Level' }).click();
    await page.keyboard.press('Escape');
    await expect(grid.getByRole('columnheader', { name: 'Role Level' })).toBeVisible();
  });

  test('a pinned column is not offered in the Columns menu at all', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    // Reported directly: pinning exists specifically to keep a column
    // always visible while the rest scrolls underneath it, so offering
    // it in a hide/show list at all would contradict why it's pinned --
    // and doing so once caused a real, separate bug (a hidden-then-
    // reshown pinned column reappeared at a different position than
    // this menu's own listed order implied).
    await page.getByRole('button', { name: 'Columns' }).click();
    // User Name (pinned: 'left') and Score (pinned: 'right') both absent.
    await expect(page.getByRole('menuitemcheckbox', { name: 'User Name' })).toHaveCount(0);
    await expect(page.getByRole('menuitemcheckbox', { name: 'Score' })).toHaveCount(0);
    // Every unpinned column, plus the rowCommands actions column, is
    // still offered.
    await expect(page.getByRole('menuitemcheckbox', { name: 'ID' })).toBeVisible();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Email Address' })).toBeVisible();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Role Level' })).toBeVisible();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Actions' })).toBeVisible();

    // Close the menu first -- Radix's DropdownMenu applies aria-hidden to
    // background content while open, which excludes the grid from the
    // accessibility tree entirely and would make every query below
    // find nothing regardless of what's actually rendered underneath.
    await page.keyboard.press('Escape');

    // Both pinned columns are still genuinely visible in the grid itself
    // -- absent from the menu because they can't be hidden, not because
    // they're actually gone.
    const grid = page.getByRole('grid').first();
    await expect(grid.locator('th').filter({ has: page.getByRole('button', { name: 'User Name' }) })).toBeVisible();
    await expect(grid.locator('th').filter({ has: page.getByRole('button', { name: 'Score' }) })).toBeVisible();
  });

  test('the rowCommands actions column is hideable via the Columns menu', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    const grid = page.getByRole('grid').first();
    // The actions column has no <th> text of its own (see DataTable.tsx),
    // so its presence is confirmed via a real row's own action button
    // instead.
    await expect(grid.getByRole('button', { name: 'View' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Columns' }).click();
    const actionsItem = page.getByRole('menuitemcheckbox', { name: 'Actions' });
    await expect(actionsItem).toHaveAttribute('aria-checked', 'true');
    await actionsItem.click();
    await page.keyboard.press('Escape');

    await expect(grid.getByRole('button', { name: 'View' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Actions' }).click();
    await page.keyboard.press('Escape');
    await expect(grid.getByRole('button', { name: 'View' }).first()).toBeVisible();
  });

  test('cannot hide the last remaining visible column', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    // demo/App.tsx's table has two pinned columns (User Name, Score),
    // which always count as visible on their own -- so hiding every
    // single hideable item here never actually reaches "zero visible
    // columns total," and nothing should ever disable. This test exists
    // to confirm that's ALSO true (the guard doesn't misfire when pinned
    // columns already guarantee the floor), while the dedicated jsdom
    // suite (DataTable.test.tsx) exercises the real disabling case
    // directly against a table with no pinned columns at all.
    await page.getByRole('button', { name: 'Columns' }).click();
    for (const name of ['ID', 'Email Address', 'Role Level', 'Status', 'Actions']) {
      await page.getByRole('menuitemcheckbox', { name }).click();
    }
    for (const name of ['ID', 'Email Address', 'Role Level', 'Status', 'Actions']) {
      await expect(page.getByRole('menuitemcheckbox', { name })).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByRole('menuitemcheckbox', { name })).not.toHaveAttribute('data-disabled');
    }
    // Close the menu first -- see the previous test's own comment on why
    // (Radix's aria-hidden background while open would hide the grid
    // from every query below regardless of what's actually rendered).
    await page.keyboard.press('Escape');

    // The two pinned columns are still genuinely visible -- the table
    // never actually lost its last column.
    const grid = page.getByRole('grid').first();
    await expect(grid.locator('th').filter({ has: page.getByRole('button', { name: 'User Name' }) })).toBeVisible();
    await expect(grid.locator('th').filter({ has: page.getByRole('button', { name: 'Score' }) })).toBeVisible();
  });
});
