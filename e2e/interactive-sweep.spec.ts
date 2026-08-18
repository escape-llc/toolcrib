import { test, expect, Page } from '@playwright/test';

// A general backstop against the whole CLASS of bug this session found and
// fixed one instance at a time (TabStrip's active-tab fontWeight/divider
// shifting every other tab, Toast's exit animation never playing) — rather
// than adding a bespoke assertion per bug, this sweeps every interactive
// control on every demo tab and checks for two things ANY component could
// get wrong: (1) a console error/exception, and (2) an unrelated sibling
// silently shifting position. Neither test knows anything about which
// component it's checking; both would have caught today's bugs without
// having been written with them in mind, and should catch the next one too.
//
// Deliberately not pixel-screenshot diffing (see the conversation that led
// here): CI runs on ubuntu-latest while this repo is developed on Windows,
// and font/antialiasing differences between the two would make screenshot
// baselines generated locally fail on every CI run for reasons that have
// nothing to do with a real regression. Measuring real DOM/CSS state
// (bounding boxes, console output) is the same approach every other spec in
// this suite already uses, and it's platform-stable.

const TABS = [
  '🚀 Overview & Architecture',
  '📝 Form & Zod Engine',
  '🪟 Overlays (Popup / Drawer / Modal)',
  '🔔 Toast Subsystem',
  '📊 Virtualized Data Table',
  '📐 Common Layout Idioms',
  '🖼️ Wireframe Gallery',
  '🧩 Component Showcase',
];

// Radix closes basically everything (Modal, Popup, Drawer, AlertDialog,
// DropdownMenu, ContextMenu, Select) on Escape — one key between clicks
// keeps each interaction independent instead of compounding overlay state
// into the next one. Drawer in particular closes via its own JS timer
// (250ms, matching its CSS animation duration) rather than a real
// animationend, so its backdrop <div role="presentation"> — which blocks
// clicks on anything behind it — stays in the DOM for that whole window
// after Escape. A fixed short wait here isn't reliable across every overlay
// type's own close duration, so poll for the backdrop actually being gone
// instead of guessing a delay long enough for the slowest one.
async function settle(page: Page) {
  await page.keyboard.press('Escape').catch(() => {});
  await expect(page.locator('[role="presentation"]')).toHaveCount(0, { timeout: 2000 }).catch(() => {});
}

// A tab switch replays that panel's own entrance animation/transition;
// clicking mid-transition is exactly the kind of transient instability that
// makes a locator's own actionability retry loop (and, occasionally, the
// click itself) unreliable. One retry after a short pause absorbs that
// without weakening what the click actually proves once it does land.
async function clickRobust(locator: ReturnType<Page['locator']>, timeout = 2000): Promise<boolean> {
  try {
    await locator.click({ timeout });
    return true;
  } catch {
    try {
      await locator.page().waitForTimeout(200);
      await locator.click({ timeout });
      return true;
    } catch {
      return false;
    }
  }
}

// Known, deliberate demo behaviors that legitimately log to console/
// pageerror — not real bugs, so the sweep shouldn't fail on them. Every
// other error still fails the sweep.
const EXPECTED_NOISE = [
  // Component Showcase's "💥 Trigger Error" button deliberately throws
  // (demo/App.tsx's Flaky component) to demonstrate AIErrorBoundary — React
  // logs a caught error to console.error even though it's handled, by
  // design, in every mode including production; this covers both React's
  // own "above error occurred in <Flaky>" boilerplate and the thrown
  // Error's own message.
  /Simulated render crash/,
  /<Flaky>/,
  // Wireframe Gallery's tiles render via <iframe sandbox="" srcDoc={...}> —
  // an intentionally maximally-restrictive sandbox (static, inert
  // wireframes only), so the browser's own "script blocked" enforcement is
  // the sandbox working as designed, not a bug.
  /Blocked script execution in 'about:srcdoc'/,
  // Component Showcase's <Avatar src="https://broken-image-url.example/...">
  // deliberately demonstrates the fallback-on-load-failure behavior.
  /broken-image-url\.example/,
  /ERR_NAME_NOT_RESOLVED/,
];
const isExpectedNoise = (text: string): boolean => EXPECTED_NOISE.some(re => re.test(text));

