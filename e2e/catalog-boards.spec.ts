import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// #680: the Fixtures board (Systems as a second shadow board, in its own
// style domain) and the last-visited marker on both boards.

test('going back to the board marks the tool you just visited, in view', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog');
  const board = page.getByTestId('main-content-scroll');
  await expect(board.locator('[data-last-visited]')).toHaveCount(0);

  // The index has its breadcrumb too: one crumb, the current page, not a link.
  await expect(board.getByText('Catalog', { exact: true })).toBeVisible();
  await expect(board.getByRole('link', { name: 'Catalog', exact: true })).toHaveCount(0);

  // A tool near the bottom of the board, so "in view" means it was scrolled to.
  await board.locator('a[href="#/catalog/Toggle"]').click();
  await expect(page.locator('#cat-Toggle')).toBeVisible();
  // The category crumb has no page of its own: plain text, not an inert link.
  await expect(board.getByText('Form Controls', { exact: true }).first()).toBeVisible();
  await expect(board.getByRole('link', { name: 'Form Controls', exact: true })).toHaveCount(0);
  await expect(board.getByRole('link', { name: 'Catalog', exact: true })).toHaveCount(1);
  await page.goBack();

  const tile = board.locator('a[href="#/catalog/Toggle"]');
  await expect(tile).toHaveAttribute('data-last-visited', '');
  await expect(tile).toContainText('last visited');
  await expect(tile).toBeInViewport();
  await expect(board.locator('[data-last-visited]')).toHaveCount(1);
});

test('the spec sheet carries the slots, with prop and slot counts as badges', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'Card');
  const card = page.locator('#cat-Card');
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
  await gotoTab(page, 'Catalog');
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

// Going back from a fixture used to shove the whole page splitter up inside
// the window (top clipped, a blank band under the event log): the last-visited
// tile was scrolled into view with scrollIntoView(), which scrolls every
// scrollable ancestor, overflow:hidden ones included. A tool tile didn't show
// it, because it was already in view.
test('going back from a fixture leaves the page layout where it was', async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 1100 });
  await page.goto('/');
  await gotoTab(page, 'Catalog');
  const board = page.getByTestId('main-content-scroll');
  const before = (await board.boundingBox())!;

  const last = board.locator('[data-shadow-tile="fixture"]').last();
  const href = (await last.getAttribute('href'))!;
  await last.click();
  await expect(page.getByText('Fixtures', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(board.locator(`a[href="${href}"]`)).toHaveAttribute('data-last-visited', '');

  // Both the board and the window are unmoved, and the tile is in view in the
  // board's own scroll region.
  await expect(board.locator(`a[href="${href}"]`)).toBeInViewport();
  const after = (await board.boundingBox())!;
  expect(after.y).toBe(before.y);
  expect(after.height).toBe(before.height);
  expect(await page.evaluate(() => [window.scrollX, window.scrollY, document.scrollingElement?.scrollTop])).toEqual([0, 0, 0]);
});
