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
  await gotoTab(page, 'Catalog', 'Modal');
  await page.getByRole('button', { name: 'Open Modal Dialog' }).click();

  const modal = page.getByTestId('modal-container');
  await modal.waitFor({ state: 'visible', timeout: 2000 });

  const animationName = await modal.evaluate(el => getComputedStyle(el).animationName);
  expect(animationName).toBe('ai-scale-in');
});

// Regression for issue #373: "Modal fades in nicely, but closing has no
// counter-transition -- it just slams shut." Root cause was that Content/
// Overlay only ever carried a static, unconditional inline `animation`
// string (ai-scale-in/ai-fade-in) -- already finished by the time the primitive
// flipped data-state to "closed", leaving nothing for its own internal
// Presence to detect and wait for before tearing the node down instantly.
// Fixed by injectModalAnimations (Modal.tsx), a real [data-state]-keyed
// stylesheet mirroring Tooltip's own injectTooltipAnimations mechanism.
// Filtered animationend listeners installed BEFORE triggering the close --
// see toast-animation.spec.ts's identical reasoning for why that beats
// polling data-state after the fact.
test('closing a Modal plays real ai-fade-out/ai-scale-out exit animations before removal', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'Modal');
  await page.getByRole('button', { name: 'Open Modal Dialog' }).click();

  const modal = page.getByTestId('modal-container');
  await modal.waitFor({ state: 'visible', timeout: 2000 });
  const overlay = page.locator('.ai-modal-overlay');

  const contentExitPromise = modal.evaluate(el => new Promise<string>(resolve => {
    el.addEventListener('animationend', function handler(e) {
      if ((e as AnimationEvent).animationName === 'ai-scale-out') {
        el.removeEventListener('animationend', handler);
        resolve((e as AnimationEvent).animationName);
      }
    });
  }));
  const overlayExitPromise = overlay.evaluate(el => new Promise<string>(resolve => {
    el.addEventListener('animationend', function handler(e) {
      if ((e as AnimationEvent).animationName === 'ai-fade-out') {
        el.removeEventListener('animationend', handler);
        resolve((e as AnimationEvent).animationName);
      }
    });
  }));

  await page.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await contentExitPromise).toBe('ai-scale-out');
  expect(await overlayExitPromise).toBe('ai-fade-out');
  await expect(modal).not.toBeAttached({ timeout: 2000 });
});

test('opening an AlertDialog plays its ai-fade-in/ai-scale-in entrance animations', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'AlertDialog');
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

// Regression for issue #408: identical bug shape to Modal's #373 (see
// that test's own comment) -- AlertDialog.Overlay/Content also carried a
// static, unconditional inline `animation` string with no exit
// counterpart, so the internal Presence found nothing running on
// close and tore the node down instantly. Fixed by
// injectAlertDialogAnimations (AlertDialog.tsx), mirroring Modal's own
// injectModalAnimations mechanism exactly.
test('closing an AlertDialog plays real ai-fade-out/ai-scale-out exit animations before removal', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'AlertDialog');
  await page.getByText('Blocking Confirmation').locator('..').getByRole('button', { name: /Delete Record/ }).click();

  const dialog = page.getByTestId('alertdialog-container');
  await dialog.waitFor({ state: 'visible', timeout: 2000 });
  const overlay = page.locator('.ai-alertdialog-overlay');

  const contentExitPromise = dialog.evaluate(el => new Promise<string>(resolve => {
    el.addEventListener('animationend', function handler(e) {
      if ((e as AnimationEvent).animationName === 'ai-scale-out') {
        el.removeEventListener('animationend', handler);
        resolve((e as AnimationEvent).animationName);
      }
    });
  }));
  const overlayExitPromise = overlay.evaluate(el => new Promise<string>(resolve => {
    el.addEventListener('animationend', function handler(e) {
      if ((e as AnimationEvent).animationName === 'ai-fade-out') {
        el.removeEventListener('animationend', handler);
        resolve((e as AnimationEvent).animationName);
      }
    });
  }));

  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await contentExitPromise).toBe('ai-scale-out');
  expect(await overlayExitPromise).toBe('ai-fade-out');
  await expect(dialog).not.toBeAttached({ timeout: 2000 });
});

test('expanding an Accordion item plays its ai-accordion-slide-down animation', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'Accordion');

  // faq-1 is open by default (defaultValue) — faq-2 starts closed, so
  // clicking it is a real closed-to-open transition, not just a fresh
  // mount already in the open state. A closed panel isn't mounted at all
  // (Base UI, #702).
  const panel = page.getByTestId('accordion-content-faq-2');
  await expect(panel).not.toBeAttached();

  await page.getByText('How does Event Bus integration work?').click();

  await expect(panel).toHaveAttribute('data-open', '');
  const animationName = await panel.evaluate(el => getComputedStyle(el).animationName);
  expect(animationName).toBe('ai-accordion-slide-down');

  // And the close plays the slide-up to completion before the panel goes
  // away -- the height keyframes read Base UI's --accordion-panel-height, and
  // nothing errors if that variable is misnamed (issue #702's own warning).
  // The open animation starts from height 0, so let it finish before
  // measuring (a first version measured at its start and read 0 in WebKit).
  await panel.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
  const openHeight = await panel.evaluate(el => el.getBoundingClientRect().height);
  expect(openHeight).toBeGreaterThan(0);
  const exitEnd = panel.evaluate(el => new Promise<string>(resolve => {
    el.addEventListener('animationend', function handler(e) {
      if ((e as AnimationEvent).animationName === 'ai-accordion-slide-up') {
        el.removeEventListener('animationend', handler);
        resolve((e as AnimationEvent).animationName);
      }
    });
  }));
  await page.getByText('How does Event Bus integration work?').click();
  expect(await exitEnd).toBe('ai-accordion-slide-up');
  await expect(panel).not.toBeAttached();
});

