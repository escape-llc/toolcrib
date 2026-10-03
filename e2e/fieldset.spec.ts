import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// #744: a disabled <Fieldset> has to disable every control inside it in a real
// browser, including the ones the native fieldset attribute can't reach: the
// span-based Checkbox and the React Aria date field's segments.

test('disabling a Fieldset disables every kind of field inside it', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'Fieldset');
  const entry = page.locator('#cat-Fieldset');
  const group = entry.getByRole('group', { name: 'Shipping address' });
  await expect(group).toBeVisible();

  const street = group.getByRole('textbox', { name: 'Street' });
  const gift = group.getByRole('checkbox', { name: 'This is a gift' });
  const dateSegment = group.getByRole('spinbutton').first();

  // Enabled to begin with.
  await expect(street).toBeEnabled();
  await expect(gift).not.toHaveAttribute('aria-disabled', 'true');
  await expect(dateSegment).not.toHaveAttribute('aria-disabled', 'true');

  await entry.getByRole('switch', { name: 'Disable the group' }).click();

  await expect(street).toBeDisabled();
  await expect(gift).toHaveAttribute('aria-disabled', 'true');
  await expect(dateSegment).toHaveAttribute('aria-disabled', 'true');

  // A click on the disabled checkbox changes nothing.
  const before = await gift.getAttribute('aria-checked');
  await gift.click({ force: true });
  await expect(gift).toHaveAttribute('aria-checked', before!);

  // And it comes back.
  await entry.getByRole('switch', { name: 'Disable the group' }).click();
  await expect(street).toBeEnabled();
  await expect(gift).not.toHaveAttribute('aria-disabled', 'true');
});