test('no console errors while clicking through every interactive control on every tab', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !isExpectedNoise(msg.text())) errors.push(msg.text());
  });
  page.on('pageerror', err => {
    if (!isExpectedNoise(err.message)) errors.push(err.message);
  });

  await page.goto('/');

  for (const tab of TABS) {
    await page.getByText(tab, { exact: true }).click();
    // Lets the panel's own entrance transition finish before the sweep
    // starts clicking through it — mid-transition is exactly when a
    // locator's actionability check ("stable" — the element's bounding box
    // must stop moving between consecutive frames) is most likely to be
    // fighting the animation itself rather than a real problem.
    await page.waitForTimeout(300);
    await settle(page);

    const scope = page.getByTestId('main-content-scroll');
    const count = await scope.locator('button:visible:not([disabled])').count();

    for (let i = 0; i < count; i++) {
      // Re-queried fresh every iteration (not a snapshotted handle list) —
      // a prior click in this same loop can legitimately add/remove
      // buttons (opening a Popup adds its own close button, a fired toast
      // adds a dismiss button), so indices only stay meaningful against a
      // live, re-evaluated locator.
      const btn = scope.locator('button:visible:not([disabled])').nth(i);
      if (!(await clickRobust(btn))) continue; // detached/obscured by the time its turn came up — skip, not a failure
      await settle(page);
    }
  }

  expect(errors, `console errors during full interactive sweep:\n${errors.join('\n')}`).toEqual([]);
});

test("interacting with one card's own control never shifts a sibling card's position", async ({ page }) => {
  await page.goto('/');

  for (const tab of TABS) {
    await page.getByText(tab, { exact: true }).click();
    await page.waitForTimeout(300);
    await settle(page);

    const scope = page.getByTestId('main-content-scroll');
    // Card's own root div carries data-ai-layout-auto unconditionally
    // ('true' or 'false') — a reliable, marker for "this is a Card
    // boundary" without needing a dedicated testid on every Card in the
    // demo. Only the top-level ones on this tab; nested Cards (e.g. inside
    // Component Showcase) are a rarer, lower-value case skipped here to
    // keep this sweep's runtime reasonable.
    const cards = scope.locator(':scope > * [data-ai-layout-auto], :scope > [data-ai-layout-auto]');
    const cardCount = await cards.count();
    if (cardCount < 2) continue; // nothing to compare a shift against

    for (let target = 0; target < cardCount; target++) {
      // A fresh box for every card right before this interaction — not the
      // tab's very first snapshot — since an earlier iteration's
      // interaction on a DIFFERENT card may have legitimately grown that
      // card's own height (e.g. it left an Accordion expanded), which
      // pushes later content down the page. That's normal document flow,
      // not the bug this test guards against, so only X/width are checked
      // below (a horizontal shift is never legitimate document flow the
      // way a vertical one can be) — see TabStrip's own fix earlier this
      // session for exactly this failure mode.
      const before: { x: number; width: number }[] = [];
      for (let i = 0; i < cardCount; i++) {
        const box = await cards.nth(i).boundingBox();
        before.push({ x: box?.x ?? 0, width: box?.width ?? 0 });
      }

      const control = cards.nth(target).locator('button:visible:not([disabled]):not([role="tab"])').first();
      if ((await control.count()) === 0) continue;
      if (!(await clickRobust(control))) continue;
      await settle(page);

      for (let i = 0; i < cardCount; i++) {
        if (i === target) continue; // this card's own growth/shrink is expected
        const box = await cards.nth(i).boundingBox();
        expect(box?.x, `tab "${tab}", card ${i} x-position after interacting with card ${target}`).toBeCloseTo(before[i].x, 0);
        expect(box?.width, `tab "${tab}", card ${i} width after interacting with card ${target}`).toBeCloseTo(before[i].width, 0);
      }
    }
  }
});