test('a Collapsible plays its slide-down on open and its slide-up through the close before unmounting', async ({ page }) => {
  // Base UI keeps a closing panel mounted while its exit animation runs,
  // and the panel carries data-closed through that exit (#702), which is
  // what the slide-up rule keys on. The height keyframes read
  // --collapsible-panel-height; a wrong name fails silently.
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'Collapsible');
  const text = page.getByText('Content revealed on demand');
  await expect(text).not.toBeAttached();

  await page.getByText('Show advanced options').click();
  const panel = page.locator('.ai-collapsible-content');
  await expect(panel).toHaveAttribute('data-open', '');
  expect(await panel.evaluate(el => getComputedStyle(el).animationName)).toBe('ai-collapsible-slide-down');
  await panel.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
  expect(await panel.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(0);

  const exitEnd = panel.evaluate(el => new Promise<string>(resolve => {
    el.addEventListener('animationend', function handler(e) {
      if ((e as AnimationEvent).animationName === 'ai-collapsible-slide-up') {
        el.removeEventListener('animationend', handler);
        resolve((e as AnimationEvent).animationName);
      }
    });
  }));
  await page.getByText('Show advanced options').click();
  expect(await exitEnd).toBe('ai-collapsible-slide-up');
  await expect(text).not.toBeAttached();
});

test('opening a Drawer plays its entrance animations and closing plays real exit animations before removal', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Overlays & Actions');

  await page.getByRole('button', { name: 'Open Drawer', exact: true }).click();

  const panel = page.getByRole('dialog');
  await panel.waitFor({ state: 'visible', timeout: 2000 });
  const panelAnimationName = await panel.evaluate(el => getComputedStyle(el).animationName);
  expect(panelAnimationName).toBe('ai-slide-in-right');

  const backdrop = page.getByTestId('drawer-backdrop');
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
  // Fixed by Presence, which listens on the real DOM
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

// Regression for issue #374: "Popup's transitions (if any) happen too fast
// to actually perceive" -- unlike Modal/AlertDialog (which at least had a
// broken entrance-only animation), Popup.Content had NO animation
// whatsoever: open/close were both an instant, un-eased DOM swap. Fixed by
// injectPopupAnimations (Popup.tsx; now overlayLayer's useOverlayAnimations,
// keyed on Base UI's data-open/data-closed), the same state-keyed stylesheet
// mechanism as Tooltip's own injectTooltipAnimations. Anchored popups now
// pop (a fade plus a small scale) out of their trigger (#735).
test('a Popup plays real ai-pop-in/ai-pop-out entrance/exit animations and is cleanly removed after', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'Catalog', 'Popup');
  await page.getByRole('button', { name: 'Toggle Popup Menu' }).click();

  const popup = page.locator('.ai-popup-content');
  await popup.waitFor({ state: 'visible', timeout: 2000 });
  // Open-state marker: Base UI's bare data-open (#696). It proves the
  // entrance keyframe is keyed on the open state.
  const openInfo = await popup.evaluate(el => ({
    animationName: getComputedStyle(el).animationName,
    open: el.getAttribute('data-state') === 'open' || el.hasAttribute('data-open'),
  }));
  expect(openInfo.animationName).toBe('ai-pop-in');
  expect(openInfo.open).toBe(true);

  const exitAnimationEndPromise = popup.evaluate(el => new Promise<string>(resolve => {
    el.addEventListener('animationend', function handler(e) {
      if ((e as AnimationEvent).animationName === 'ai-pop-out') {
        el.removeEventListener('animationend', handler);
        resolve((e as AnimationEvent).animationName);
      }
    });
  }));

  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  expect(await exitAnimationEndPromise).toBe('ai-pop-out');
  await expect(popup).not.toBeAttached({ timeout: 2000 });
});

test('a Tooltip plays real entrance/exit animations and is cleanly removed after, never stuck', async ({ page }) => {
  // Regression test: this component used to reference a keyframe name
  // (ai-popup-fade) that didn't exist anywhere, so Presence's wait-for-
  // animationend never resolved and the tooltip stayed mounted and fully
  // visible forever after hovering away — reported directly. The keyframes
  // are now keyed on Base UI's data-open/data-closed (#700, the shared
  // useOverlayAnimations); Base UI keeps the node
  // mounted until the exit animation finishes.
  await page.goto('/');

  const trigger = page.getByRole('button', { name: 'Export JSONL' });
  await trigger.hover();

  const tooltip = page.getByRole('tooltip', { name: /Download the captured events/ });
  await tooltip.waitFor({ state: 'visible', timeout: 2000 });

  const openInfo = await tooltip.evaluate(el => ({
    animationName: getComputedStyle(el).animationName,
    open: el.hasAttribute('data-open'),
  }));
  expect(openInfo.animationName).toBe('ai-pop-in');
  expect(openInfo.open).toBe(true);

  // Filtered, not { once: true } on the raw event — see toast-animation.spec.ts's
  // own identical comment: the entrance animation's own animationend would
  // otherwise resolve this with the wrong name.
  const exitAnimationEndPromise = tooltip.evaluate(el => new Promise<string>(resolve => {
    el.addEventListener('animationend', function handler(e) {
      if ((e as AnimationEvent).animationName === 'ai-pop-out') {
        el.removeEventListener('animationend', handler);
        resolve((e as AnimationEvent).animationName);
      }
    });
  }));

  await page.mouse.move(10, 10); // move away from the trigger to close it
  expect(await exitAnimationEndPromise).toBe('ai-pop-out');
  await expect(tooltip).not.toBeAttached({ timeout: 2000 });
});
