import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// The theme-wide `:where(*)` transition rule gives every element a nonzero
// transition-duration. Accordion and Collapsible panels animate by keyframes,
// so Base UI saw both a transition and an animation on them and logged
// "CSS transitions and CSS animations both detected" in dev. Their panel
// classes now set `transition: none`; this guards that.
test('Accordion and Collapsible panels do not trigger Base UI\'s mixed-animation warning', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', m => {
    if (m.text().includes('CSS transitions and CSS animations both detected')) warnings.push(m.text());
  });
  await page.goto('/');

  await gotoTab(page, 'Catalog', 'Accordion');
  await page.getByRole('button', { name: 'How does Event Bus integration work?' }).click();
  await expect(page.getByRole('button', { name: 'Why build on Base UI primitives?' })).toHaveAttribute('aria-expanded', 'false');

  await gotoTab(page, 'Catalog', 'Collapsible');
  const trigger = page.getByRole('button', { name: 'Show advanced options' });
  await trigger.click();
  const panel = page.locator('.ai-collapsible-content').first();
  await expect(panel).toBeAttached();
  await panel.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
  // Pure CSS-animation mode (no competing transition): the close keyframes must still play to the end.
  const exitEnd = panel.evaluate(el => new Promise<string>(resolve => {
    el.addEventListener('animationend', function handler(e) {
      if ((e as AnimationEvent).animationName === 'ai-collapsible-slide-up') {
        el.removeEventListener('animationend', handler);
        resolve('ai-collapsible-slide-up');
      }
    });
  }));
  await trigger.click();
  expect(await exitEnd).toBe('ai-collapsible-slide-up');

  expect(warnings).toEqual([]);
});
