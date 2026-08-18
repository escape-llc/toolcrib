import { test, expect } from '@playwright/test';

// Same rationale as toast-animation.spec.ts: whether a real `animation`
// actually resolves and plays is invisible to jsdom (no layout/paint
// pipeline at all), so this can only be verified in a real browser (see
// e2e/README.md's "real CSS animations" scope).
//
// Every animation exercised in this file is self-injected by the library
// itself, not carried by demo/index.css — Modal's ai-scale-in/ai-fade-in
// (and every other component's shared entrance/exit keyframes) come from
// injectSharedAnimationKeyframes(), called from ThemeProvider itself, and
// Accordion's ai-accordion-slide-down from its own injectAccordionStyles().
// A consumer who mounts any of these components gets working animations
// with zero extra CSS to carry over.

test('opening a Modal plays its ai-scale-in entrance animation', async ({ page }) => {
  await page.goto('/');
  await page.getByText('🪟 Overlays (Popup / Drawer / Modal)', { exact: true }).click();
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

test('a Tooltip plays real entrance/exit animations and is cleanly removed after, never stuck', async ({ page }) => {
  // Regression test: this component used to reference a keyframe name
  // (ai-popup-fade) that didn't exist anywhere, so Presence's wait-for-
  // animationend never resolved and the tooltip stayed mounted and fully
  // visible forever after hovering away — reported directly. Fixed by
  // injecting a real, data-state-conditioned stylesheet (see Tooltip.tsx's
  // own injectTooltipAnimations comment for why a static inline `animation`
  // string can't express "different animation in vs. out" for a node that
  // persists across the state change).
  await page.goto('/');

  const trigger = page.getByRole('button', { name: 'Export JSONL' });
  await trigger.hover();

  const tooltip = page.getByRole('tooltip', { name: /Download the captured events/ });
  await tooltip.waitFor({ state: 'visible', timeout: 2000 });

  const openInfo = await tooltip.evaluate(el => ({
    animationName: getComputedStyle(el).animationName,
    dataState: el.getAttribute('data-state'),
  }));
  expect(openInfo.animationName).toBe('ai-fade-in');
  expect(['delayed-open', 'instant-open']).toContain(openInfo.dataState);

  // Filtered, not { once: true } on the raw event — see toast-animation.spec.ts's
  // own identical comment: the entrance animation's own animationend would
  // otherwise resolve this with the wrong name.
  const exitAnimationEndPromise = tooltip.evaluate(el => new Promise<string>(resolve => {
    el.addEventListener('animationend', function handler(e) {
      if ((e as AnimationEvent).animationName === 'ai-fade-out') {
        el.removeEventListener('animationend', handler);
        resolve((e as AnimationEvent).animationName);
      }
    });
  }));

  await page.mouse.move(10, 10); // move away from the trigger to close it
  expect(await exitAnimationEndPromise).toBe('ai-fade-out');
  await expect(tooltip).not.toBeAttached({ timeout: 2000 });
});
