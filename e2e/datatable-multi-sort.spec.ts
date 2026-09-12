import { test, expect } from '@playwright/test';
import { gotoTab, loadDemoTableData } from './nav';

// Real-browser confirmation of issue #337's multi-column sort -- complements
// src/__tests__/DataTable.test.tsx's own jsdom suite (which already covers
// the underlying comparator/cycle logic exhaustively) the same way every
// other DataTable e2e spec in this suite already explains: the one thing
// genuinely worth re-confirming here is that a real Shift+click (not
// `fireEvent`'s synthetic `shiftKey: true`) actually adds a secondary sort
// and shows the priority badge in a real browser.

test.describe('DataTable multi-column sort (issue #337)', () => {
  test('Shift+click adds a secondary sort and shows a numbered priority badge', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    const roleHeader = page.getByRole('button', { name: 'Role Level' });
    const scoreHeader = page.getByRole('button', { name: 'Score' });

    await roleHeader.click();
    await expect(roleHeader.locator('xpath=..')).toHaveAttribute('aria-sort', 'ascending');
    // Single sort -- no priority badge text yet.
    await expect(roleHeader).not.toContainText('1');

    await scoreHeader.click({ modifiers: ['Shift'] });
    await expect(scoreHeader.locator('..')).toHaveAttribute('aria-sort', 'ascending');
    // Both headers now show their own priority.
    await expect(roleHeader).toContainText('1');
    await expect(scoreHeader).toContainText('2');
  });
});
