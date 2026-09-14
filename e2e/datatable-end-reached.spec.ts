import { test, expect } from '@playwright/test';
import { gotoTab, loadDemoTableData } from './nav';

// Real-browser confirmation of issue #365's onEndReached callback --
// complements src/__tests__/DataTable.test.tsx's own jsdom suite (which
// already covers the underlying threshold/re-arm arithmetic exhaustively
// via simulated scrollTop values). The one thing only a real browser can
// prove: scrolling a real, virtualized 250-row continuous-scroll table all
// the way to its actual bottom fires the callback exactly once, using real
// layout and a real scroll event, not a fabricated scrollTop.
//
// No demo prop wiring needed to observe this -- the demo's own
// `useAnyAIEvent`-driven "Live AI Event Bus Monitor" panel already logs
// every bus event verbatim, `datatable:end_reached` included, so this
// reads the visible log text rather than requiring `onEndReached` itself
// to be wired up in demo/App.tsx.
test('scrolling a continuous-scroll table to its real bottom emits datatable:end_reached with the full loaded count', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Data Table');
  await loadDemoTableData(page);

  await page.getByLabel('Continuous Scroll').click();
  await page.waitForTimeout(300);

  const table = page.locator('table').first();
  const scrollBody = await table.evaluateHandle(el => el.parentElement as HTMLElement);

  await page.evaluate(el => {
    el.scrollTop = el.scrollHeight;
  }, scrollBody);
  await page.waitForTimeout(300);

  // The event name and its payload render in separate sibling <span>s
  // inside one wrapping <div> per log line -- locate the wrapping line via
  // the event-name span, then assert on ITS parent's full text so the
  // payload (a sibling span, not a descendant of the name span itself) is
  // actually included in what gets checked.
  const eventNameSpan = page.locator('span', { hasText: 'datatable:end_reached' }).first();
  await expect(eventNameSpan).toBeVisible();
  const logLine = eventNameSpan.locator('..');
  await expect(logLine).toContainText('"loadedCount":250');
});
