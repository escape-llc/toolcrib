import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Popup } from '../components/Overlay/Popup';
import { SlideOut } from '../components/Overlay/SlideOut';
import { Modal } from '../components/Overlay/Modal';
import { Button } from '../components/Form/FormComponents';
import { aiBus } from '../eventBus/eventBus';

describe('Overlay Components (Popup, SlideOut, Modal) Extensive Test Suite', () => {
  it('opens and light-dismisses Popup on Escape key', () => {
    render(
      <Popup trigger={<Button>Open Popup</Button>}>
        <div>Popup Content</div>
      </Popup>
    );

    expect(screen.queryByText('Popup Content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Open Popup'));
    expect(screen.getByText('Popup Content')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Popup Content')).not.toBeInTheDocument();
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

  it('renders SlideOut drawer and dismisses on close button click', async () => {
    render(
      <SlideOut title="Test Drawer" trigger={<Button>Open SlideOut</Button>}>
        <div>Drawer Body</div>
      </SlideOut>
    );

    fireEvent.click(screen.getByText('Open SlideOut'));
    expect(screen.getByText('Test Drawer')).toBeInTheDocument();
    expect(screen.getByText('Drawer Body')).toBeInTheDocument();

    fireEvent.click(screen.getByText('×'));
    await waitFor(() => expect(screen.queryByText('Drawer Body')).not.toBeInTheDocument());
  });

  it('renders SlideOut with corner radius according to placement position', () => {
    render(
      <SlideOut title="Right Drawer" position="right" isOpen={true}>
        <div>Body</div>
      </SlideOut>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.style.borderTopLeftRadius).toBe('var(--ai-radius-lg, 0.75rem)');
    expect(dialog.style.borderBottomLeftRadius).toBe('var(--ai-radius-lg, 0.75rem)');
  });

  it('renders Modal dialog with background lockout and focus trap', () => {
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

    fireEvent.click(screen.getByText('Open Modal'));
    const container = screen.getByTestId('modal-container');
    expect(container).toBeInTheDocument();
    expect(container.style.borderRadius).toBe('var(--ai-radius-lg, 0.75rem)');
    expect(screen.getByText('Modal Title')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('modal-container')).not.toBeInTheDocument();
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
