import { test, expect } from '@playwright/test';
import { gotoTab, loadDemoTableData } from './nav';

// Real-browser confirmation of issue #317's global/quick-filter search box
// -- complements src/__tests__/DataTable.test.tsx's own jsdom suite (which
// already covers the underlying filter/page-reset/event logic
// exhaustively) the same way every other DataTable e2e spec in this suite
// already explains: the one thing genuinely worth re-confirming here is
// that typing into a real input actually narrows the real, rendered grid
// end to end, including the aria-rowcount a screen reader would announce.

test.describe('DataTable quick filter (issue #317)', () => {
  test('typing into the search box narrows the grid to matching rows and updates aria-rowcount', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    const mainGrid = page.getByRole('grid').first();
    // 250 data rows + 1 header row, unfiltered.
    await expect(mainGrid).toHaveAttribute('aria-rowcount', '251');

    const search = page.getByRole('searchbox', { name: 'Search…' });
    await search.fill('user 7');

    // "User 7" is a substring of User 7, 70-79, and 170-179 (10 + 10 + 1 =
    // 21 matches) -- not asserting the exact count here (that's the
    // jsdom suite's job), just that SOME real narrowing happened and the
    // grid's own accessible row count reflects it, not the original 250.
    await expect(mainGrid).not.toHaveAttribute('aria-rowcount', '251');
    await expect(page.getByText('User 7', { exact: true })).toBeVisible();
    await expect(page.getByText('User 1', { exact: true })).not.toBeVisible();

    await search.fill('');
    await expect(mainGrid).toHaveAttribute('aria-rowcount', '251');
  });
});
