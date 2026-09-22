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

    // DataTable composes the shared <ToggleGroup> for this now, not 3
    // hand-rolled Buttons -- the real WAI-ARIA "Radio Group" pattern
    // (role="radiogroup" on the whole strip, role="radio" + aria-checked
    // per option), not role="button" + aria-pressed. The group's own
    // aria-label ("Row density") carries that context at the group level;
    // each option's own accessible name is just its plain label.
    const compactBtn = page.getByRole('radio', { name: 'Compact' });
    await expect(compactBtn).toBeVisible();

    const firstRow = page.getByRole('grid').first().locator('tbody tr[aria-rowindex]').first();
    const normalHeight = await firstRow.evaluate(el => el.getBoundingClientRect().height);

    await compactBtn.click();
    await expect(compactBtn).toHaveAttribute('aria-checked', 'true');
    const compactHeight = await firstRow.evaluate(el => el.getBoundingClientRect().height);
    expect(compactHeight).toBeLessThan(normalHeight);

    const spaciousBtn = page.getByRole('radio', { name: 'Spacious' });
    await spaciousBtn.click();
    await expect(spaciousBtn).toHaveAttribute('aria-checked', 'true');
    const spaciousHeight = await firstRow.evaluate(el => el.getBoundingClientRect().height);
    expect(spaciousHeight).toBeGreaterThan(normalHeight);

    // Back to normal, for any test that runs after this one against the same worker/page.
    await page.getByRole('radio', { name: 'Normal' }).click();
  });

  // Regression test for a real, reported bug (see DataTableSlice.tsx's own
  // DENSITY_SELECTION_CELL_PADDING_V_PX/DENSITY_SELECTION_HEADER_PADDING_V_PX
  // comment): defaultPageSize="auto" is supposed to compute an exact-fit
  // page size with zero vertical scroll, but a FIXED (non-density-scaled)
  // padding on the selection checkbox column rendered every row/the header
  // taller than density='compact' 's own declared budget --
  // computeAutoPageSize has no way to know real rows are running taller
  // than that budget, so it overshot and produced a real, visible
  // scrollbar. This is the second time this exact CLASS of bug has hit
  // this component (the first was DENSITY_ROW_COMMAND_BUTTON_PX, for the
  // rowCommands actions column) -- a standing e2e check across every
  // density, not just a one-off fix, so a third special-content column
  // introducing the same mistake fails a real browser test immediately
  // rather than needing to be independently reported and rediscovered a
  // third time.
  test('defaultPageSize="auto" produces zero vertical scroll at every density, with the selection checkbox column enabled', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    // demo/App.tsx's main table is `selectable` -- the checkbox column
    // that caused this exact regression is already present without
    // needing to configure anything further.
    await page.getByRole('combobox', { name: 'Rows per page' }).selectOption('auto');

    for (const densityLabel of ['Compact', 'Normal', 'Spacious'] as const) {
      await page.getByRole('radio', { name: densityLabel }).click();
      await expect(page.getByRole('radio', { name: densityLabel })).toHaveAttribute('aria-checked', 'true');

      // A density change plays a real cross-fade transition (issue #499,
      // datatable-density-crossfade.spec.ts): the OUTGOING density's rows
      // stick around as a static, cloned overlay (a second real <table>)
      // fading out on top of the live table underneath, which genuinely
      // does inflate scrollHeight for the transition's own duration --
      // confirmed directly (not assumed), since asserting immediately
      // after the click produced a real, if transient, false positive
      // here. Waiting for the clone to actually be removed (the same
      // real signal that spec's own first test polls for) is what makes
      // this check honest, not a race against the fade's own timing.
      await expect.poll(() => page.locator('table').count()).toBe(1);

      const scrollInfo = await page.evaluate(() => {
        const grid = document.querySelector('[role="grid"]');
        let el: Element | null = grid;
        while (el) {
          const style = getComputedStyle(el);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            return { clientHeight: el.clientHeight, scrollHeight: el.scrollHeight };
          }
          el = el.parentElement;
        }
        return null;
      });
      expect(scrollInfo, `no scrollable ancestor found for density=${densityLabel}`).not.toBeNull();
      if (scrollInfo!.scrollHeight > scrollInfo!.clientHeight) {
        // Temporary diagnostic dump -- this exact assertion has failed
        // identically on CI (never locally) across three separate
        // real-vs-assumed-constant fixes in a row, each of which changed
        // nothing about the failure's own numbers. Rather than guess a
        // fourth time, dump the real rendered geometry so the actual
        // CI-only browser/font discrepancy is visible directly instead of
        // inferred. Remove once the real root cause is confirmed and fixed.
        const diag = await page.evaluate(() => {
          const grid = document.querySelector('[role="grid"]')!;
          const thead = grid.querySelector('thead tr')!;
          const rows = Array.from(grid.querySelectorAll('tbody tr'));
          return {
            theadHeight: thead.getBoundingClientRect().height,
            headerCellHeights: Array.from(thead.children).map(th => th.getBoundingClientRect().height),
            rowHeights: rows.map(r => r.getBoundingClientRect().height),
            rowCount: rows.length,
          };
        });
        console.log(`DIAG density=${densityLabel}`, JSON.stringify(diag));
      }
      expect(scrollInfo!.scrollHeight, `density=${densityLabel} overflowed its own auto-computed page size`).toBeLessThanOrEqual(
        scrollInfo!.clientHeight
      );
    }

    // Back to normal, for any test that runs after this one.
    await page.getByRole('radio', { name: 'Normal' }).click();
  });
});
