import { test, expect, type Page } from '@playwright/test';
import { gotoTab, gotoRoute, systemRoute } from './nav';

// Issue #905, phase 2: <DataTable data={source} pagination={false}> against
// the Systems page's fake 100,000-row server (demo/serverRows.ts, 150ms
// latency). Every wait is on a real signal -- a DOM state, never a sleep.
// `window.__dataTableDemoRequests` is the demo's own test hook: every
// request its fake server received.

const TOTAL = 100_000;

const grid = (page: Page) => page.getByTestId('virtualized-demo').getByRole('grid');
const bodyRows = (page: Page) => grid(page).locator('tbody tr');

async function open(page: Page) {
  await page.goto('/');
  await gotoTab(page, 'Catalog');
  await gotoRoute(page, systemRoute('data-virtualization'), '#cat-sys-data-virtualization');
  await expect(grid(page)).toHaveAttribute('aria-rowcount', String(TOTAL + 1));
}

/** The DOM never holds more than a window of rows, however far the table has scrolled. */
async function expectBoundedDom(page: Page) {
  expect(await bodyRows(page).count()).toBeLessThan(200);
}

const requests = (page: Page) =>
  page.evaluate(() => (window.__dataTableDemoRequests ?? []).map(r => ({ ...r })));
const clearRequests = (page: Page) =>
  page.evaluate(() => {
    window.__dataTableDemoRequests!.length = 0;
  });

/** The first row that has real data, as `{ rowindex, text }`. */
const firstLoadedRow = (page: Page) =>
  grid(page).evaluate(el => {
    const row = el.querySelector('tbody tr[aria-rowindex]:not([data-placeholder]):not([data-block-error])');
    return row ? { rowindex: Number(row.getAttribute('aria-rowindex')), text: row.textContent ?? '' } : null;
  });

test.describe('data virtualization (issue #905, phase 2)', () => {
  test('loads the first block, sizes the scroll area for every row, and keeps the DOM small', async ({ page }) => {
    await open(page);
    await expect(grid(page).locator('tr[aria-rowindex="2"]')).toContainText('Customer 1');
    await expect(grid(page)).not.toHaveAttribute('aria-busy', 'true');
    await expectBoundedDom(page);

    // The scrollbar spans the whole result set, not the loaded rows.
    const body = grid(page).locator('..');
    const { scrollHeight, clientHeight } = await body.evaluate(el => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
    expect(scrollHeight).toBeGreaterThan(TOTAL * 40);
    expect(clientHeight).toBeLessThan(scrollHeight / 100);
  });

  test('dragging to the middle fetches only the blocks it lands on', async ({ page }) => {
    await open(page);
    await clearRequests(page);

    // One jump straight to the middle. A multi-step fling here would race
    // the 120ms settle delay against how fast the browser runs each step,
    // which under CI load it loses (WebKit fetched a passed-over block).
    // That settle-then-fetch logic is covered deterministically, with fake
    // timers, in DataTable.virtualization.test.tsx; this checks the real
    // scroll lands on the right rows and asks for nothing else.
    await grid(page).locator('..').evaluate(el => {
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
    });

    await expect.poll(async () => (await firstLoadedRow(page))?.rowindex ?? 0).toBeGreaterThan(48_000);
    const first = (await firstLoadedRow(page))!;
    expect(first.rowindex).toBeLessThan(52_000);
    // Row aria-rowindex N is item N - 1, loaded for real.
    expect(first.text).toContain(`Customer ${first.rowindex - 1}`);
    await expectBoundedDom(page);

    // Nothing was requested for any of the places the scroll passed over:
    // only blocks near the row it came to rest on.
    const made = await requests(page);
    expect(made.length).toBeGreaterThan(0);
    for (const { start } of made) {
      expect(start).toBeGreaterThanOrEqual(48_000);
      expect(start).toBeLessThanOrEqual(52_000);
    }
  });

  test('Ctrl+End reaches the last row with its real data, focus still on that row', async ({ page }) => {
    await open(page);
    await grid(page).locator('tr[aria-rowindex="2"] td[data-grid-col="1"]').focus();
    await page.keyboard.press('Control+End');

    const last = grid(page).locator(`tr[aria-rowindex="${TOTAL + 1}"]`);
    await expect(last).toContainText(`Customer ${TOTAL}`);
    await expect(last.locator('td:focus')).toHaveCount(1);
    await expect(grid(page)).not.toHaveAttribute('aria-busy', 'true');
    await expectBoundedDom(page);
  });

  test('changing the sort returns to the top and asks for block 0 with the new sort', async ({ page }) => {
    await open(page);
    // Somewhere deep first, so "back at the top" means something.
    await grid(page).locator('tr[aria-rowindex="2"] td[data-grid-col="1"]').focus();
    await page.keyboard.press('Control+End');
    await expect(grid(page).locator(`tr[aria-rowindex="${TOTAL + 1}"]`)).toContainText(`Customer ${TOTAL}`);

    await clearRequests(page);
    await page.getByTestId('virtualized-demo').getByRole('columnheader', { name: /Amount/ }).click();

    await expect.poll(async () => (await requests(page)).length).toBeGreaterThan(0);
    const [first] = await requests(page);
    expect(first.start).toBe(0);
    expect(first.sortBy).toEqual([{ key: 'amount', direction: 'asc' }]);

    expect(await grid(page).locator('..').evaluate(el => el.scrollTop)).toBe(0);
    await expect(grid(page).locator('tr[aria-rowindex="2"]')).toContainText('Customer 1');
    await expect(grid(page)).not.toHaveAttribute('aria-busy', 'true');
    await expectBoundedDom(page);
  });
});
