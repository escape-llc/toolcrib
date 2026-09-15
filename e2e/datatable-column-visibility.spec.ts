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

test.describe('DataTable column show/hide (issue #340)', () => {
  test('unchecking a column in the Columns menu removes it from the real grid, re-checking brings it back', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    const grid = page.getByRole('grid').first();
    await expect(grid.getByRole('columnheader', { name: 'User Name' })).toBeVisible();

    await page.getByRole('button', { name: 'Columns' }).click();
    const nameItem = page.getByRole('menuitemcheckbox', { name: 'User Name' });
    await expect(nameItem).toHaveAttribute('aria-checked', 'true');
    await nameItem.click();
    await page.keyboard.press('Escape');

    await expect(grid.getByRole('columnheader', { name: 'User Name' })).not.toBeVisible();
    // A different column is unaffected.
    await expect(grid.getByRole('columnheader', { name: 'Email Address' })).toBeVisible();

    await page.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'User Name' }).click();
    await page.keyboard.press('Escape');
    await expect(grid.getByRole('columnheader', { name: 'User Name' })).toBeVisible();
  });
});
