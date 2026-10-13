import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoTab, loadDemoTableData, demoPages } from './nav';

// Automated backstop for the "WCAG AA verified across all components" 1.0
// gate (.plans/toolcrib-roadmap.md) -- turns Discussion #41's one-time
// manual accessibility pass into a standing check re-run on every push.
// This is not a replacement for that manual work: axe-core's ruleset only
// catches the automatable slice of real WCAG issues (contrast, missing
// labels, invalid ARIA, landmark structure) -- keyboard-only flow
// correctness, focus order, and real screen-reader behavior still need a
// human pass and aren't exercised here.
//
// Belongs in e2e/, not the Vitest suite, for the same reason as every other
// spec here (see e2e/README.md): jsdom never runs a real paint pipeline, so
// a jsdom-based axe run would silently skip color-contrast entirely -- the
// single most common AA failure category, and the one most worth checking
// given toolcrib's palette is *generated* (harmonies.ts) with contrast
// enforcement baked into the algorithm.
//
// color-contrast is ON. It used to be disabled rule-wide: axe-core 4.13 could not
// parse the `oklab(...)`/`color(srgb ...)` computed values Chromium produces for
// `color-mix()` and relative-color CSS, and reported false failures. axe-core
// 4.14 reads them correctly (pinned via package.json "overrides" so
// @axe-core/playwright cannot bring its own older copy), and turning the rule
// back on immediately found real defects: the palette's text colors were
// placed exactly on the 4.5:1 boundary in exact HSV, then rounded by
// hsvToCSS and by the browser's 8-bit channels to 4.42:1 on screen, and
// primaryReadable was only checked against the lightest surface. Both fixed
// in hsv.ts/harmonies.ts (ensureRenderedWCAGContrast). Color-contrast
// reads the current pixels, so every scan first waits for finite animations
// to finish (settleAnimations below).

// Base UI's focus guards (#670, #692): a trapped overlay renders sentinel
// <span>s with aria-hidden="true" and tabindex="0", and redirects focus the
// moment one receives it. axe's aria-hidden-focus rule flags each one
// statically. Upstream closed this as not a bug (mui/base-ui#5706, also
// #5237), citing W3C ACT rule 6cfa84 Passed Example 4: focus never rests
// there. Excluding just the guard elements keeps aria-hidden-focus on for
// everything else. e2e/overlay-focus-guards.spec.ts is the runtime half of
// this carve-out: it proves Tab never settles on a guard or any hidden
// element, which axe's static reading can't observe.
const BASE_UI_FOCUS_GUARD = '[data-base-ui-focus-guard]';

/**
 * Waits for every finite animation and transition on the page to finish
 * (the real completion signal, not a sleep). color-contrast reads the
 * pixels' current colors, so an overlay still fading in (opacity ramping
 * 0 to 1) or a color mid-transition measures as a contrast failure that
 * isn't real. Infinite animations (spinners, shimmer) are skipped: they
 * never finish.
 */
async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const finite = () =>
      document
        .getAnimations()
        .filter(a => a.effect && a.effect.getComputedTiming().iterations !== Infinity && a.playState !== 'finished');
    for (let i = 0; i < 5 && finite().length > 0; i++) {
      await Promise.all(finite().map(a => a.finished.catch(() => undefined)));
    }
  });
}

/**
 * Scans every page of the demo (demoPages: Overview, the Catalog index
 * and each component/Systems page, Kits) on whatever theme state the caller
 * already set up -- deliberately doesn't navigate to '/' itself, since dark
 * mode (set by the caller before invoking this) is plain React state with
 * no persistence and would be lost on a reload.
 */
