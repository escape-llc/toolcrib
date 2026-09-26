import { test, expect } from '@playwright/test';
import { gotoTab } from './nav';

// Real-browser confirmation for issue #502: DatePicker's calendar popup
// used to anchor to just the small calendar-glyph button (Popup's own
// `trigger` prop doubling as its positioning anchor), landing well off
// the actual date field's own edge -- reported directly. `<Popup>` now
// supports a separate `anchor` prop (the field's whole bordered `<Group>`)
// distinct from the click trigger (a nested `<Popup.Trigger>` around just
// the button), matching every other connected popover in the toolkit
// (Combobox's own dropdown, e.g.).
//
// This also exercises the fix for a real, confirmed Radix bug found
// while building this: `virtualRef`-based anchoring (tried first, see
// Popup.tsx's own comment) never picks up a real anchor size at all --
// `anchor` mode sidesteps it entirely by anchoring to a REAL, always-
// rendered DOM node instead.

test('DatePicker calendar popup anchors to the whole field edge, with the connecting corner squared', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Forms & Zod Engine');

  // The profile form's Start Date picker (the first one on the old Forms
  // tab) -- scoped to its Encyclopedia entry since issue #624 put every
  // DatePicker on one page.
  const button = page.locator('#enc-Form').getByRole('button', { name: 'Open calendar' }).first();
  await button.waitFor({ state: 'visible' });

  const group = button.locator('xpath=ancestor::div[@role="group"][1]');
  // Scroll it into view BEFORE measuring: button.click() below auto-scrolls
  // the button into view, which would move the group after its box was
  // read. That never happened on the old short Forms tab; on the single
  // Encyclopedia page (issue #624) the field starts partly out of view.
  await group.scrollIntoViewIfNeeded();
  const groupBox = await group.boundingBox();
  expect(groupBox).not.toBeNull();

  await button.click();

  const popupContent = page.locator('.ai-popup-content');
  await expect(popupContent).toBeVisible();
  const popupBox = await popupContent.boundingBox();
  expect(popupBox).not.toBeNull();

  // Real position check: NOT at viewport origin (the old virtualRef
  // bug's own exact symptom: x:0, y:-1-ish, near-zero size) -- and
  // aligned to the GROUP's own left edge, not the tiny button's.
  expect(popupBox!.x).toBeGreaterThan(0);
  expect(popupBox!.y).toBeGreaterThan(0);
  expect(Math.abs(popupBox!.x - groupBox!.x)).toBeLessThan(5);

  // Adjacent to the group vertically -- either just below its bottom
  // edge (bottom-start, requested) or just above its top edge (top-start,
  // if Radix's own avoidCollisions auto-flipped on viewport overlap; see
  // useActualPopoverSide's own comment). Either way, genuinely adjacent,
  // not floating at some unrelated position.
  const isBelow = popupBox!.y >= groupBox!.y + groupBox!.height - 2;
  const isAbove = popupBox!.y + popupBox!.height <= groupBox!.y + 2;
  expect(isBelow || isAbove).toBe(true);

  // The connecting corner should be squared (0px) regardless of which
  // side Radix actually chose -- computeCornerSquaring keys off the
  // REAL, actual side (useActualPopoverSide), not just the requested
  // one. TRIGGER_CORNER (connectedPopoverStyles.ts) maps 'top-start' to
  // the anchor's own top-left (popup sits above, connects at the
  // anchor's top edge) and 'bottom-start' to bottom-left (popup sits
  // below, connects at the anchor's bottom edge).
  const cornerProp = isAbove ? 'borderTopLeftRadius' : 'borderBottomLeftRadius';
  const cornerStyle = await popupContent.evaluate((el, prop) => (getComputedStyle(el) as any)[prop], cornerProp);
  expect(cornerStyle).toBe('0px');

  // Escape closes it and returns focus to the real button (issue #421's
  // fix still applies correctly in anchor mode -- see Popup.tsx's own
  // comment on why Radix's own default close-autofocus, not the #421
  // override, is what runs here).
  await page.keyboard.press('Escape');
  await expect(popupContent).not.toBeVisible();
  await expect(button).toBeFocused();
});

test('clicking the date field itself (not the calendar button) does not open the popup', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Forms & Zod Engine');

  // The profile form's Start Date picker (the first one on the old Forms
  // tab) -- scoped to its Encyclopedia entry since issue #624 put every
  // DatePicker on one page.
  const button = page.locator('#enc-Form').getByRole('button', { name: 'Open calendar' }).first();
  await button.waitFor({ state: 'visible' });
  const group = button.locator('xpath=ancestor::div[@role="group"][1]');

  // Click on the group's own background (not the button, not a date
  // segment) -- must not toggle the calendar open. This is the entire
  // point of anchor mode: the wider anchor positions the popup, but only
  // the nested Popup.Trigger opens/closes it.
  const box = await group.boundingBox();
  await page.mouse.click(box!.x + box!.width - 5, box!.y + 2);

  await expect(page.locator('.ai-popup-content')).not.toBeVisible();
});
