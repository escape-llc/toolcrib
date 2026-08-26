import { test, expect } from '@playwright/test';

// Covers the responsive-breakpoint theme framework (src/theme/responsive.ts)
// end-to-end, at a real viewport, against demo/main.tsx's own dogfooded
// config (`marginMode: { base: 'compact', lg: 'normal' }`). Not testable in
// jsdom by construction — jsdom never evaluates real @media rules against a
// real viewport, so a jsdom test could only assert the generated CSS
// *string* (already covered by src/__tests__/responsive.test.ts), never
// that the browser's cascade actually applies it. That distinction matters
// concretely here: ThemeProvider's own CSS-variable injection sets an
// INLINE style on :root, and an inline style always beats any stylesheet
// rule regardless of @media/specificity — so the one way this feature can
// silently do nothing is if a responsive-controlled variable is *also*
// left set inline. The inline-value assertions below exist specifically to
// catch that failure mode, not just to double-check the visible number.

const COMPACT_MARGIN_MD = '0.625rem'; // src/theme/margin.ts's 'compact' value
const NORMAL_MARGIN_MD = '0.875rem'; // src/theme/margin.ts's 'normal' value
const BELOW_LG = { width: 900, height: 800 }; // demo's lg threshold is 1024px
const ABOVE_LG = { width: 1280, height: 800 };

async function readMarginMd(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
    computed: getComputedStyle(document.documentElement).getPropertyValue('--ai-margin-md').trim(),
    inline: document.documentElement.style.getPropertyValue('--ai-margin-md').trim(),
  }));
}

test('a responsive marginMode config resolves to its base tier below the configured breakpoint, entirely via CSS -- never inline', async ({ page }) => {
  await page.setViewportSize(BELOW_LG);
  await page.goto('/');

  const result = await readMarginMd(page);
  expect(result.computed).toBe(COMPACT_MARGIN_MD);
  expect(result.inline).toBe(''); // the load-bearing assertion -- see header comment
});

test('the same config resolves to its overridden tier above the configured breakpoint, and back again on resize -- live re-matching, not a value baked in once at load', async ({ page }) => {
  await page.setViewportSize(ABOVE_LG);
  await page.goto('/');

  const wide = await readMarginMd(page);
  expect(wide.computed).toBe(NORMAL_MARGIN_MD);
  expect(wide.inline).toBe('');

  await page.setViewportSize(BELOW_LG);
  const narrow = await readMarginMd(page);
  expect(narrow.computed).toBe(COMPACT_MARGIN_MD);
  expect(narrow.inline).toBe('');
});