async function scanEveryTab(page: Page): Promise<string[]> {
  const failures: string[] = [];

  for (const { label: tab, go } of await demoPages(page)) {
    await go();
    // The Data Table page's main table starts empty (see demo/App.tsx) --
    // load its real dataset first so this scan covers the actual loaded
    // grid (row checkboxes, tinted/selected rows, sortable headers with
    // real content) instead of just the header row over an empty body,
    // matching the depth of coverage this scan already had before that
    // table stopped loading its data on mount.
    if (tab === 'DataTable') await loadDemoTableData(page);
    // Lets the panel's own entrance transition finish first -- same
    // reasoning as interactive-sweep.spec.ts's identical wait, but on the
    // real completion signal instead of a fixed sleep.
    await settleAnimations(page);
    // gotoTab's own click leaves the real mouse cursor sitting on top of
    // whatever it just clicked, putting that element in a genuine :hover
    // state for the scan that follows -- not a scenario worth testing
    // (a real user's cursor could be anywhere on page load), and it was
    // producing a real false positive here: several `:hover` rules
    // (interactionStyles.ts) use `color-mix()` for their background tint,
    // which Chromium serializes as a `color(srgb ...)` computed value that
    // this axe-core version's contrast checker doesn't parse reliably,
    // reporting a violation even when the actual ratio measures well above
    // 4.5:1 by hand. Moving the mouse off any element first avoids the
    // :hover rule entirely, and matches what a real page load looks like.
    await page.mouse.move(0, 0);
    await settleAnimations(page);

    // .exclude('iframe') -- the Wireframe Gallery tab's tiles each render
    // via a real <iframe srcDoc="...">/portaled-live-iframe (demo/App.tsx's
    // own LiveIframe), and axe-core-playwright's cross-frame scanning
    // started hanging INDEFINITELY on this exact tab immediately after a
    // routine Dependabot bump (@playwright/test 1.62.1 -> 1.63.0, PR #440)
    // landed on main -- confirmed by direct investigation, not assumed:
    // isolating the scan to only this one tab reproduced a genuine hang
    // (not just slowness) locally in well under this test's own 120s
    // budget, and adding this exact `.exclude('iframe')` call independently
    // brought that same isolated scan down to ~300ms. Every OTHER tab timed
    // well under a second each. Scoped as a permanent, unconditional
    // exclude (not just for the Wireframe Gallery tab) since it's a no-op
    // for every other tab (none of them use iframes) and there's nothing
    // this scan needs to check inside a wireframe iframe anyway -- these
    // tiles are deliberately isolated, non-themed static/demo content with
    // a fixed flat palette (see this file's own WIREFRAME_STYLE-adjacent
    // comment in demo/App.tsx), not part of the live theme system this
    // scan otherwise cares about; the couple of LIVE-iframe tiles'
    // real components (Splitter, TabStrip) already have their own direct
    // component-level accessibility coverage elsewhere in this suite.
    // Root cause not chased further than this -- likely a real
    // axe-core-playwright/Playwright 1.63.0 frame-lifecycle incompatibility,
    // worth re-checking (and potentially removing this exclude) once a
    // newer @axe-core/playwright ships and confirms it's fixed there,
    // rather than assumed permanent.
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .exclude('iframe')
      .exclude(BASE_UI_FOCUS_GUARD)
      .analyze();
    for (const violation of results.violations) {
      const targets = violation.nodes.map(n => n.target.join(' ')).join(', ');
      failures.push(`[${tab}] ${violation.id} (${violation.impact}): ${violation.help} -- ${targets}`);
    }
  }

  return failures;
}

test('every tab has zero automatable WCAG 2.1 AA violations in light mode', async ({ page, browserName }) => {
  // @axe-core/playwright's own analyze() repeatedly injects and runs a
  // large in-page script -- 12 tabs' worth of full-DOM scans in a single
  // page session reliably crashes WebKit's renderer process partway
  // through (a real "browserContext.newPage: Target page, context or
  // browser has been closed" failure, not a timeout from slowness --
  // confirmed the crash happens mid-run, not from this test being too
  // slow to finish). This is a known class of instability in axe-core's
  // WebKit support, not a toolcrib WCAG finding or a real cross-engine
  // behavioral difference (unlike :focus-visible/color-mix(), where
  // WebKit's divergence from Chromium is the actual point of testing a
  // second engine at all) -- Chromium-only for this spec until axe-core's
  // own WebKit support is more stable; re-test before removing this skip.
  test.skip(browserName === 'webkit', 'axe-core repeatedly crashes WebKit across a 12-tab scan -- see comment');
  // ~95 scans since issue #624 split the Catalog into one page per
  // component -- each small, but the count grew with it.
  test.setTimeout(300_000);
  await page.goto('/');

  const failures = await scanEveryTab(page);
  expect(failures, `WCAG AA violations (light mode):\n${failures.join('\n')}`).toEqual([]);
});

async function runAxe(page: Page, extraDisabledRules: string[] = []) {
  await settleAnimations(page);
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .disableRules(extraDisabledRules)
    .exclude(BASE_UI_FOCUS_GUARD)
    .analyze();
}

