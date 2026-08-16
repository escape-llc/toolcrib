import { test, expect } from '@playwright/test';

// Same rationale as toast-animation.spec.ts: whether a real `animation`
// actually resolves and plays is invisible to jsdom (no layout/paint
// pipeline at all), so this can only be verified in a real browser (see
// e2e/README.md's "real CSS animations" scope).
//
// Worth knowing while reading these: Modal's `ai-scale-in`/`ai-fade-in` and
// Accordion's `ai-accordion-slide-down` keyframes are defined in
// demo/index.css, not injected by the library itself the way Toast's and
// Tooltip's are (see Toast.tsx's injectToastAnimations()). That's fine for
// this demo app, but it does mean a consumer who mounts <Modal>/<Accordion>
// without also carrying over those keyframes gets a component that
// silently renders with no entrance animation at all — a real gap, just a
// separate one from what these tests check.

test('opening a Modal plays its ai-scale-in entrance animation', async ({ page }) => {
  await page.goto('/');
  await page.getByText('🪟 Overlays (Popup / SlideOut / Modal)', { exact: true }).click();
  await page.getByRole('button', { name: 'Open Modal Dialog' }).click();

  const modal = page.getByTestId('modal-container');
  await modal.waitFor({ state: 'visible', timeout: 2000 });

  const animationName = await modal.evaluate(el => getComputedStyle(el).animationName);
  expect(animationName).toBe('ai-scale-in');
});

test('expanding an Accordion item plays its ai-accordion-slide-down animation', async ({ page }) => {
  await page.goto('/');
  await page.getByText('🧩 Component Showcase', { exact: true }).click();

  // faq-1 is open by default (defaultValue) — faq-2 starts closed, so
  // clicking it is a real closed-to-open transition, not just a fresh
  // mount already in the open state.
  const closedPanel = page.getByTestId('accordion-content-faq-2');
  await expect(closedPanel).toHaveAttribute('data-state', 'closed');

  await page.getByText('How does Event Bus integration work?').click();

  const openPanel = page.getByTestId('accordion-content-faq-2');
  await expect(openPanel).toHaveAttribute('data-state', 'open');
  const animationName = await openPanel.evaluate(el => getComputedStyle(el).animationName);
  expect(animationName).toBe('ai-accordion-slide-down');
});
