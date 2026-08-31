import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Covers the CSP nonce framework (src/theme/nonceContext.tsx +
// injectGlobalStyle.ts's nonce param) end-to-end, against demo/main.tsx's
// own dogfooded `nonce: 'demo-csp-nonce'`. Not testable in jsdom by
// construction, same reasoning as responsive-theme.spec.ts: the actual
// claim is "every <style> tag toolcrib creates carries the right nonce
// attribute," which only means something checked against real DOM
// elements a real browser actually created.
//
// Nine separate files thread this value through (ThemeProvider itself,
// plus Accordion/TabStrip/UIGroup/Splitter/Toast/Tooltip/interactionStyles/
// animationKeyframes each reading it via useNonce()) -- a single missed
// call site would silently drop that one component's styling under a real
// strict CSP, with no error, no warning, nothing but a component that
// looks subtly broken. This test exists specifically to catch that.

const NONCE = 'demo-csp-nonce';

// The `.nonce` IDL property, not `getAttribute('nonce')` -- the `nonce`
// *content* attribute is deliberately unreadable via generic attribute
// APIs in modern browsers (security measure against leaking it back out
// via a CSS attribute selector), documented in injectGlobalStyle.ts's own
// comment on why it sets `.nonce =` rather than `setAttribute('nonce', ...)`.
// A test using getAttribute here would always read back empty/null even
// when the implementation is completely correct -- confirmed the hard way,
// see this file's own history.
async function nonceOf(page: import('@playwright/test').Page, id: string) {
  return page.evaluate((elId) => (document.getElementById(elId) as HTMLStyleElement | null)?.nonce ?? null, id);
}

// A real, enforced CSP header -- not baked into demo/index.html or
// vite.config.ts permanently (that risks breaking Vite's own dev-mode HMR
// websocket or other unrelated dev-server behavior for every regular
// contributor session), just injected for this one spec via route
// interception. `style-src 'self' 'nonce-...'` with no `'unsafe-inline'`
// is the actual strict policy this whole feature exists for -- without
// this, the earlier tests only prove the nonce *attribute* gets set, never
// that a real browser's CSP enforcement actually honors it (or that the
// inline-style-via-CSSOM claim from CORE.md's own note survives real
// enforcement, which was reasoned about, not yet verified).
async function withStrictCSP(page: import('@playwright/test').Page) {
  await page.route('**/*', async (route) => {
    const response = await route.fetch();
    const contentType = response.headers()['content-type'] ?? '';
    if (!contentType.includes('text/html')) {
      await route.fulfill({ response });
      return;
    }
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': `style-src 'self' 'nonce-${NONCE}'; script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
      },
    });
  });
}

test('every <style> tag present on initial load carries the configured nonce', async ({ page }) => {
  await page.goto('/');

  // Present unconditionally from ThemeProvider itself, or from components
  // that render somewhere in the always-mounted app chrome (Splitter's own
  // top-level layout, the header's UIGroup/Tooltip). Deliberately excludes
  // 'toolcrib-shared-keyframes' (see the next test) and
  // 'toolcrib-tabstrip-panel-styles' (TabStrip.Panel doesn't mount at all for
  // the default Overview tab -- it's a solo-tab sidebar group, which
  // demo/App.tsx renders with no inner TabStrip; checked separately below
  // once a multi-tab group is actually showing).
  const alwaysPresentIds = [
    'toolcrib-typography-base',
    'toolcrib-interaction-styles',
    'toolcrib-responsive-theme', // present because demo/main.tsx's marginMode is responsive
    'toolcrib-corner-squaring',
    'toolcrib-group-styles',
    'toolcrib-tooltip-animations',
  ];

  for (const id of alwaysPresentIds) {
    // Each of these <style> tags is created inside its owning component's
    // mount effect (a plain useEffect, scheduled after the initial paint),
    // not synchronously during render -- reading this soon after goto()
    // races those effects. Narrow enough that Chromium's own load-event
    // timing never exposed it; WebKit's doesn't leave the same margin
    // (same root cause as this file's other two tests' identical fix).
    await page.waitForSelector(`#${id}`, { state: 'attached' });
    const nonce = await nonceOf(page, id);
    expect(nonce, `#${id}'s nonce attribute`).toBe(NONCE);
  }

  await gotoTab(page, 'Forms & Zod Engine'); // a real multi-tab sidebar group
  const tabPanelNonce = await nonceOf(page, 'toolcrib-tabstrip-panel-styles');
  expect(tabPanelNonce, `#toolcrib-tabstrip-panel-styles's nonce attribute`).toBe(NONCE);
});

