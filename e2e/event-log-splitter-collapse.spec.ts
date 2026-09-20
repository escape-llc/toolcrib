import { test, expect } from '@playwright/test';

// Real-browser confirmation for two directly-reported bugs on the same
// mechanism, both now closed by the same fix in demo/App.tsx.
//
// First report: collapse the event log panel via its own toolbar button,
// then manually drag the main Splitter's handle open by hand -- the panel
// visibly grows (a real, correctly-reported `split` change), but the log
// content stayed hidden. First fix (since superseded): a
// `useAIEvent('splitter:split_changed', ...)` listener that un-collapsed
// whenever the reported split moved away from the collapsed target --
// but that only ever covered ONE direction (drag away from collapsed);
// `eventLogCollapsed` was still its own independently-written boolean,
// with the button's click handler as its only writer for the OTHER
// direction, so a manual drag TOWARD the collapsed target left the
// button and the panel disagreeing the other way (reported directly, a
// second time, from a real screenshot: button reading "Expand" -- i.e.
// still flagged collapsed -- next to a large, blank panel that had
// actually been dragged open).
//
// Root fix: `eventLogCollapsed` is no longer written anywhere -- it's
// derived every render from `currentSplit`, itself the single value kept
// in sync by one `useAIEvent('splitter:split_changed', ...)` listener
// that runs for EVERY change to this Splitter, regardless of source (the
// toolbar button, a real drag, arrow keys, dblclick-to-reset). There is
// only one real value to ever go stale, and it's derived, not written by
// two independent paths that can disagree. Card.Content is also no
// longer conditionally omitted -- it stays mounted always, so a "still
// collapsed" panel just means a small (not hidden) sliver of real log is
// visible through it, never an empty gap.

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

  // The button flips back to "Collapse" (eventLogCollapsed, now derived
  // from the real split, reads false again), and the log's own content
  // region -- always mounted, never conditionally omitted -- is visible
  // at the panel's new, much larger height.
  await expect(page.getByRole('button', { name: /^▼ Collapse$/ })).toBeVisible();
  const logContainer = page.locator('[tabindex="0"]').filter({ hasText: /\[|Listening for events/ }).first();
  await expect(logContainer).toBeVisible();
});

test('manually dragging the splitter closed (without the button) flips the button to Expand, log content stays mounted', async ({ page }) => {
  await page.goto('/');

  // Starts expanded (default split) -- the button reads "Collapse".
  const collapseButton = page.getByRole('button', { name: /^▼ Collapse$/ });
  await collapseButton.waitFor({ state: 'visible' });

  const handle = page.getByRole('separator').first();
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  const logContainer = page.locator('[tabindex="0"]').filter({ hasText: /\[|Listening for events/ }).first();
  await expect(logContainer).toBeAttached();

  // Drag the handle all the way down, past Splitter's own minSize floor
  // for the bottom panel -- a real user shrinking the log panel by hand,
  // never touching the button at all.
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + 400, { steps: 10 });
  await page.mouse.up();

  // The button auto-syncs to "Expand" purely from the real split ratio --
  // nothing wrote to a separate boolean, there's nothing to have missed.
  // The log region is still in the DOM (never omitted), just small.
  await expect(page.getByRole('button', { name: /^▲ Expand$/ })).toBeVisible();
  await expect(logContainer).toBeAttached();

  // Clicking Expand from here returns to the default split, and the
  // button/content both flip back in sync.
  await page.getByRole('button', { name: /^▲ Expand$/ }).click();
  await expect(page.getByRole('button', { name: /^▼ Collapse$/ })).toBeVisible();
  await expect(logContainer).toBeAttached();
});
