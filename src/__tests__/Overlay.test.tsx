import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Popup } from '../components/Overlay/Popup';
import { Drawer } from '../components/Overlay/Drawer';
import { Modal } from '../components/Overlay/Modal';
import { Button } from '../components/Form/FormComponents';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

describe('Overlay Components (Popup, Drawer, Modal) Extensive Test Suite', () => {
  it('opens and light-dismisses Popup on Escape key', async () => {
    render(
      <Popup trigger={<Button>Open Popup</Button>}>
        <div>Popup Content</div>
      </Popup>
    );

    expect(screen.queryByText('Popup Content')).not.toBeInTheDocument();
    // Closed-state scan: trigger only, Popup's own portal content absent.
    expect(await axe(document.body)).toHaveNoViolations();

    fireEvent.click(screen.getByText('Open Popup'));
    expect(screen.getByText('Popup Content')).toBeInTheDocument();
    // Open-state scan: real portal content now mounted.
    expect(await axe(document.body)).toHaveNoViolations();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Popup Content')).not.toBeInTheDocument();
  });

  // Issue #421: Radix's own default close-autofocus targets whatever it
  // stored as "the trigger" -- but `asChild` (Popup.tsx) binds that ref to
  // the plain, non-focusable wrapper <div> around the real trigger, not
  // the real trigger itself. Focusing a non-focusable div is a silent
  // no-op, so focus fell through to <body> on every close before this fix
  // (confirmed directly against a real running demo, not assumed).
  it('returns focus to the real trigger element after closing, not <body> (issue #421)', async () => {
    render(
      <Popup trigger={<Button>Open Popup</Button>}>
        <div>Popup Content</div>
      </Popup>
    );

    const trigger = screen.getByText('Open Popup');
    fireEvent.click(trigger);
    expect(screen.getByText('Popup Content')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('preserves trigger button border-radius when Popup is closed', () => {
    render(
      <Popup trigger={<Button>Trigger Button</Button>}>
        <div>Menu</div>
      </Popup>
    );

    const btn = screen.getByText('Trigger Button');
    // Closed: Popup passes squareCorners="none" to the trigger, so Button
    // falls back to its own natural radius on all four corners — set as
    // explicit longhands (not the `borderRadius` shorthand) so the set of
    // style keys stays stable across open/close renders; see Button's own
    // comment on why mixing shorthand + a sometimes-present longhand
    // triggers a real React warning.
    expect(btn.style.borderBottomLeftRadius).toBe('var(--ai-radius-md)');
    expect(btn.style.borderTopRightRadius).toBe('var(--ai-radius-md)');
  });

  it('squares off joining corner on trigger button when Popup is opened', () => {
    render(
      <Popup placement="bottom-start" trigger={<Button>Open Placement Test</Button>}>
        <div>Menu Items</div>
      </Popup>
    );

    const btn = screen.getByText('Open Placement Test');
    fireEvent.click(btn);

    // bottom-start placement squares off borderBottomLeftRadius when open.
    // jsdom 30+ appends 'px' to a unitless numeric style value (matching
    // real browser CSSOM behavior more closely than older jsdom did).
    expect(btn.style.borderBottomLeftRadius).toBe('0px');

    // Light dismiss closes and reverts to the button's own natural radius
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(btn.style.borderBottomLeftRadius).toBe('var(--ai-radius-md)');
  });

  it('renders Drawer and dismisses on close button click', async () => {
    render(
      <Drawer title="Test Drawer" trigger={<Button>Open Drawer</Button>}>
        <div>Drawer Body</div>
      </Drawer>
    );

    // Closed-state scan: trigger only, Drawer's own portal content absent.
    expect(await axe(document.body)).toHaveNoViolations();

    fireEvent.click(screen.getByText('Open Drawer'));
    expect(screen.getByText('Test Drawer')).toBeInTheDocument();
    expect(screen.getByText('Drawer Body')).toBeInTheDocument();
    // Open-state scan: real dialog content now mounted.
    expect(await axe(document.body)).toHaveNoViolations();

    fireEvent.click(screen.getByText('×'));
    await waitFor(() => expect(screen.queryByText('Drawer Body')).not.toBeInTheDocument());
  });

  it('renders Drawer with corner radius according to placement position', () => {
    render(
      <Drawer title="Right Drawer" position="right" isOpen={true}>
        <div>Body</div>
      </Drawer>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.style.borderTopLeftRadius).toBe('var(--ai-radius-lg, 0.75rem)');
    expect(dialog.style.borderBottomLeftRadius).toBe('var(--ai-radius-lg, 0.75rem)');
  });

  it('renders Modal dialog with background lockout and focus trap', async () => {
    render(
      <Modal trigger={<Button>Open Modal</Button>}>
        <Modal.Header>Modal Title</Modal.Header>
        <Modal.Body>Modal Content</Modal.Body>
        <Modal.Footer>
          <Modal.Actions>
            <Modal.CloseButton />
          </Modal.Actions>
        </Modal.Footer>
      </Modal>
    );

    // Closed-state scan: trigger only, Modal's own portal content absent.
    expect(await axe(document.body)).toHaveNoViolations();

    fireEvent.click(screen.getByText('Open Modal'));
    const container = screen.getByTestId('modal-container');
    expect(container).toBeInTheDocument();
    expect(container.style.borderRadius).toBe('var(--ai-radius-lg, 0.75rem)');
    expect(screen.getByText('Modal Title')).toBeInTheDocument();
    // Open-state scan: full dialog content (header/body/footer/close
    // button) now mounted. aria-hidden-focus disabled -- Radix's own
    // hideOthers() (real focus-trap behavior neither axe variant can
    // observe) reads as an aria-hidden ancestor with a focusable
    // descendant to static analysis, same carve-out DropdownMenu.test.tsx's
    // own open-state scan already needs.
    expect(await axe(document.body, { rules: { 'aria-hidden-focus': { enabled: false } } })).toHaveNoViolations();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('modal-container')).not.toBeInTheDocument();
  });

  // Regression guard: @radix-ui/react-dialog's own DialogContent never sets
  // aria-modal itself (confirmed directly in its source -- it relies on the
  // `aria-hidden` package's hideOthers() to hide siblings instead, which
  // achieves real modal *behavior* but not the spec-declared attribute).
  // Nothing about the dialog looks or behaves broken without it, and
  // aria-modal isn't a *required* attribute for role="dialog" -- so neither
  // axe-core nor manual interaction testing would ever flag its absence.
  // Modal.tsx now sets it explicitly; this test is the only thing standing
  // between that and a silent regression next time Content's props change.
  it('declares aria-modal="true" explicitly, since the underlying Radix primitive never sets it itself', () => {
    render(
      <Modal trigger={<Button>Open Modal</Button>}>
        <Modal.Body>Content</Modal.Body>
      </Modal>
    );
    fireEvent.click(screen.getByText('Open Modal'));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('exposes a generic default accessible name, and a custom one via ariaLabel', () => {
    const { rerender } = render(
      <Modal trigger={<Button>Open Default</Button>}>
        <Modal.Body>Content</Modal.Body>
      </Modal>
    );
    fireEvent.click(screen.getByText('Open Default'));
    expect(screen.getByRole('dialog', { name: 'Dialog' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    rerender(
      <Modal trigger={<Button>Open Custom</Button>} ariaLabel="Delete confirmation">
        <Modal.Body>Content</Modal.Body>
      </Modal>
    );
    fireEvent.click(screen.getByText('Open Custom'));
    expect(screen.getByRole('dialog', { name: 'Delete confirmation' })).toBeInTheDocument();
  });

  it('defaults to vertically centered, but anchors near the top with align="top" (CommandPalette\'s VS Code-style placement)', () => {
    const { rerender } = render(
      <Modal trigger={<Button>Open Centered</Button>}>
        <Modal.Body>Content</Modal.Body>
      </Modal>
    );
    fireEvent.click(screen.getByText('Open Centered'));
    const overlay = screen.getByTestId('modal-container').parentElement as HTMLElement;
    expect(overlay.style.alignItems).toBe('center');
    fireEvent.keyDown(document, { key: 'Escape' });

    rerender(
      <Modal trigger={<Button>Open Top</Button>} align="top">
        <Modal.Body>Content</Modal.Body>
      </Modal>
    );
    fireEvent.click(screen.getByText('Open Top'));
    const topOverlay = screen.getByTestId('modal-container').parentElement as HTMLElement;
    expect(topOverlay.style.alignItems).toBe('flex-start');
  });

  describe('regression coverage: Popup placement variants (bottom-end/top-start/top-end — only bottom-start was ever exercised)', () => {
    it.each([
      ['bottom-end', 'borderBottomRightRadius'],
      ['top-start', 'borderTopLeftRadius'],
      ['top-end', 'borderTopRightRadius'],
    ] as const)('placement="%s" squares the %s corner on open, and reverts on close', (placement, radiusProp) => {
      render(
        <Popup placement={placement} trigger={<Button>Trigger</Button>}>
          <div>Content</div>
        </Popup>
      );

      const btn = screen.getByText('Trigger');
      fireEvent.click(btn);
      expect(btn.style[radiusProp]).toBe('0px');

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(btn.style[radiusProp]).toBe('var(--ai-radius-md)');
    });
  });

  it('a plain DOM element trigger (not a toolcrib component) gets its corner radius injected via a cloned style prop instead of squareCorners', () => {
    render(
      <Popup placement="bottom-start" trigger={<button style={{ color: 'red' }}>Plain Trigger</button>}>
        <div>Content</div>
      </Popup>
    );

    const btn = screen.getByText('Plain Trigger');
    expect(btn.style.color).toBe('red'); // original style preserved
    fireEvent.click(btn);
    expect(btn.style.borderBottomLeftRadius).toBe('0px');
  });

  describe('regression coverage: Popup `anchor` mode (issue #502 — a wider positioning anchor, separate from the click trigger)', () => {
    // The shape DatePicker actually uses: a wide bordered box (the
    // anchor) containing an unrelated always-present element (its own
    // "DateInput" stand-in here) plus a small nested <Popup.Trigger>
    // wrapping the real open/close button -- clicking the wide box
    // itself must NOT open the popup, only the nested trigger should.
    function renderAnchorPopup() {
      return render(
        <Popup
          placement="bottom-start"
          anchor={
            <div data-testid="anchor-box" style={{ display: 'flex', gap: '0.5rem' }}>
              <span>Field content</span>
              <Popup.Trigger>
                <button type="button">Open calendar</button>
              </Popup.Trigger>
            </div>
          }
        >
          <div>Calendar Content</div>
        </Popup>
      );
    }

    it('opens via the nested Popup.Trigger, not by clicking the wider anchor', () => {
      renderAnchorPopup();
      expect(screen.queryByText('Calendar Content')).not.toBeInTheDocument();

      // Clicking the anchor's own unrelated content must not open it.
      fireEvent.click(screen.getByTestId('anchor-box'));
      expect(screen.queryByText('Calendar Content')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Open calendar'));
      expect(screen.getByText('Calendar Content')).toBeInTheDocument();
    });

    it('squares the connecting corner on the anchor element, not the nested trigger button', () => {
      renderAnchorPopup();
      const anchor = screen.getByTestId('anchor-box');
      const button = screen.getByText('Open calendar');

      fireEvent.click(button);
      // bottom-start placement squares off the ANCHOR's own bottom-left
      // corner (TRIGGER_CORNER['bottom-start'] — the anchor's edge that
      // actually touches the popup opening below it, left-aligned) — not
      // top-left, which would be the wrong seam entirely; the nested
      // button itself gets no corner-squaring at all in this mode (that's
      // the anchor's job now, not the trigger's — see
      // connectedPopoverStyles.ts's own renderAnchorWithCornerSquaring
      // comment for why the two can't share the same
      // isToolcribComponent-dispatching helper).
      expect(anchor.style.borderBottomLeftRadius).toBe('0px');
      expect(button.style.borderBottomLeftRadius).toBe('');
    });

    // Radix's own default close-autofocus (not Popup's #421 override,
    // which is deliberately skipped in anchor mode -- see Popup.tsx's own
    // comment) should still correctly return focus to the real button,
    // since Popup.Trigger's asChild wraps it directly with no
    // intermediate wrapper div for the ref to bind to instead.
    it('returns focus to the real nested trigger button after closing, not <body>', async () => {
      renderAnchorPopup();
      const button = screen.getByText('Open calendar');

      fireEvent.click(button);
      expect(screen.getByText('Calendar Content')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => expect(document.activeElement).toBe(button));
    });

    // `anchor` is documented (PopupProps' own comment) as required to be
    // a plain-DOM/style-forwarding element, never a real toolcrib
    // component -- every toolcrib component strips `style`/`className`
    // outright (`StyleFree<...>`), so renderAnchorWithCornerSquaring's
    // plain style-clone approach would be a silent no-op on one, not an
    // error. Confirmed directly here rather than just documented: a real
    // <Button> passed as `anchor` still opens/closes correctly (Popup.
    // Trigger's own Radix-context wiring doesn't care what anchor's type
    // is), it just never visibly squares its corner -- exactly the
    // documented limitation, not a crash or a different, unexpected
    // failure mode.
    it('a toolcrib-component anchor still opens/closes correctly, but does not visibly square its corner (documented limitation)', () => {
      render(
        <Popup
          placement="bottom-start"
          anchor={
            <Button>
              <Popup.Trigger>
                <span>trigger-span</span>
              </Popup.Trigger>
            </Button>
          }
        >
          <div>Toolcrib Anchor Content</div>
        </Popup>
      );
      const anchorBtn = screen.getByText('trigger-span').closest('button')!;
      expect(screen.queryByText('Toolcrib Anchor Content')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('trigger-span'));
      expect(screen.getByText('Toolcrib Anchor Content')).toBeInTheDocument();
      // Button always sets all four corners explicitly to its own
      // default radius regardless (see AGENTS.md's "explicit per-corner
      // longhands, always all four" pattern) -- the documented
      // limitation shows up as "still Button's own unsquared default,"
      // not an empty string, since nothing ever reaches in to override it.
      expect(anchorBtn.style.borderBottomLeftRadius).not.toBe('0px');
      expect(anchorBtn.style.borderBottomLeftRadius).toBe('var(--ai-radius-md)');
    });
  });

  describe('regression coverage: Drawer edge positions (only "right" was ever exercised)', () => {
    it.each([
      ['left', 'borderTopRightRadius'],
      ['top', 'borderBottomLeftRadius'],
      ['bottom', 'borderTopLeftRadius'],
    ] as const)('position="%s" applies the matching corner radius to the dialog panel', (position, radiusProp) => {
      render(
        <Drawer title="Positioned Drawer" position={position} isOpen={true}>
          <div>Body</div>
        </Drawer>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog.style[radiusProp]).toBe('var(--ai-radius-lg, 0.75rem)');
    });
  });

  it('Drawer closes on Escape key (not just the close button) and calls onOpenChange with the new state', () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer title="Escape Drawer" trigger={<Button>Open</Button>} onOpenChange={onOpenChange}>
        <div>Body</div>
      </Drawer>
    );

    fireEvent.click(screen.getByText('Open'));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('Drawer light-dismisses when the backdrop itself is clicked, but not when the dialog panel inside it is clicked', async () => {
    render(
      <Drawer title="Backdrop Drawer" trigger={<Button>Open</Button>}>
        <div>Body</div>
      </Drawer>
    );

    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Clicking inside the dialog panel stops propagation — shouldn't close.
    fireEvent.click(screen.getByText('Body'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Clicking the backdrop itself (role="presentation") closes it.
    fireEvent.click(screen.getByRole('presentation'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it("a drawer:hidden bus event for an already-closed drawer is a no-op (doesn't call onOpenChange again)", () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer id="already-closed-drawer" title="Bus Drawer" isOpen={false} onOpenChange={onOpenChange}>
        <div>Body</div>
      </Drawer>
    );

    aiBus.emit('drawer:hidden', { id: 'already-closed-drawer' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('responds to aiBus event dispatches for overlays', () => {
    const popupShownSpy = vi.fn();
    const unsub = aiBus.on('popup:shown', popupShownSpy);

    render(
      <Popup id="test-popup" trigger={<Button>Bus Trigger</Button>}>
        <div>Bus Menu</div>
      </Popup>
    );

    fireEvent.click(screen.getByText('Bus Trigger'));
    expect(popupShownSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-popup' }));

    unsub();
  });
});
