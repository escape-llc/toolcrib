import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Real-browser verification of the "living color" ambient breathe/glow
// loop -- jsdom can only assert a CSS string is present (see
// src/__tests__/livingColor.test.ts), never that a @keyframes animation is
// actually running, uses the right timing function, or is genuinely
// disabled under prefers-reduced-motion. No existing spec covered a
// continuous, non-exiting @keyframes loop's real behavior at all before
// this file -- Skeleton/Spinner (the only prior continuous-loop
// components) have no e2e coverage either.

test('an element opted into .ai-living-accent actually runs the shared breathe keyframes', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Feedback & Status');
  // Demo showcase element -- see demo/App.tsx's "Feedback & Status" tab,
  // "Living Color" card.
  const el = page.locator('.ai-living-accent').first();
  await expect(el).toBeVisible();
  const animationName = await el.evaluate(node => getComputedStyle(node).animationName);
  expect(animationName).toBe('ai-color-breathe');
  const iterationCount = await el.evaluate(node => getComputedStyle(node).animationIterationCount);
  expect(iterationCount).toBe('infinite');
});

test('a .ai-living-glow element runs the pulse keyframes with a non-zero duration', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Feedback & Status');
  const el = page.locator('.ai-living-glow').first();
  await expect(el).toBeVisible();
  const animationName = await el.evaluate(node => getComputedStyle(node).animationName);
  expect(animationName).toBe('ai-glow-pulse');
  const duration = await el.evaluate(node => getComputedStyle(node).animationDuration);
  expect(duration).not.toBe('0s');
});

test('prefers-reduced-motion: reduce genuinely disables the living-color animation', async ({ page }) => {
  // Set before goto -- the media feature must already be active when the
  // stylesheet's @media (prefers-reduced-motion: reduce) block first
  // evaluates against the page, not applied after the fact.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await gotoTab(page, 'Feedback & Status');
  const el = page.locator('.ai-living-accent').first();
  await expect(el).toBeVisible();
  const animationName = await el.evaluate(node => getComputedStyle(node).animationName);
  expect(animationName).toBe('none');
});

test('the running animation actually drives background-color over time, not frozen by the ambient theme-change transition', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Feedback & Status');
  const el = page.locator('.ai-living-accent').first();
  await expect(el).toBeVisible();
  // Per CSS cascade semantics, a running `animation` on a property takes
  // precedence over any `transition` targeting that same property on the
  // same element (TOOLCRIB_THEME_TRANSITIONS_CSS's ambient :where(*) rule
  // also covers background-color) -- verify empirically rather than trust
  // the spec citation alone, matching this codebase's own established
  // distrust of assumed-but-unverified CSS interpolation behavior (see
  // Toast.tsx's grid-template-rows-in-@keyframes history).
  const first = await el.evaluate(node => getComputedStyle(node).backgroundColor);
  await page.waitForTimeout(3500);
  const second = await el.evaluate(node => getComputedStyle(node).backgroundColor);
  expect(second).not.toBe(first);
});
