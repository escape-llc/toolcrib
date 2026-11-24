import { getAi } from './testUtils/aiTestId';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { Modal } from '../components/Overlay/Modal';
import { AlertDialog } from '../components/AlertDialog/AlertDialog';
import { Popup } from '../components/Overlay/Popup';
import { Button } from '../components/Form/FormComponents';
import { ToastProvider, useToast } from '../components/Toast/ToastContext';
import { ToastContainer } from '../components/Toast/Toast';
import { useSafeAreaBoundary, useViewportInsets, SAFE_AREA_ATTRIBUTE } from '../theme/safeAreaBoundary';
import { aiBus } from '../eventBus/eventBus';
import { settleOverlay } from './testUtils/overlay';

const inset = (side: string) => `var(--ai-viewport-inset-${side}, 0px)`;
const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const safeAreaEls = () => document.body.querySelectorAll(`[${SAFE_AREA_ATTRIBUTE}]`);

afterEach(() => vi.restoreAllMocks());

describe('full-window overlays respect the viewport inset', () => {
  it('Modal: backdrop and positioning layer sit inside the insets', () => {
    const { baseElement } = render(
      <Modal isOpen aria-label="Inset modal">
        <Modal.Body>Body</Modal.Body>
      </Modal>
    );
    const backdrop = baseElement.querySelector('.ai-modal-overlay') as HTMLElement;
    for (const side of SIDES) expect(backdrop.style[side]).toBe(inset(side));
    const popup = getAi('modal-container');
    const viewport = popup.parentElement as HTMLElement;
    for (const side of SIDES) expect(viewport.style[side]).toBe(inset(side));
    expect(popup.style.maxHeight).toContain('--ai-viewport-inset-top');
    expect(popup.style.maxWidth).toContain('--ai-viewport-inset-left');
  });

  it('AlertDialog: backdrop and positioning layer sit inside the insets', () => {
    const { baseElement } = render(
      <AlertDialog isOpen aria-label="Inset alert">
        <div>Body</div>
      </AlertDialog>
    );
    const backdrop = baseElement.querySelector('.ai-alertdialog-overlay') as HTMLElement;
    for (const side of SIDES) expect(backdrop.style[side]).toBe(inset(side));
    const viewport = getAi('alertdialog-container').parentElement as HTMLElement;
    for (const side of SIDES) expect(viewport.style[side]).toBe(inset(side));
  });

  it('Toast viewport is offset by the inset on its anchored edge and sized inside the insets', async () => {
    const Adder = () => {
      const { addToast } = useToast();
      return <button onClick={() => addToast({ id: 't', type: 'info', message: 'Inset toast', duration: 60000 })}>Add</button>;
    };
    render(
      <ToastProvider>
        <Adder />
        <ToastContainer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Add'));
    const viewport = (await screen.findByText('Inset toast')).closest('[aria-live="off"]') as HTMLElement;
    // Default anchor is a top corner.
    expect(viewport.style.top).toBe(inset('top'));
    expect(viewport.style.height).toContain('--ai-viewport-inset-top');
    expect(viewport.style.height).toContain('--ai-viewport-inset-bottom');
    expect(viewport.style.width).toContain('--ai-viewport-inset-left');
    expect(viewport.style.width).toContain('--ai-viewport-inset-right');
  });
});

describe('safe-area boundary element', () => {
  it('is created once per document, shared, and removed with its last user', () => {
    expect(safeAreaEls()).toHaveLength(0);
    const a = renderHook(() => useSafeAreaBoundary());
    const b = renderHook(() => useSafeAreaBoundary());
    expect(safeAreaEls()).toHaveLength(1);
    const el = safeAreaEls()[0] as HTMLElement;
    expect(a.result.current).toBe(el);
    expect(b.result.current).toBe(el);
    // Not aria-hidden: a body-level aria-hidden sibling reads as a hide-others
    // helper (combobox-popover.spec.ts); visibility: hidden keeps it out of the tree.
    expect(el.hasAttribute('aria-hidden')).toBe(false);
    expect(el.style.visibility).toBe('hidden');
    expect(el.style.position).toBe('fixed');
    expect(el.style.visibility).toBe('hidden');
    expect(el.style.pointerEvents).toBe('none');
    for (const side of SIDES) expect(el.style[side]).toBe(inset(side));

    a.unmount();
    expect(safeAreaEls()).toHaveLength(1);
    b.unmount();
    expect(safeAreaEls()).toHaveLength(0);
  });

  it('adds no raw <style> tag (CSP): sizing is CSSOM on the element', () => {
    const before = document.querySelectorAll('style').length;
    const { unmount } = renderHook(() => useSafeAreaBoundary());
    expect(document.querySelectorAll('style').length).toBe(before);
    unmount();
  });

  it('a Popup still opens with the boundary in place', async () => {
    render(
      <Popup trigger={<Button>Open Popup</Button>}>
        <div>Popup Content</div>
      </Popup>
    );
    expect(safeAreaEls()).toHaveLength(1);
    fireEvent.click(screen.getByText('Open Popup'));
    await settleOverlay();
    expect(screen.getByText('Popup Content')).toBeInTheDocument();
  });
});

describe('useViewportInsets', () => {
  it('measures the safe-area element against the window, and updates on resize and theme change', () => {
    const box = (top: number, right: number, bottom: number, left: number) => ({ top, right, bottom, left, width: right - left, height: bottom - top });
    let rect = box(40, 1000, 700, 0);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => rect as DOMRect);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(720);

    const { result } = renderHook(() => useViewportInsets());
    expect(result.current).toEqual({ top: 40, right: 0, bottom: 20, left: 0 });

    rect = box(64, 990, 700, 8);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toEqual({ top: 64, right: 10, bottom: 20, left: 8 });

    rect = box(0, 1000, 720, 0);
    act(() => {
      aiBus.emit('theme:changed', {} as never);
    });
    expect(result.current).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('is all zeros when nothing is inset', () => {
    const { result } = renderHook(() => useViewportInsets());
    expect(result.current).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});
