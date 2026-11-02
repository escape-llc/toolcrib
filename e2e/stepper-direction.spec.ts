import { test, expect, type Page } from '@playwright/test';
import { gotoTab } from './nav';

// #740: a Stepper step enters from the direction of travel: Next slides in
// from the right, Back from the left (Base UI's data-activation-direction).
//
// The animation lasts --ai-transition-duration-normal (~220ms), short enough
// to finish before a check reads it under load. Per AGENTS.md's CSS-animation
// rule, stretch the token instead of racing it: with a 60s duration the
// entering panel's animation is reliably still running when we look.

const visiblePanelAnimation = (page: Page) => page.evaluate(() => {
  const panel = Array.from(document.querySelectorAll<HTMLElement>('#cat-Stepper .ai-stepper-panel')).find(p => !p.hidden);
  const running = panel?.getAnimations().find(a => a instanceof CSSAnimation) as CSSAnimation | undefined;
  return { direction: panel?.dataset.activationDirection, animation: running?.animationName ?? null };
});

test('Stepper slides forward on Next and back on Back (#740)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'Stepper');
  await page.evaluate(() => document.documentElement.style.setProperty('--ai-transition-duration-normal', '60s'));
  const stepper = page.locator('#cat-Stepper');

  await stepper.getByRole('button', { name: 'Next' }).click();
  await expect.poll(() => visiblePanelAnimation(page)).toEqual({ direction: 'right', animation: 'ai-stepper-slide-from-right' });

  await stepper.getByRole('button', { name: 'Back' }).click();
  await expect.poll(() => visiblePanelAnimation(page)).toEqual({ direction: 'left', animation: 'ai-stepper-slide-from-left' });
});
