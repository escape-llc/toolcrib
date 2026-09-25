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
// Root fix: `eventLogCollapsed` now has exactly ONE writer -- a single
// `useAIEvent('splitter:split_changed', ...)` listener that fires for
// EVERY change to this Splitter, regardless of source (the toolbar
// button, a real drag, arrow keys, dblclick-to-reset). There is only one
// real value to ever go stale, not two independent paths that can
// disagree. Card.Content is also no longer conditionally omitted -- it
// stays mounted always, so a "still collapsed" panel just means a small
// (not hidden) sliver of real log is visible through it, never an empty
// gap.
//
// Two more corrections from a Gemini PR review on that same fix, both
// exercised below: (1) `eventLogCollapsed` is computed INSIDE the
// listener, using measuredMinSize as of that instant -- not as a
// render-time comparison against the live-recalculating target, which
// would flip it (wrongly) on a bare window resize and, worse, block the
// very resize-effect meant to correct that drift. (2) the always-mounted
// log container's `tabIndex` drops to -1 while collapsed, so its
// near-invisible sliver doesn't remain a real keyboard Tab stop.

test('collapsing the event log, then manually dragging the splitter open, un-collapses it and shows the log again', async ({ page }) => {
  await page.goto('/');

  // "Collapse event log" -- not the shorter "Collapse" (issue #598): that
  // collided with two OTHER same-page buttons (a per-log-entry payload
  // toggle, "Collapse payload for <event>", and this same toolbar's own
  // "Collapse" wording before it was made icon-only), since Playwright's
  // default `name` matching is a substring match, not exact.
  const collapseButton = page.getByRole('button', { name: 'Collapse event log' });
  await collapseButton.waitFor({ state: 'visible' });
  await collapseButton.click();
  await expect(page.getByRole('button', { name: 'Expand event log' })).toBeVisible();

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
  await expect(page.getByRole('button', { name: 'Collapse event log' })).toBeVisible();
  const logContainer = page.locator('[tabindex="0"]').filter({ hasText: /\[|Listening for events/ }).first();
  await expect(logContainer).toBeVisible();
});

test('manually dragging the splitter closed (without the button) flips the button to Expand, log content stays mounted', async ({ page }) => {
  await page.goto('/');

  // Starts expanded (default split) -- the button reads "Collapse".
  const collapseButton = page.getByRole('button', { name: 'Collapse event log' });
  await collapseButton.waitFor({ state: 'visible' });

  const handle = page.getByRole('separator').first();
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  // Located by its own stable styling, not tabindex -- tabindex is
  // expected to flip between 0/-1 depending on collapsed state (see
  // below), so it can't be what identifies this element in the first place.
  const logContainer = page.locator('div[style*="monospace"]').filter({ hasText: /\[|Listening for events/ }).first();
  await expect(logContainer).toBeAttached();
  await expect(logContainer).toHaveAttribute('tabindex', '0');

  // Drag the handle all the way down, past Splitter's own minSize floor
  // for the bottom panel -- a real user shrinking the log panel by hand,
  // never touching the button at all.
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + 400, { steps: 10 });
  await page.mouse.up();

  // The button auto-syncs to "Expand" purely from the real split ratio --
  // nothing wrote to a separate boolean, there's nothing to have missed.
  // The log region is still in the DOM (never omitted), just small -- and
  // its tabindex drops to -1 while collapsed (Gemini PR review finding:
  // an always-mounted-but-nearly-invisible scrollable region must not
  // remain a real Tab stop).
  await expect(page.getByRole('button', { name: 'Expand event log' })).toBeVisible();
  await expect(logContainer).toBeAttached();
  await expect(logContainer).toHaveAttribute('tabindex', '-1');

  // Clicking Expand from here returns to the default split, and the
  // button/content both flip back in sync, tabindex included.
  await page.getByRole('button', { name: 'Expand event log' }).click();
  await expect(logContainer).toHaveAttribute('tabindex', '0');
  await expect(page.getByRole('button', { name: 'Collapse event log' })).toBeVisible();
  await expect(logContainer).toBeAttached();
});

test('collapsed state survives a window resize (Gemini PR review finding)', async ({ page }) => {
  await page.goto('/');

  const collapseButton = page.getByRole('button', { name: 'Collapse event log' });
  await collapseButton.waitFor({ state: 'visible' });
  await collapseButton.click();
  await expect(page.getByRole('button', { name: 'Expand event log' })).toBeVisible();

  const separator = page.getByRole('separator').first();
  const splitBeforeResize = await separator.getAttribute('aria-valuenow');

  // Resizing the viewport changes measuredMinSize (both the container's
  // and the toolbar's real heights change) with NO splitter:split_changed
  // event involved at all -- exactly the case a render-time comparison
  // against a live-recalculating target would get wrong (see this file's
  // own top comment). The button must stay "Expand" (still collapsed)
  // throughout, and the resize-effect's own corrective re-emit should
  // move the real split to track the new target.
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect(page.getByRole('button', { name: 'Expand event log' })).toBeVisible();
  await expect
    .poll(() => separator.getAttribute('aria-valuenow'))
    .not.toBe(splitBeforeResize);

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByRole('button', { name: 'Expand event log' })).toBeVisible();
});
