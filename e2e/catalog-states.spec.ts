import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// The Catalog's "States" taxonomy (demo/stateExamples.tsx): each control shows
// its default / focused / disabled / invalid / read-only renderings side by
// side so a state that looks wrong or inconsistent stands out. These checks
// make sure the examples really are in those states, not just labelled so.

test.describe('Catalog states taxonomy', () => {
  test('Input shows every state, and each really is in it', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Catalog', 'Input');
    const states = page.locator('[data-catalog-states="Input"]');
    await expect(states).toBeVisible();

    const disabled = states.getByLabel('Disabled');
    await expect(disabled).toBeDisabled();
    // Dimmed and not-allowed, like Select and Checkbox (the look that was missing).
    await expect(disabled).toHaveCSS('cursor', 'not-allowed');
    await expect(disabled).toHaveCSS('opacity', '0.6');

    await expect(states.getByLabel('Read-only')).toHaveAttribute('readonly', '');
    // Submitted on mount by the example, so the form shows its error.
    await expect(states.getByLabel('Invalid')).toHaveAttribute('aria-invalid', 'true');
    // The focused example draws the ring without taking real focus.
    const focused = states.getByLabel('Focused');
    await expect(focused).not.toBeFocused();
    await expect(focused).not.toHaveCSS('outline-color', 'rgba(0, 0, 0, 0)');
    await expect(states.getByLabel('Default')).toHaveCSS('outline-color', 'rgba(0, 0, 0, 0)');
  });

  test('Checkbox dims its label along with the box when disabled', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Catalog', 'Checkbox');
    const label = page.locator('[data-catalog-states="Checkbox"]').getByText('Disabled', { exact: true }).first();
    await expect(label).toHaveCSS('opacity', '0.6');
  });
});
