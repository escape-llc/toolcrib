import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Modal } from '../components/Overlay/Modal';
import { Popup } from '../components/Overlay/Popup';
import { Drawer } from '../components/Overlay/Drawer';
import { AlertDialog } from '../components/AlertDialog/AlertDialog';
import { Viewer } from '../components/Viewer/Viewer';
import { Collapsible } from '../components/Collapsible/Collapsible';
import { Button } from '../components/Form/FormComponents';
import { aiBus } from '../eventBus/eventBus';
import { actAndSettle } from './testUtils/overlay';

// Regression (#705): each of these emits its own bus event on open/close
// (modal:shown, popup:hidden, ...) and also listens for that event, so a
// bus command can drive it. The bus dispatches synchronously, and the
// listener's "already in that state?" guard read the render-time isOpen,
// which hadn't updated yet, so every user-driven change echoed back and
// called the consumer's onOpenChange a second time. Each must fire exactly
// once per open and once per close, whether the change comes from the
// component's own UI or from a bus command.

const escape = () => actAndSettle(() => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }));

describe('onOpenChange fires exactly once per open and per close (#705)', () => {
  it('Modal', async () => {
    const onOpenChange = vi.fn();
    render(<Modal id="once-modal" trigger={<Button>Open</Button>} onOpenChange={onOpenChange}><Modal.Body>Body</Modal.Body></Modal>);
    await actAndSettle(() => fireEvent.click(screen.getByText('Open')));
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    await escape();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    await actAndSettle(() => aiBus.openModal('once-modal'));
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true]]);
  });

  it('AlertDialog', async () => {
    const onOpenChange = vi.fn();
    render(<AlertDialog id="once-alert" trigger={<Button>Open</Button>} onOpenChange={onOpenChange}><AlertDialog.Body>Body</AlertDialog.Body></AlertDialog>);
    await actAndSettle(() => fireEvent.click(screen.getByText('Open')));
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    await escape();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    await actAndSettle(() => aiBus.openAlertDialog('once-alert'));
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true]]);
  });

  it('Popup', async () => {
    const onOpenChange = vi.fn();
    render(<Popup id="once-popup" trigger={<Button>Open</Button>} onOpenChange={onOpenChange}><div>Body</div></Popup>);
    await actAndSettle(() => fireEvent.click(screen.getByText('Open')));
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    await escape();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    await actAndSettle(() => aiBus.openPopup('once-popup'));
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true]]);
  });

  it('Drawer', async () => {
    const onOpenChange = vi.fn();
    render(<Drawer id="once-drawer" title="Drawer" trigger={<Button>Open</Button>} onOpenChange={onOpenChange}><div>Body</div></Drawer>);
    await actAndSettle(() => fireEvent.click(screen.getByText('Open')));
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    await escape();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    await actAndSettle(() => aiBus.openDrawer('once-drawer'));
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true]]);
  });

  it('Viewer', async () => {
    const onOpenChange = vi.fn();
    render(<Viewer id="once-viewer" items={[{ id: 'a', src: 'a.png', alt: 'Photo A' }]} onOpenChange={onOpenChange} />);
    await actAndSettle(() => aiBus.emit('viewer:shown', { id: 'once-viewer' }));
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    await actAndSettle(() => fireEvent.click(screen.getByLabelText('Close viewer')));
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('Collapsible', async () => {
    const onOpenChange = vi.fn();
    render(<Collapsible id="once-collapsible" trigger="Details" onOpenChange={onOpenChange}>Body</Collapsible>);
    await actAndSettle(() => fireEvent.click(screen.getByText('Details')));
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    await actAndSettle(() => fireEvent.click(screen.getByText('Details')));
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    act(() => aiBus.emit('collapsible:opened', { id: 'once-collapsible' }));
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true]]);
  });
});
