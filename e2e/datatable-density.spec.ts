import { test, expect } from '@playwright/test';
import { gotoTab, loadDemoTableData } from './nav';

// Real-browser confirmation of issue #339's density selector + the
// itemHeight/density disconnect fix -- complements
// src/__tests__/DataTable.test.tsx's own jsdom suite (which already covers
// the underlying default-derivation/precedence/event logic exhaustively).
// The one thing genuinely worth re-confirming here is that clicking a real
// toggle button actually changes the real, rendered row height in a live
// browser -- jsdom has no layout engine, so a getBoundingClientRect-based
// assertion is the kind of check AGENTS.md's own defect-pindown plan notes
// jsdom structurally cannot make.

test.describe('DataTable density selector (issue #339)', () => {
  test('clicking a density option visibly changes the real rendered row height', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    // No wrapping role="group" anymore -- issue #439 (connecting the whole
    // toolbar-right row into one merged UIGroup pill) removed it; each
    // button's own aria-label now carries the "Row density" context that
    // wrapper's aria-label used to (see DataTable.tsx's own comment right
    // where these buttons render).
    const compactBtn = page.getByRole('button', { name: 'Row density: Compact' });
    await expect(compactBtn).toBeVisible();

    const firstRow = page.getByRole('grid').first().locator('tbody tr[aria-rowindex]').first();
    const normalHeight = await firstRow.evaluate(el => el.getBoundingClientRect().height);

    await compactBtn.click();
    await expect(compactBtn).toHaveAttribute('aria-pressed', 'true');
    const compactHeight = await firstRow.evaluate(el => el.getBoundingClientRect().height);
    expect(compactHeight).toBeLessThan(normalHeight);

    const spaciousBtn = page.getByRole('button', { name: 'Row density: Spacious' });
    await spaciousBtn.click();
    await expect(spaciousBtn).toHaveAttribute('aria-pressed', 'true');
    const spaciousHeight = await firstRow.evaluate(el => el.getBoundingClientRect().height);
    expect(spaciousHeight).toBeGreaterThan(normalHeight);

    // Back to normal, for any test that runs after this one against the same worker/page.
    await page.getByRole('button', { name: 'Row density: Normal' }).click();
  });
});
