import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useToastActions } from '../components/Toast/ToastContext';
import { ToastProviderBaseUI as ToastProvider } from '../components/Toast/ToastBaseUI';
import { ToastContainerBaseUI as ToastContainer } from '../components/Toast/ToastBaseUI';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const renderToasts = () =>
  render(
    <ToastProvider>
      <ToastContainer />
    </ToastProvider>
  );

const toastItems = () => screen.queryAllByTestId('toast-item');

afterEach(() => {
  vi.useRealTimers();
});

describe('aiBus.showToastPromise', () => {
  it('shows one loading toast, then updates the same toast to success', async () => {
    renderToasts();
    const updated = vi.fn();
    const added = vi.fn();
    const unsub = aiBus.on('toast:updated', updated);
    const unsubAdded = aiBus.on('toast:added', added);
    const job = deferred<{ name: string }>();

    let returned!: Promise<{ name: string }>;
    act(() => {
      returned = aiBus.showToastPromise(job.promise, { loading: 'Saving…', success: v => `Saved ${v.name}`, error: 'Failed' });
    });
    expect(toastItems()).toHaveLength(1);
    const loadingToast = toastItems()[0];
    expect(loadingToast).toHaveTextContent('Saving…');
    expect(loadingToast).toHaveAttribute('aria-busy', 'true');
    expect(loadingToast).toHaveAttribute('data-loading');
    expect(added.mock.calls[0][0]).toMatchObject({ message: 'Saving…', loading: true });
    unsubAdded();

    await act(async () => {
      job.resolve({ name: 'draft' });
      await returned;
    });
    // Same toast element, updated in place -- not a second toast.
    expect(toastItems()).toHaveLength(1);
    expect(toastItems()[0]).toBe(loadingToast);
    expect(loadingToast).toHaveTextContent('Saved draft');
    expect(loadingToast).not.toHaveAttribute('aria-busy');
    expect(updated).toHaveBeenCalledTimes(1);
    expect(updated.mock.calls[0][0]).toMatchObject({ type: 'success', message: 'Saved draft', loading: false });
    unsub();
  });

  it('updates to error on rejection, and the caller still sees the rejection', async () => {
    renderToasts();
    const job = deferred<void>();
    let returned!: Promise<void>;
    act(() => {
      returned = aiBus.showToastPromise(job.promise, { loading: 'Uploading…', success: 'Done', error: e => `Upload failed: ${(e as Error).message}` });
    });
    const toast = toastItems()[0];
    await act(async () => {
      job.reject(new Error('quota'));
      await expect(returned).rejects.toThrow('quota');
    });
    expect(toastItems()).toHaveLength(1);
    expect(toast).toHaveTextContent('Upload failed: quota');
  });

  it('never auto-dismisses while pending; the normal duration starts once it settles', async () => {
    vi.useFakeTimers();
    renderToasts();
    const job = deferred<void>();
    act(() => {
      aiBus.showToastPromise(job.promise, { loading: 'Working…', success: 'Done', error: 'Failed' });
    });
    // Far past the default 5s duration: still there while pending.
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(toastItems()).toHaveLength(1);
    expect(toastItems()[0]).toHaveTextContent('Working…');

    await act(async () => {
      job.resolve();
      await Promise.resolve();
    });
    expect(toastItems()[0]).toHaveTextContent('Done');
    // Now the normal 5s timer runs; its expiry closes the toast.
    const expired = vi.fn();
    const unsub = aiBus.on('toast:expired', expired);
    act(() => {
      vi.advanceTimersByTime(5100);
    });
    expect(expired).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('keeps the toast id throughout (updateToast via useToastActions)', () => {
    const Harness = () => {
      const { addToast, updateToast } = useToastActions();
      return (
        <>
          <button onClick={() => addToast({ id: 'job', type: 'info', message: 'Queued', loading: true })}>add</button>
          <button onClick={() => updateToast('job', { type: 'warning', message: 'Retrying', loading: false })}>update</button>
          <button onClick={() => updateToast('gone', { message: 'nothing' })}>update-missing</button>
        </>
      );
    };
    const added = vi.fn();
    const unsub = aiBus.on('toast:added', added);
    render(
      <ToastProvider>
        <Harness />
        <ToastContainer />
      </ToastProvider>
    );
    act(() => screen.getByText('add').click());
    act(() => screen.getByText('update').click());
    act(() => screen.getByText('update-missing').click());
    expect(toastItems()).toHaveLength(1);
    expect(toastItems()[0]).toHaveTextContent('Retrying');
    // An update is not a new toast.
    expect(added).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('has no axe violations while loading', async () => {
    const { container } = renderToasts();
    act(() => {
      aiBus.showToastPromise(new Promise(() => {}), { loading: 'Saving…', success: 'Saved', error: 'Failed' });
    });
    expect(await axe(container.ownerDocument.body)).toHaveNoViolations();
  });
});
