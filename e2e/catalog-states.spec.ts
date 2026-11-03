import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';
import manifest from '../ai-docs/component-manifest.json' with { type: 'json' };

const INVALID_STATE_CONTROLS = (manifest as { components: { name: string; states?: string[] }[] }).components
  .filter(c => c.states?.includes('invalid'))
  .map(c => c.name);

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

  // Every control that declares `invalid` (@manifestStates, so the list comes
  // from the manifest, not by hand) really renders it: marked aria-invalid,
  // its error shown, and painted in the error color somewhere on the control
  // itself, which its default card is not. The last part is what was missing:
  // Select and Combobox said invalid but looked exactly like their default.
  for (const name of INVALID_STATE_CONTROLS) {
    test(`${name}'s invalid example is marked invalid, shows its error, and looks it`, async ({ page }) => {
      await page.goto('/');
      await gotoTab(page, 'Catalog', name);
      const states = page.locator(`[data-catalog-states="${name}"]`);
      await expect(states.getByText('This field is required')).toBeVisible();
      await expect(states.locator('[aria-invalid="true"]').first()).toBeAttached();
      const paints = (card: string) => states.locator(`[data-catalog-state-card="${card}"]`).evaluate(root => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--ai-subtheme-error, #ef4444)';
        root.appendChild(probe);
        const error = getComputedStyle(probe).color;
        probe.remove();
        const props = ['border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color', 'background-color', 'box-shadow', 'outline-color', 'color', 'fill', 'stroke'];
        return Array.from(root.querySelectorAll<HTMLElement>('*'))
          .filter(el => !el.closest('[data-testid^="form-field-error-region"]'))
          .some(el => { const cs = getComputedStyle(el); return props.some(p => cs.getPropertyValue(p).includes(error)); });
      });
      await expect.poll(() => paints('invalid'), { message: 'the invalid card shows the error color' }).toBe(true);
      expect(await paints('default'), 'the default card does not').toBe(false);
    });
  }

  // The focus ring belongs on the bordered field. It used to sit on these
  // pickers' full-width root, so a focused one drew a ring around the whole
  // cell instead of hugging the field.
  for (const name of ['DatePicker', 'TimeField', 'DateRangePicker']) {
    test(`${name}'s focus ring hugs the field, not the whole cell`, async ({ page }) => {
      await page.goto('/');
      await gotoTab(page, 'Catalog', name);
      const cell = page.locator(`[data-catalog-states="${name}"] [data-demo-state="focused"]`);
      await expect(cell).toBeVisible();
      // Give the cell room well past the field's own width, so the check does
      // not depend on how wide the viewport lets the state cards grow.
      await cell.evaluate(el => { el.style.width = '30rem'; });
      const ring = cell.locator('.ai-focus-ring').first();
      await expect(ring).not.toHaveCSS('outline-color', 'rgba(0, 0, 0, 0)');
      const cellBox = (await cell.boundingBox())!;
      const ringBox = (await ring.boundingBox())!;
      expect(ringBox.width, 'the ring is as wide as the whole cell').toBeLessThan(cellBox.width * 0.9);
    });
  }

  // Real keyboard focus (not the forced demo ring) on each field.
  for (const name of ['DatePicker', 'TimeField', 'DateRangePicker']) {
    test(`a real keyboard focus draws the ${name} ring on the field too`, async ({ page }) => {
      await page.goto('/');
      await gotoTab(page, 'Catalog', name);
      const defaultCell = page.locator(`[data-catalog-states="${name}"] div`, { has: page.getByText('default', { exact: true }) }).first();
      await defaultCell.getByRole('spinbutton').first().focus();
      await page.keyboard.press('ArrowRight');
      const field = defaultCell.locator('.ai-focus-ring').first();
      await expect(field).not.toHaveCSS('outline-color', 'rgba(0, 0, 0, 0)');
      expect((await field.boundingBox())!.width).toBeLessThan((await defaultCell.boundingBox())!.width * 0.9);
    });
  }

  // The calendars had no ring on their day cells at all.
  for (const name of ['Calendar', 'RangeCalendar']) {
    test(`a focused ${name} day cell draws the focus ring`, async ({ page }) => {
      await page.goto('/');
      await gotoTab(page, 'Catalog', name);
      const cell = page.locator(`[data-catalog-states="${name}"] [role="button"].react-aria-CalendarCell`).first();
      await cell.focus();
      await page.keyboard.press('ArrowRight');
      const focused = page.locator(`[data-catalog-states="${name}"] .react-aria-CalendarCell:focus`);
      await expect(focused).toHaveCount(1);
      await expect(focused).not.toHaveCSS('outline-color', 'rgba(0, 0, 0, 0)');
    });
  }

  test('Checkbox dims its label along with the box when disabled', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Catalog', 'Checkbox');
    const label = page.locator('[data-catalog-states="Checkbox"]').getByText('Disabled', { exact: true }).first();
    await expect(label).toHaveCSS('opacity', '0.6');
  });
});
