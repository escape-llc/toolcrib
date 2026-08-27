import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

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
  await gotoTab(page, 'Overlays & Actions');
  await page.getByRole('button', { name: 'Open Modal Dialog' }).click();

  const modal = page.getByTestId('modal-container');
  await modal.waitFor({ state: 'visible', timeout: 2000 });

  const animationName = await modal.evaluate(el => getComputedStyle(el).animationName);
  expect(animationName).toBe('ai-scale-in');
});

test('opening an AlertDialog plays its ai-fade-in/ai-scale-in entrance animations', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Component Showcase');
  // Two "Delete Record" buttons exist on this tab (the Button Subsystem
  // showcase's own danger-variant example, and this AlertDialog's real
  // trigger) -- scoping by the section heading picks the actual trigger
  // rather than depending on DOM order between them.
  await page.getByText('Blocking Confirmation').locator('..').getByRole('button', { name: /Delete Record/ }).click();

  const dialog = page.getByTestId('alertdialog-container');
  await dialog.waitFor({ state: 'visible', timeout: 2000 });
  const animationName = await dialog.evaluate(el => getComputedStyle(el).animationName);
  expect(animationName).toBe('ai-scale-in');
});

test('expanding an Accordion item plays its ai-accordion-slide-down animation', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Component Showcase');

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

test('opening a Drawer plays its entrance animations and closing plays real exit animations before removal', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Overlays & Actions');

  await page.getByRole('button', { name: 'Open Drawer', exact: true }).click();

  const panel = page.getByRole('dialog');
  await panel.waitFor({ state: 'visible', timeout: 2000 });
  const panelAnimationName = await panel.evaluate(el => getComputedStyle(el).animationName);
  expect(panelAnimationName).toBe('ai-slide-in-right');

  const backdrop = page.locator('[role="presentation"]');
  const backdropAnimationName = await backdrop.evaluate(el => getComputedStyle(el).animationName);
  expect(backdropAnimationName).toBe('ai-fade-in');

  // Regression test: this Drawer used to drive its own mount lifecycle off
  // a hand-rolled onAnimationEnd on the backdrop, filtered only by
  // animationName -- but animationend bubbles through the *React* tree
  // (not the DOM tree) across a portal boundary, and a <Tooltip> rendered
  // inside this Drawer reuses the same 'ai-fade-out' keyframe name for its
  // own exit animation. Un-hovering the Tooltip-wrapped button below used
  // to bubble a matching animationend up to the Drawer's own handler and
  // close it -- reported directly, reproduced exactly by this sequence.
  // Fixed by migrating to Radix's Presence, which listens on the real DOM
  // node directly (event.target === node) rather than via bubbling.
  const regressionButton = page.getByRole('button', { name: 'Hover me (regression check)' });
  await regressionButton.hover();
  await page.getByRole('tooltip', { name: /must not close the drawer/ }).waitFor({ state: 'visible', timeout: 2000 });
  await page.mouse.move(10, 10);
  await expect(panel).toBeVisible({ timeout: 1000 });
  await expect(panel).toBeVisible(); // still open a moment later -- not just mid-close

  // Real close, from a fresh open/close animationend listener installed
  // before triggering it -- see toast-animation.spec.ts's identical
  // reasoning for why this beats polling data-state.
  const exitAnimationEndPromise = backdrop.evaluate(el => new Promise<string>(resolve => {
    el.addEventListener('animationend', function handler(e) {
      if ((e as AnimationEvent).animationName === 'ai-fade-out') {
        el.removeEventListener('animationend', handler);
        resolve((e as AnimationEvent).animationName);
      }
    });
  }));
  await page.getByRole('button', { name: 'Close Drawer' }).click();
  expect(await exitAnimationEndPromise).toBe('ai-fade-out');
  await expect(panel).not.toBeAttached({ timeout: 2000 });
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
