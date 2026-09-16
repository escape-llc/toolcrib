import { test, expect } from '@playwright/test';
import { gotoTab, loadDemoTableData } from './nav';

// Real-browser confirmation of issue #316's WAI-ARIA grid keyboard
// navigation -- complements src/__tests__/DataTable.test.tsx's own jsdom
// suite (which already covers the underlying logic exhaustively) the same
// way this repo's own "confirmed by direct Tab-trace testing, not assumed"
// discipline asks for elsewhere: jsdom can assert `document.activeElement`
// and DOM attributes, but it has no real layout/scroll engine, so the one
// thing genuinely worth re-confirming here is that this actually works end
// to end in a real browser, including the virtualization-crossing scroll
// path the unit suite could only exercise by manually simulating the
// `scroll` event jsdom doesn't dispatch on its own.

async function activeElementGridCoords(page: import('@playwright/test').Page): Promise<{ row: string | null; col: string | null; tag: string }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return {
      row: el?.getAttribute('data-grid-row') ?? null,
      col: el?.getAttribute('data-grid-col') ?? null,
      tag: el?.tagName ?? '',
    };
  });
}

test.describe('DataTable grid keyboard navigation (issue #316)', () => {
  test('the table exposes real ARIA grid structure', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    // The table starts empty (see demo/App.tsx) -- load its real dataset
    // first, since every test below needs actual rows to navigate/click.
    await loadDemoTableData(page);

    const table = page.getByRole('grid').first();
    await expect(table).toBeVisible();
    // selectable (1) + 6 columns (id/name/email/role/status/score) +
    // rowCommands actions column (1) = 8.
    await expect(table).toHaveAttribute('aria-colcount', '8');
    // Real aria-rowcount reflects the full 250-row dummy dataset (see
    // demo/App.tsx), not just this page's 15 -- confirming the same
    // "full dataset, not just the virtualized/paginated subset" contract
    // the jsdom suite already asserts, but against real demo data here.
    await expect(table).toHaveAttribute('aria-rowcount', '251');
  });

  test('arrow keys move real browser focus across header cells, then into the body, with correct roving tabindex', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    // The table starts empty (see demo/App.tsx) -- load its real dataset
    // first, since every test below needs actual rows to navigate/click.
    await loadDemoTableData(page);

    const idHeader = page.locator('[data-grid-row="0"][data-grid-col="1"]').first(); // col 0 is the selection checkbox
    await idHeader.focus();
    await expect(idHeader).toHaveAttribute('tabindex', '0');

    await page.keyboard.press('ArrowRight');
    let active = await activeElementGridCoords(page);
    expect(active).toEqual({ row: '0', col: '2', tag: 'BUTTON' }); // "User Name" header

    await page.keyboard.press('ArrowDown');
    active = await activeElementGridCoords(page);
    expect(active).toEqual({ row: '1', col: '2', tag: 'TD' }); // first body row, same column

    await page.keyboard.press('ArrowLeft');
    active = await activeElementGridCoords(page);
    expect(active).toEqual({ row: '1', col: '1', tag: 'TD' }); // first body row, ID column

    // Roving tabindex: exactly one grid cell/widget should carry
    // tabindex="0" at a time.
    const mainGrid = page.getByRole('grid').first();
    const tabbableCount = await mainGrid.locator('[data-grid-row]:not([tabindex="-1"])').count();
    expect(tabbableCount).toBe(1);
  });

  test('Home/End and Ctrl+Home/Ctrl+End navigate within the row and across the whole grid', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    // The table starts empty (see demo/App.tsx) -- load its real dataset
    // first, since every test below needs actual rows to navigate/click.
    await loadDemoTableData(page);

    const nameHeader = page.locator('[data-grid-row="0"][data-grid-col="2"]').first();
    await nameHeader.focus();

    await page.keyboard.press('Home');
    expect(await activeElementGridCoords(page)).toMatchObject({ row: '0', col: '0' }); // the select-all checkbox

    await page.keyboard.press('End');
    expect(await activeElementGridCoords(page)).toMatchObject({ row: '0', col: '7' }); // last column (row actions)

    await page.keyboard.press('Control+End');
    // Last row on this page (defaultPageSize 15) is page-relative row 15 -- likely
    // outside the initial virtualization window at this viewport size, so
    // (unlike the plain Home/End checks above, both header-row moves that
    // never leave the DOM) this needs an auto-retrying assertion rather
    // than a one-shot snapshot: the real focus change here only lands once
    // the resulting scroll's own native `scroll` event -> onScroll ->
    // re-render cycle actually completes, not synchronously when the key
    // is pressed.
    await expect(page.locator('[data-grid-row="15"][data-grid-col="7"]').first()).toBeFocused();

    await page.keyboard.press('Control+Home');
    await expect(page.locator('[data-grid-row="0"][data-grid-col="0"]').first()).toBeFocused();
  });

  test('navigating far past the visible window (virtualization) scrolls the target row into view and focuses it -- a real browser exercising the scroll path jsdom cannot', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    // The table starts empty (see demo/App.tsx) -- load its real dataset
    // first, since every test below needs actual rows to navigate/click.
    await loadDemoTableData(page);

    const idHeader = page.locator('[data-grid-row="0"][data-grid-col="1"]').first();
    await idHeader.focus();

    // defaultPageSize=15 means Ctrl+End targets page-relative row 15 -- likely
    // outside the initial small render window this table's own
    // itemHeight/containerHeight combination virtualizes to.
    await page.keyboard.press('Control+End');

    // Auto-retrying, not a one-shot activeElementGridCoords() snapshot --
    // the real focus change here only lands once the scroll's own native
    // `scroll` event -> onScroll -> re-render cycle actually completes,
    // which is measurably slower on WebKit than Chromium (confirmed: a
    // one-shot check here passed reliably on Chromium but failed on
    // WebKit in real CI, landing on the pre-scroll header cell instead).
    const target = page.locator('[data-grid-row="15"][data-grid-col="7"]').first();
    await expect(target).toBeFocused();
    expect(await target.evaluate(el => el.tagName)).toBe('TD');
  });

  test('clicking a cell directly re-syncs the roving tabindex to it', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    // The table starts empty (see demo/App.tsx) -- load its real dataset
    // first, since every test below needs actual rows to navigate/click.
    await loadDemoTableData(page);

    // The initially-tabbable cell is (0, 0) -- the select-all checkbox,
    // since this table is `selectable` and column 0 is always the grid's
    // first cell when it is.
    const selectAllCheckbox = page.locator('[data-grid-row="0"][data-grid-col="0"]').first();
    await expect(selectAllCheckbox).toHaveAttribute('tabindex', '0');

    const emailCell = page.locator('[data-grid-row="3"][data-grid-col="3"]').first();
    await emailCell.click();
    await expect(emailCell).toHaveAttribute('tabindex', '0');
    await expect(selectAllCheckbox).toHaveAttribute('tabindex', '-1');
  });

  // Regression for a reported (but, per real-browser measurement below, not
  // currently reproducible) bug: "the DataTable selection UI column is not
  // in the tab order, it gets skipped, including the one in the header."
  // Every other test in this file seeds focus programmatically (`.focus()`)
  // before exercising arrow-key navigation -- none of them prove the
  // selection column is actually reachable via a real, native keyboard Tab
  // sweep from OUTSIDE the table, which is what the report describes. This
  // drives real `Tab` keypresses starting from a control that sits earlier
  // in the page's own DOM order and confirms the select-all checkbox is the
  // very next stop -- the grid's single roving-tabindex entry point, per
  // the W3C APG composite-widget pattern (Tab moves into/out of the whole
  // grid as one stop; arrow keys move within it -- confirmed separately by
  // the roving-tabindex-count assertion above, not a gap this test needs to
  // re-prove).
  test('a real Tab keypress from outside the table reaches the header select-all checkbox, not the sortable column headers past it', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Data Table');
    await loadDemoTableData(page);

    // The density radio group sits in this table's own toolbar, directly
    // before it in DOM order -- a realistic starting point for a keyboard
    // user tabbing forward through the page. role="radio" + plain label,
    // not role="button" -- DataTable composes the shared <ToggleGroup>
    // for this now (the real WAI-ARIA "Radio Group" pattern), not 3
    // hand-rolled Buttons. `.focus()` still works directly on a
    // tabindex="-1" option despite Radix's own roving-tabindex management
    // (only one option is a real Tab stop at a time) -- tabindex="-1"
    // elements remain focusable via script, just not via sequential Tab.
    await page.getByRole('radio', { name: 'Normal' }).focus();

    // Tab through whatever real, ordinary focusable controls sit between
    // the toolbar and the table itself (Reload/Export buttons) until
    // landing inside the grid -- bounded, not open-ended, so a genuine
    // regression (the checkbox never gets reached at all) fails loudly
    // instead of looping forever.
    let reachedCheckbox = false;
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const active = await activeElementGridCoords(page);
      if (active.row === '0' && active.col === '0') {
        reachedCheckbox = true;
        break;
      }
      // The only other grid-nav cell reachable via a plain Tab sweep would
      // be a sortable column header past the checkbox -- landing there
      // instead is exactly the reported bug (the selection column skipped).
      expect(active.row).not.toBe('0');
    }
    expect(reachedCheckbox).toBe(true);

    const checkbox = page.locator('[data-grid-row="0"][data-grid-col="0"]').first();
    await expect(checkbox).toBeFocused();
    await expect(checkbox).toHaveAttribute('role', 'checkbox');
    await expect(checkbox).toHaveAccessibleName('Select all rows on this page');
  });
});
