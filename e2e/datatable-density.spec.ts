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

    const group = page.getByRole('group', { name: 'Row density' });
    await expect(group).toBeVisible();

    const firstRow = page.getByRole('grid').first().locator('tbody tr[aria-rowindex]').first();
    const normalHeight = await firstRow.evaluate(el => el.getBoundingClientRect().height);

    await group.getByRole('button', { name: 'Compact' }).click();
    await expect(group.getByRole('button', { name: 'Compact' })).toHaveAttribute('aria-pressed', 'true');
    const compactHeight = await firstRow.evaluate(el => el.getBoundingClientRect().height);
    expect(compactHeight).toBeLessThan(normalHeight);

    await group.getByRole('button', { name: 'Spacious' }).click();
    await expect(group.getByRole('button', { name: 'Spacious' })).toHaveAttribute('aria-pressed', 'true');
    const spaciousHeight = await firstRow.evaluate(el => el.getBoundingClientRect().height);
    expect(spaciousHeight).toBeGreaterThan(normalHeight);

    // Back to normal, for any test that runs after this one against the same worker/page.
    await group.getByRole('button', { name: 'Normal' }).click();
  });
});
