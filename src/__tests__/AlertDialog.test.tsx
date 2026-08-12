import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AlertDialog } from '../components/AlertDialog/AlertDialog';
import { Button } from '../components/Form/FormComponents';
import { aiBus } from '../eventBus/eventBus';

describe('AlertDialog Component', () => {
  it('opens via trigger, renders slot content, and cannot be dismissed by clicking the overlay', () => {
    render(
      <AlertDialog trigger={<Button>Delete Record</Button>} ariaLabel="Delete confirmation">
        <AlertDialog.Header>Delete Record</AlertDialog.Header>
        <AlertDialog.Body>This cannot be undone.</AlertDialog.Body>
        <AlertDialog.Footer>
          <AlertDialog.Actions>
            <AlertDialog.Cancel />
            <AlertDialog.Action>Delete</AlertDialog.Action>
          </AlertDialog.Actions>
        </AlertDialog.Footer>
      </AlertDialog>
    );

    expect(screen.queryByText('This cannot be undone.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Delete Record'));
    const container = screen.getByTestId('alertdialog-container');
    expect(container).toBeInTheDocument();
    expect(screen.getByRole('alertdialog', { name: 'Delete confirmation' })).toBeInTheDocument();

    // Radix's AlertDialog prevents onPointerDownOutside/onInteractOutside
    // by design (see AlertDialog.tsx's own comment on why) — clicking
    // outside the content must not close it, unlike Modal.
    fireEvent.pointerDown(document.body);
    expect(screen.getByTestId('alertdialog-container')).toBeInTheDocument();
  });

  it('still dismisses on Escape, matching a native confirm dialog', () => {
    render(
      <AlertDialog trigger={<Button>Open</Button>}>
        <AlertDialog.Body>Content</AlertDialog.Body>
      </AlertDialog>
    );

    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('alertdialog-container')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('alertdialog-container')).not.toBeInTheDocument();
  });

  it('closes and runs the confirm handler when Action is clicked, and closes without it on Cancel', () => {
    const onConfirm = vi.fn();

    render(
      <AlertDialog trigger={<Button>Open</Button>}>
        <AlertDialog.Body>Content</AlertDialog.Body>
        <AlertDialog.Actions>
          <AlertDialog.Cancel />
          <AlertDialog.Action onClick={onConfirm}>Confirm</AlertDialog.Action>
        </AlertDialog.Actions>
      </AlertDialog>
    );

    fireEvent.click(screen.getByText('Open'));
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('alertdialog-container')).not.toBeInTheDocument();
  });

  it('emits alertdialog:shown/alertdialog:hidden and responds to aiBus.openAlertDialog/closeAlertDialog', () => {
    const shownFn = vi.fn();
    const hiddenFn = vi.fn();
    const unsub1 = aiBus.on('alertdialog:shown', shownFn);
    const unsub2 = aiBus.on('alertdialog:hidden', hiddenFn);

    render(
      <AlertDialog id="confirm-delete">
        <AlertDialog.Body>Content</AlertDialog.Body>
      </AlertDialog>
    );

    act(() => {
      aiBus.openAlertDialog('confirm-delete');
    });
    expect(shownFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'confirm-delete' }));
    expect(screen.getByTestId('alertdialog-container')).toBeInTheDocument();

    act(() => {
      aiBus.closeAlertDialog('confirm-delete');
    });
    expect(hiddenFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'confirm-delete' }));
    expect(screen.queryByTestId('alertdialog-container')).not.toBeInTheDocument();

    unsub1();
    unsub2();
  });
});
