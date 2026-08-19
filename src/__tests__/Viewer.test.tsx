import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Viewer } from '../components/Viewer/Viewer';
import { Modal } from '../components/Overlay/Modal';
import { aiBus } from '../eventBus/eventBus';

const items = [
  { id: 'a', src: '/a.jpg', alt: 'Photo A' },
  { id: 'b', src: '/b.jpg', alt: 'Photo B' },
];

describe('Viewer', () => {
  it('renders nothing when closed, and its ViewerContent when open (controlled)', () => {
    const { rerender } = render(<Viewer id="v1" items={items} isOpen={false} onOpenChange={() => {}} />);
    expect(screen.queryByAltText('Photo A')).not.toBeInTheDocument();

    rerender(<Viewer id="v1" items={items} isOpen={true} onOpenChange={() => {}} />);
    expect(screen.getByAltText('Photo A')).toBeInTheDocument();
  });

  it('emits viewer:shown/viewer:hidden, mirroring modal:shown/modal:hidden\'s id-targeted shape', () => {
    const shownFn = vi.fn();
    const hiddenFn = vi.fn();
    const unsubShown = aiBus.on('viewer:shown', shownFn);
    const unsubHidden = aiBus.on('viewer:hidden', hiddenFn);

    render(<Viewer id="v2" items={items} isOpen={true} onOpenChange={() => {}} />);
    fireEvent.click(screen.getByLabelText('Close viewer'));
    expect(hiddenFn).toHaveBeenCalledWith({ id: 'v2' });

    unsubShown();
    unsubHidden();
  });

  it('closing (via its own close button) calls onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    render(<Viewer id="v3" items={items} isOpen={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByLabelText('Close viewer'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // The doc's own Shell/Content acceptance test for this item: a Viewer
  // opened from inside content that's itself hosted in a Modal (the
  // realistic nesting -- a product-detail modal containing a photo
  // gallery) must have its own Escape close only itself, not the
  // enclosing Modal. Mirrors DatePicker's identical nested-overlay test
  // from the prior batch, one Modal nested inside another here instead of
  // a Popup inside a Modal.
  it('pressing Escape with a Viewer open inside another Modal closes only the Viewer, not the outer Modal', () => {
    // Mounts the outer Modal first, settled, then opens the (uncontrolled)
    // Viewer inside it via the bus -- matching the realistic sequence (a
    // gallery thumbnail click opens the Viewer sometime after its host
    // Modal is already open), and avoiding the unrelated
    // simultaneous-double-mount focus race that two Radix Dialogs opening
    // in the very same initial render can hit (both FocusScopes claiming
    // focus in the same commit). Uncontrolled (no isOpen/onOpenChange), so
    // Radix's own Escape dismissal actually updates Viewer's internal
    // state and removes it from the DOM, rather than needing a parent to
    // notice onOpenChange and re-render with a new isOpen prop.
    render(
      <Modal isOpen>
        <Viewer id="nested-viewer" items={items} />
      </Modal>
    );
    expect(screen.getAllByTestId('modal-container')).toHaveLength(1);

    act(() => {
      aiBus.emit('viewer:shown', { id: 'nested-viewer' });
    });
    expect(screen.getAllByTestId('modal-container')).toHaveLength(2);
    expect(screen.getByAltText('Photo A')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.getAllByTestId('modal-container')).toHaveLength(1);
    expect(screen.queryByAltText('Photo A')).not.toBeInTheDocument();
  });

  it('opens via aiBus.openModal-style targeting: aiBus.emit(\'viewer:shown\', { id })', () => {
    render(<Viewer id="v4" items={items} />);
    expect(screen.queryByAltText('Photo A')).not.toBeInTheDocument();

    act(() => {
      aiBus.emit('viewer:shown', { id: 'v4' });
    });

    expect(screen.getByAltText('Photo A')).toBeInTheDocument();
  });
});
