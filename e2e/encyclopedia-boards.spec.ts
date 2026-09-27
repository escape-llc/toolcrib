import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// #680: the Fixtures board (Systems as a second shadow board, in its own
// style domain) and the last-visited marker on both boards.

test('going back to the board marks the tool you just visited, in view', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Encyclopedia');
  const board = page.getByTestId('main-content-scroll');
  await expect(board.locator('[data-last-visited]')).toHaveCount(0);

  // The index has its breadcrumb too: one crumb, the current page, not a link.
  await expect(board.getByText('Encyclopedia', { exact: true })).toBeVisible();
  await expect(board.getByRole('link', { name: 'Encyclopedia', exact: true })).toHaveCount(0);

  // A tool near the bottom of the board, so "in view" means it was scrolled to.
  await board.locator('a[href="#/encyclopedia/Toggle"]').click();
  await expect(page.locator('#enc-Toggle')).toBeVisible();
  // The category crumb has no page of its own: plain text, not an inert link.
  await expect(board.getByText('Form Controls', { exact: true }).first()).toBeVisible();
  await expect(board.getByRole('link', { name: 'Form Controls', exact: true })).toHaveCount(0);
  await expect(board.getByRole('link', { name: 'Encyclopedia', exact: true })).toHaveCount(1);
  await page.goBack();

  const tile = board.locator('a[href="#/encyclopedia/Toggle"]');
  await expect(tile).toHaveAttribute('data-last-visited', '');
  await expect(tile).toContainText('last visited');
  await expect(tile).toBeInViewport();
  await expect(board.locator('[data-last-visited]')).toHaveCount(1);
});

test('the spec sheet carries the slots, with prop and slot counts as badges', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Encyclopedia', 'Card');
  const card = page.locator('#enc-Card');
  const trigger = card.getByRole('button', { name: /^Spec sheet/ });
  await expect(trigger).toContainText(/\d+ props?/);
  await expect(trigger).toContainText(/\d+ slots?/);
  // Slots moved into the spec sheet: not on the card until it's opened.
  await expect(card.getByText('Card.Header')).toBeHidden();
  await trigger.click();
  // Slots are a table in the same form as the props: slot, its own props, description.
  const slots = card.getByRole('region', { name: 'Spec sheet: slots' });
  const header = slots.getByRole('row').filter({ hasText: 'Card.Header' });
  await expect(header).toContainText('paddingMode');
  await expect(header).toContainText('Renders with bottom border');
  await expect(card.getByRole('region', { name: 'Spec sheet: props' }).getByRole('columnheader', { name: 'Type' })).toBeVisible();
});

test('fixtures are a board of their own, in a distinct hue, and mark the last one visited', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Encyclopedia');
  const board = page.getByTestId('main-content-scroll');

  const fixtures = board.locator('[data-shadow-tile="fixture"]');
  expect(await fixtures.count()).toBeGreaterThan(3);
  await expect(fixtures.first()).toContainText('FX-01');

  // The fixture tiles take their color from the board's style domain, so
  // their surface differs from a tool tile's.
  const fixtureBg = await fixtures.first().evaluate(a => getComputedStyle(a.firstElementChild as Element).backgroundColor);
  const toolBg = await board.locator('[data-shadow-tile="demo"]').first().evaluate(a => getComputedStyle(a).backgroundColor);
  expect(fixtureBg).not.toBe(toolBg);

  const second = fixtures.nth(1);
  const href = (await second.getAttribute('href'))!;
  await second.click();
  await expect(page.getByText('Fixtures', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(board.locator(`a[href="${href}"]`)).toHaveAttribute('data-last-visited', '');
  await expect(board.locator('[data-last-visited]')).toHaveCount(1);
});
