import { test, expect } from '@playwright/test';

// Real-browser confirmation for a directly-reported bug: collapse the
// event log panel via its own toolbar button, then manually drag the
// main Splitter's handle open by hand -- the panel visibly grows (a
// real, correctly-reported `split` change), but the log content stayed
// hidden, since `eventLogCollapsed` (demo/App.tsx) is separate React
// state that nothing resynced from Splitter's own live split value; only
// the toolbar button's own click handler ever wrote to it. See
// demo/App.tsx's own comment (right after the collapse toolbar button)
// for the fix: a new `useAIEvent('splitter:split_changed', ...)`
// listener un-collapses whenever the reported split moves meaningfully
// away from the collapsed target, which covers a real drag (or keyboard/
// dblclick-reset) the same way it already covers the button.

test('collapsing the event log, then manually dragging the splitter open, un-collapses it and shows the log again', async ({ page }) => {
  await page.goto('/');

  // "▼ Collapse" (with an icon glyph) -- distinct from the sidebar's own
  // unrelated "Collapse sidebar" button elsewhere on the page.
  const collapseButton = page.getByRole('button', { name: /^▼ Collapse$/ });
  await collapseButton.waitFor({ state: 'visible' });
  await collapseButton.click();
  await expect(page.getByRole('button', { name: /^▲ Expand$/ })).toBeVisible();

  const handle = page.getByRole('separator').first();
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();

  // Drag the handle upward (toward the top of the viewport), reopening
  // the bottom panel by hand -- the same interaction a real user would
  // perform, not a programmatic state change.
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y - 200, { steps: 10 });
  await page.mouse.up();

  // The button flips back to "Collapse" (i.e. eventLogCollapsed became
  // false again), and the log's own content region -- entirely OMITTED
  // while collapsed, not just visually hidden, per demo/App.tsx's own
  // comment -- is back in the DOM.
  await expect(page.getByRole('button', { name: /^▼ Collapse$/ })).toBeVisible();
  const logContainer = page.locator('[tabindex="0"]').filter({ hasText: /\[|Listening for events/ }).first();
  await expect(logContainer).toBeVisible();
});