test('the shared animation keyframes also carry the configured nonce for the default document', async ({ page }) => {
  // Used to be a documented exception: an eager, no-args call at the
  // bottom of animationKeyframes.ts ran at module-import time, before any
  // ThemeProvider could mount, and won injectGlobalStyle's
  // create-once-per-id dedup before ThemeProvider's own nonce-aware call
  // ever got a chance -- confirmed as a real, browser-enforced CSP
  // violation by this file's own "zero violations" test below, not just a
  // theoretical gap. Removed; ThemeProvider's own mount effect is now the
  // sole injection point (see animationKeyframes.ts's current doc comment
  // for the full history).
  await page.goto('/');
  // The <style id="toolcrib-shared-keyframes"> tag is created inside
  // ThemeProvider's mount effect (a plain useEffect, scheduled after the
  // initial paint), not synchronously during render -- reading it this
  // soon after goto() races that effect. Narrow enough that Chromium's own
  // load-event timing never exposed it; WebKit's doesn't leave the same
  // margin. Wait for the element to actually exist before reading its
  // nonce, rather than trusting goto() alone.
  await page.waitForSelector('#toolcrib-shared-keyframes', { state: 'attached' });
  const nonce = await nonceOf(page, 'toolcrib-shared-keyframes');
  expect(nonce).toBe(NONCE);
});

test('a lazily-mounted component (Toast) also carries the configured nonce once it actually renders', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Toast Subsystem');
  await page.getByRole('button', { name: 'Fire Info Toast' }).click();

  // ToastItemComponent (and its injectToastAnimations call) only exists
  // once a real toast is showing -- confirms the nonce reaches a
  // conditionally-mounted component too, not just ones present at load.
  const nonce = await nonceOf(page, 'toolcrib-toast-animations');
  expect(nonce).toBe(NONCE);
});

test('under a real, enforced strict style-src CSP, toolcrib produces zero violations and still renders correctly', async ({ page }) => {
  // Uses the real SecurityPolicyViolationEvent rather than scraping
  // console message text -- it carries structured detail (sourceFile,
  // effectiveDirective) that pinpoints exactly which script triggered
  // each violation, rather than a browser-specific message string. Routed
  // through `window.name` (a plain string round-trippable via
  // `page.evaluate`) since `page.addInitScript` runs in the page's own
  // isolated world and can't close over a Node-side array directly.
  await page.addInitScript(() => {
    (window as unknown as { __cspViolations: unknown[] }).__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __cspViolations: unknown[] }).__cspViolations.push({
        effectiveDirective: e.effectiveDirective,
        blockedURI: e.blockedURI,
        sourceFile: e.sourceFile,
      });
    });
  });

  await withStrictCSP(page);
  await page.goto('/');
  await gotoTab(page, 'Toast Subsystem');
  await page.getByRole('button', { name: 'Fire Info Toast' }).click();

  // Checked here, before navigating away -- the button only exists on
  // this tab, so this has to run while it's still mounted.
  const buttonBg = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Fire Info Toast'));
    return btn ? getComputedStyle(btn).backgroundColor : null;
  });

  await gotoTab(page, 'Overlays & Actions');

  const allViolations = await page.evaluate(
    () => (window as unknown as { __cspViolations: { effectiveDirective: string; blockedURI: string; sourceFile: string }[] }).__cspViolations
  );
  // `@vite/client` is the dev server's own HMR/error-overlay script -- it
  // isn't part of toolcrib's shipped output and doesn't exist in a real
  // production build (`vite build`), so a violation sourced from it isn't
  // a toolcrib bug. Everything else must be genuinely zero.
  const cspViolations = allViolations.filter((v) => !v.sourceFile?.includes('@vite/client'));

  expect(
    cspViolations,
    `CSP violations under a strict style-src:\n${cspViolations.map((v) => JSON.stringify(v)).join('\n')}`
  ).toEqual([]);

  // Not just "no error" -- confirms the feature genuinely still works
  // under the policy, both halves of CORE.md's CSP note. The nonce'd
  // <style> tag (typography base rule) actually took effect:
  const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(fontFamily).toContain('Inter');

  // And separately -- the more load-bearing half of the claim -- a real
  // component's plain inline `style` prop (Button's own computed
  // background, applied via React's style-prop mechanism, not a
  // nonce'd stylesheet rule at all) still resolved too. This is the
  // specific claim CORE.md's CSP note rests on: React applies `style`
  // via direct CSSOM property assignment rather than writing a literal
  // `style="..."` attribute string, which is why it isn't blocked by
  // style-src-attr enforcement even with no 'unsafe-inline' and no nonce
  // on this element at all.
  expect(buttonBg).not.toBe(null);
  expect(buttonBg).not.toBe('rgba(0, 0, 0, 0)');
});