test('overlay content unreachable by the tab sweep has zero automatable WCAG 2.1 AA violations', async ({ page }) => {
  // scanEveryTab() above only ever sees each tab's *closed* state -- every
  // Popup/Drawer/Modal/AlertDialog/Collapsible/ContextMenu/CommandPalette/
  // HoverCard on these two tabs renders its real content into the DOM only
  // once opened, so none of it was ever actually scanned by axe before this
  // test existed (see aria-compliance-review's own §1 finding). One overlay
  // open at a time, scanned, then closed (Escape closes basically everything
  // in this codebase -- see interactive-sweep.spec.ts's identical note) --
  // never two overlapping, to keep each scan attributable to one component.
  //
  // Issue #423: bumped from 60_000 to 120_000, matching the other two
  // heavy axe-scan tests in this file (the full 12-tab light/dark sweeps).
  // This test opens/scans/closes 7 real overlays across two tabs -- flaked
  // repeatedly under real CI load (5+ occurrences this session, always
  // WebKit, always right at the old 60s budget: a click timeout in one
  // run, a `frame.evaluate` timeout mid-axe-scan in another). Each axe
  // scan itself takes real wall-clock time under CI's own resource
  // constraints, so this is a genuine cumulative-work budget adjustment,
  // not a guessed-wait fix -- every wait in this test already targets a
  // real signal (see AGENTS.md's e2e section from issue #413).
  test.setTimeout(120_000);
  await page.goto('/');
  const failures: string[] = [];

  const scanNamed = async (label: string, extraDisabledRules: string[] = []) => {
    const results = await runAxe(page, extraDisabledRules);
    for (const violation of results.violations) {
      const targets = violation.nodes.map(n => n.target.join(' ')).join(', ');
      failures.push(`[${label}] ${violation.id} (${violation.impact}): ${violation.help} -- ${targets}`);
    }
  };

  await gotoTab(page, 'Catalog', 'Popup');

  // One component per Catalog page (issue #624): each overlay's trigger
  // is only mounted on its own component's page, so navigate before each.
  await page.getByRole('button', { name: 'Toggle Popup Menu' }).click();
  await scanNamed('Popup (Overlays tab)');
  await page.keyboard.press('Escape');

  await gotoTab(page, 'Catalog', 'Drawer');
  await page.getByRole('button', { name: 'Open Drawer' }).click();
  await scanNamed('Drawer');
  await page.keyboard.press('Escape');
  // Drawer closes on its own 250ms JS timer; its backdrop blocks the page
  // until then.
  await expect(page.getByTestId('drawer-backdrop')).not.toBeAttached();

  await gotoTab(page, 'Catalog', 'Modal');
  await page.getByRole('button', { name: 'Open Modal Dialog' }).click();
  await scanNamed('Modal');

  // aria-compliance-review's own §1 finding (issue #262): nested Modal
  // content only renders once its own trigger is clicked -- never scanned
  // before now. Functional nested-overlay behavior (Escape closes only the
  // inner dialog, z-index/paint order) is already independently verified
  // by zindex-stress.spec.ts, so this is markup-scan coverage only.
  await page.getByRole('button', { name: 'Open Nested Modal' }).click();
  await scanNamed('Modal (nested)');
  await page.keyboard.press('Escape'); // closes the inner modal only
  // The inner dialog's own exit animation (--ai-transition-duration-normal,
  // 0.2s) has to actually finish -- the dialog's Presence keeps its focus scope
  // mounted until then, and an Escape pressed before that settles gets
  // swallowed rather than reaching the now-topmost outer dialog. Confirmed
  // directly: without this wait, the outer dialog was still open (and
  // "Open Command Palette" unreachable) after this second Escape.
  //
  // De-flaked (issue #413): a fixed `waitForTimeout(300)` raced that exit
  // animation + Presence teardown directly -- under real CI scheduling
  // (WebKit specifically), 300ms of wall-clock time wasn't always enough,
  // so this flaked with the exact symptom the comment above already
  // predicted ("Open Command Palette" unreachable), just intermittently
  // rather than always. Waiting for the inner dialog to actually be gone
  // -- its own already-distinct accessible name (`aria-label="Nested
  // Confirmation"`, demo/App.tsx) needs no new DOM markers -- is a real
  // completion signal instead of a wall-clock guess, the same principle
  // this repo's own animationend-listener e2e tests already establish
  // (see toast-animation.spec.ts).
  await expect(page.getByRole('dialog', { name: 'Nested Confirmation' })).not.toBeAttached();
  await page.keyboard.press('Escape'); // closes the outer modal
  await expect(page.getByTestId('modal-container')).toHaveCount(0);

  await gotoTab(page, 'Catalog', 'CommandPalette');
  await page.getByRole('button', { name: 'Open Command Palette' }).click();
  await scanNamed('CommandPalette');
  await page.keyboard.press('Escape');

  await gotoTab(page, 'Forms & Zod Engine');

  // aria-compliance-review's own §1 finding (issue #262): neither
  // DatePicker instance's calendar popover has ever been scanned while
  // open -- content only renders once its own trigger is clicked. Two
  // real instances: the Zod-validated "Start Date" field wired into the
  // Form page's form, and the standalone "Meeting Date" demo on
  // DatePicker's own page.
  await page.getByRole('button', { name: 'Open calendar' }).first().click();
  await scanNamed('DatePicker calendar popover (Start Date, form-wired)');
  await page.keyboard.press('Escape');

  // aria-compliance-review's own §1 finding (issue #262): every <Select>
  // instance's dropdown was never scanned. Unlike
  // Combobox (whose two demo instances genuinely differ -- async search
  // vs. static multi-select), Select.tsx's Content/Item markup has no
  // conditional branches driven by instance props, so one representative,
  // properly-labeled instance covers the real gap.
  //
  // No aria-hidden-focus carve-out (#697). The select-only combobox hides
  // nothing, and Base UI's focus guards are excluded globally (see
  // BASE_UI_FOCUS_GUARD).
  await page.getByRole('combobox', { name: 'Role Level' }).click();
  await scanNamed('Select (Role Level dropdown)');
  await page.keyboard.press('Escape');

  await gotoTab(page, 'Catalog', 'DatePicker');
  await page.getByRole('button', { name: 'Open calendar' }).first().click();
  await scanNamed('DatePicker calendar popover (Meeting Date, standalone)');
  await page.keyboard.press('Escape');

  // aria-compliance-review (v0.16.0 pre-release pass, #830): two overlays no
  // scan ever had open. DateRangePicker's popover is a RangeCalendar, markup
  // DatePicker's single-date popover doesn't exercise; Tooltip's popup was
  // never hovered at all.
  await gotoTab(page, 'Catalog', 'DateRangePicker');
  await page.getByRole('button', { name: 'Open calendar' }).first().click();
  await scanNamed('DateRangePicker calendar popover (Trip Dates)');
  await page.keyboard.press('Escape');

  await gotoTab(page, 'Catalog', 'Tooltip');
  await page.getByRole('button', { name: 'Hover For Tooltip' }).hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await scanNamed('Tooltip popup (hovered)');
  await page.mouse.move(0, 0);

  await gotoTab(page, 'Catalog', 'UIGroup');

  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await scanNamed('Popup (Component Showcase tab)');
  await page.keyboard.press('Escape');

  await gotoTab(page, 'Catalog', 'Accordion');

  // aria-compliance-review's own §1 finding (issue #262): Accordion's
  // second panel (`defaultValue="faq-1"` leaves only the first item's
  // content in the DOM) has never been scanned while expanded -- low
  // risk (static paragraph text only), but a real gap in the coverage
  // inventory. type="single" means expanding faq-2 auto-collapses faq-1.
  const faq1Trigger = page.getByRole('button', { name: 'Why build on Base UI primitives?' });
  await page.getByRole('button', { name: 'How does Event Bus integration work?' }).click();
  // Issue #570: the click above resolves as soon as the pointer event is
  // dispatched, not once the single-select switch has actually committed to
  // the DOM -- an assumption that held under normal local timing but isn't
  // guaranteed under real CI scheduling. Waiting for the real signal
  // (faq-1 actually reporting collapsed) before continuing turns a
  // possible hang into either a pass or a fast, readable failure -- same
  // "wait for a real signal" discipline as every other overlay wait here.
  await expect(faq1Trigger).toHaveAttribute('aria-expanded', 'false');
  await scanNamed('Accordion (second panel expanded)');
  await faq1Trigger.click(); // collapse again, leave state as found

  await gotoTab(page, 'Catalog', 'AlertDialog');
  await page.getByText('Blocking Confirmation').locator('..').getByRole('button', { name: /Delete Record/ }).click();
  await scanNamed('AlertDialog');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('alertdialog-container')).toHaveCount(0);

  await gotoTab(page, 'Catalog', 'Collapsible');
  await page.getByText('Show advanced options').click();
  await scanNamed('Collapsible (expanded)');
  await page.getByText('Show advanced options').click(); // collapse again, leave state as found

  // No aria-hidden-focus carve-out (#700). Base UI's menus hide nothing,
  // and its focus guards are excluded globally (see BASE_UI_FOCUS_GUARD).
  await gotoTab(page, 'Catalog', 'DropdownMenu');
  await page.getByRole('button', { name: 'User Actions Menu' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await scanNamed('DropdownMenu');
  await page.keyboard.press('Escape');

  await gotoTab(page, 'Catalog', 'ContextMenu');
  await page.getByText('Right-click this area').click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
  await scanNamed('ContextMenu');
  await page.keyboard.press('Escape');

  await gotoTab(page, 'Catalog', 'Combobox');

  // aria-compliance-review's own §1 finding: Combobox's real listbox
  // markup (both instances) was never axe-scanned -- its content only
  // renders once `open` is true, and no prior test ever typed into or
  // clicked either demo instance.
  await page.getByPlaceholder('Search users...').fill('a');
  // 300ms debounce (searchDebounceMs) + 200ms simulated server round-trip,
  // plus margin -- see the Combobox demo's own onSearch above.
  await page.waitForTimeout(700);
  await scanNamed('Combobox (async search)');
  await page.keyboard.press('Escape');

  // Static `options`, no onSearch -- opens immediately on click (see
  // Combobox.tsx's own onClick, exempted from the async-only guard). Its
  // own placeholder never renders (defaultValue already has 2 chips
  // selected, and Combobox.tsx's placeholder={hasValue && multiple ?
  // undefined : placeholder} suppresses it whenever that's true) -- the
  // demo's own aria-label="Skills" is the reliable locator instead.
  await page.getByRole('combobox', { name: 'Skills' }).click();
  await scanNamed('Combobox (multi-select)');
  await page.keyboard.press('Escape');

  await gotoTab(page, 'Catalog', 'HoverCard');
  // Opened by hover. Base UI also opens it on keyboard focus, but only when
  // the trigger matches :focus-visible, and whether a test's synthetic focus
  // counts differs by engine (it opened in Chromium and Windows WebKit, not
  // Linux WebKit in CI). Hover is the same in every engine, and the scan
  // only needs the card's content mounted.
  const trigger = page.getByRole('link', { name: '@janedoe' });
  await trigger.hover();
  await expect(page.getByRole('button', { name: 'View profile' })).toBeVisible(); // openDelay={150} on this instance
  await scanNamed('HoverCard');

  // aria-compliance-review §4: HoverCard content is supplemental and not in
  // the Tab order (use <Popup> when it must be keyboard-operable).
  // On Base UI's PreviewCard (#700) the card is portaled to the end of
  // <body>, so Tab from the trigger moves on through the page. This locks
  // that in: with the card open, Tab from its trigger never lands inside it.
  await trigger.focus();
  await page.keyboard.press('Tab');
  const focusInsideCard = await page.evaluate(() => Boolean(document.activeElement?.closest('.ai-hovercard-content')));
  expect(focusInsideCard, 'Tab from the HoverCard trigger moved focus into the card').toBe(false);
  await page.mouse.move(0, 0);

  // aria-compliance-review's own §4 finding: the dark-mode test below opens
  // this same Theme Designer drawer only long enough to click its
  // light/dark toggle, then immediately Escapes -- its ThemeEditor content
  // (the exact component the FieldRow label-association bug, fixed in
  // commit fb041d7, once lived inside) has never actually been scanned
  // while genuinely open. Reachable from every tab (the sidebar's own
  // trigger), so no gotoTab needed first.
  await page.getByRole('button', { name: 'Open Theme Designer' }).click();
  await scanNamed('Theme Designer drawer (ThemeEditor content)');
  await page.keyboard.press('Escape');
  // Drawer's own 250ms JS close timer, not a real animationend -- see the
  // dark-mode test's identical wait below.
  await page.waitForTimeout(300);

  expect(failures, `WCAG AA violations (overlay content):\n${failures.join('\n')}`).toEqual([]);
});

test('every tab has zero automatable WCAG 2.1 AA violations in dark mode', async ({ page, browserName }) => {
  // See the light-mode test's identical skip above for why.
  test.skip(browserName === 'webkit', 'axe-core repeatedly crashes WebKit across a 12-tab scan -- see comment');
  // ~95 scans since issue #624 split the Catalog into one page per
  // component -- each small, but the count grew with it.
  test.setTimeout(300_000);
  await page.goto('/');

  // No direct dark-mode toggle in the demo chrome itself -- only reachable
  // through the Theme Designer drawer's own light/dark Button
  // (ThemeEditor.tsx), the same control a real user would use.
  await page.getByRole('button', { name: 'Open Theme Designer' }).click();
  await page.getByRole('button', { name: /Light Mode|Dark Mode/ }).click();
  await page.keyboard.press('Escape');
  // Drawer closes via its own 250ms JS timer, not a real animationend (see
  // interactive-sweep.spec.ts's `settle` comment) -- its backdrop blocks
  // clicks on the sidebar underneath until that timer finishes.
  await page.waitForTimeout(300);

  const failures = await scanEveryTab(page);
  expect(failures, `WCAG AA violations (dark mode):\n${failures.join('\n')}`).toEqual([]);
});

test('more surfaces a closed-state scan never sees (#830): viewer, toast, DataTable popups and editing, Catalog collapsers, ThemeEditor popups, collapsed sidebar, other modes', async ({ page }) => {
  // Same shape as the overlay test above: one surface open at a time,
  // scanned, then closed, so a failure names the surface it came from.
  test.setTimeout(180_000);
  await page.goto('/');
  const failures: string[] = [];
  const scanNamed = async (label: string) => {
    const results = await runAxe(page);
    for (const violation of results.violations) {
      const targets = violation.nodes.map(n => n.target.join(' ')).join(', ');
      failures.push(`[${label}] ${violation.id} (${violation.impact}): ${violation.help} -- ${targets}`);
    }
  };

  // Gallery -> Viewer: a fullscreen Modal with its own zoom/prev/next chrome.
  await gotoTab(page, 'Catalog', 'Gallery');
  await page.getByRole('button', { name: /^(?!.*(Show|Hide)).*/ }).filter({ has: page.locator('img, [role="img"]') }).first().click();
  await expect(page.getByRole('dialog', { name: 'Media viewer' })).toBeVisible();
  await scanNamed('Gallery Viewer (open)');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Media viewer' })).not.toBeAttached();

  // A visible toast: the group, the live regions and the dismiss control.
  await gotoTab(page, 'Catalog', 'CardSimple');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByTestId('toast-item').getByText('Refreshed!')).toBeVisible();
  await scanNamed('Toast (visible)');

  // DataTable: the Columns menu, then a row in edit mode (the edit co-grid).
  await gotoTab(page, 'Catalog', 'DataTable');
  await loadDemoTableData(page);
  await page.getByRole('button', { name: 'Columns' }).click();
  await scanNamed('DataTable Columns menu');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await scanNamed('DataTable edit co-grid (row in edit mode)');
  await page.getByRole('button', { name: 'Cancel' }).first().click();

  // Catalog spec-sheet collapsers, each closed on every swept page.
  await gotoTab(page, 'Catalog', 'Card');
  for (const name of [/^Props/, /^Slots/, /^Blueprint/]) {
    const trigger = page.getByRole('button', { name }).first();
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await scanNamed(`Catalog collapser ${String(name)} (open)`);
  }

  // Sidebar in its icon-only collapsed state.
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  await scanNamed('Sidebar (collapsed)');
  await page.getByRole('button', { name: 'Expand sidebar' }).click();

  // Combobox multi-select after a chip has been removed (the chip row and
  // its remove buttons change shape; only the default two chips were scanned).
  await gotoTab(page, 'Catalog', 'Combobox');
  await page.getByRole('button', { name: /^Remove /i }).first().click();
  await scanNamed('Combobox multi-select (a chip removed)');

  // The two popups inside the Theme Designer drawer.
  await page.getByRole('button', { name: 'Open Theme Designer' }).click();
  await page.getByRole('button', { name: 'Theme presets' }).click();
  await scanNamed('Theme Designer preset popup');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save current theme' }).click();
  await scanNamed('Theme Designer save-theme popup');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  // The drawer closes on its own JS timer; its dialog leaving the DOM is the signal.
  await expect(page.getByRole('dialog')).toHaveCount(0);

  expect(failures, `WCAG AA violations (more surfaces):\n${failures.join('\n')}`).toEqual([]);
});
