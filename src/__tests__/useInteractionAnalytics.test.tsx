import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { aiBus } from '../eventBus/eventBus';
import {
  useInteractionAnalytics,
  defaultInteractionAnalyticsSanitizer,
} from '../eventBus/useInteractionAnalytics';

describe('useInteractionAnalytics', () => {
  it('reports event type plus only the default allowlisted fields (id/formId/name)', () => {
    const report = vi.fn();
    renderHook(() => useInteractionAnalytics(report));

    act(() => {
      aiBus.emit('modal:shown', { id: 'confirm-delete', data: { secret: 'do not leak' } });
    });

    expect(report).toHaveBeenCalledWith({
      type: 'modal:shown',
      detail: { id: 'confirm-delete' },
    });
  });

  it('never reports form:submitted.values -- real end-user data stays out by construction', () => {
    const report = vi.fn();
    renderHook(() => useInteractionAnalytics(report));

    act(() => {
      aiBus.emit('form:submitted', { formId: 'signup', values: { email: 'real-user@example.com', password: 'hunter2' } });
    });

    expect(report).toHaveBeenCalledWith({
      type: 'form:submitted',
      detail: { formId: 'signup' },
    });
  });

  it('never reports toast:shown.message', () => {
    const report = vi.fn();
    renderHook(() => useInteractionAnalytics(report));

    act(() => {
      aiBus.emit('toast:shown', { id: 'toast-1', type: 'error', message: 'Card ending in 4242 was declined' });
    });

    expect(report).toHaveBeenCalledWith({
      type: 'toast:shown',
      detail: { id: 'toast-1' },
    });
  });

  it('never reports a *:changed event\'s own picked value', () => {
    const report = vi.fn();
    renderHook(() => useInteractionAnalytics(report));

    act(() => {
      aiBus.emit('select:changed', { name: 'contactPref', value: 'phone' });
    });

    expect(report).toHaveBeenCalledWith({
      type: 'select:changed',
      detail: { name: 'contactPref' },
    });
  });

  it('never serializes element:resized/intersected\'s raw target HTMLElement', () => {
    const report = vi.fn();
    renderHook(() => useInteractionAnalytics(report));
    const el = document.createElement('div');

    act(() => {
      aiBus.emit('element:resized', { id: 'panel-1', target: el, width: 320, height: 240, contentHeight: 480 });
    });

    expect(report).toHaveBeenCalledWith({
      type: 'element:resized',
      detail: { id: 'panel-1' },
    });
  });

  it('reports error:boundary\'s componentName but strips error/stack (can leak file paths)', () => {
    const report = vi.fn();
    renderHook(() => useInteractionAnalytics(report));

    act(() => {
      aiBus.emit('error:boundary', {
        componentName: 'DataTable',
        error: 'TypeError: Cannot read properties of undefined at /Users/real-name/secret-project/src/App.tsx:42',
        stack: 'at /Users/real-name/secret-project/src/App.tsx:42:10',
      });
    });

    expect(report).toHaveBeenCalledWith({
      type: 'error:boundary',
      detail: { componentName: 'DataTable' },
    });
  });

  it('drops a payload field entirely if it exists but is not a string (allowlist checks type, not just presence)', () => {
    const report = vi.fn();
    renderHook(() => useInteractionAnalytics(report));

    act(() => {
      // datatable:paginated has no id/formId/name/componentName field at all
      aiBus.emit('datatable:paginated', { id: 42 as unknown as string, page: 2, pageSize: 25 });
    });

    // `id` is present but not a string -- the allowlist requires both.
    expect(report).toHaveBeenCalledWith({ type: 'datatable:paginated', detail: {} });
  });

  it('lets a custom sanitize option replace the default entirely', () => {
    const report = vi.fn();
    const sanitize = vi.fn().mockReturnValue({ custom: true });
    renderHook(() => useInteractionAnalytics(report, { sanitize }));

    act(() => {
      aiBus.emit('modal:shown', { id: 'custom-test' });
    });

    expect(sanitize).toHaveBeenCalledWith('modal:shown', { id: 'custom-test' });
    expect(report).toHaveBeenCalledWith({ type: 'modal:shown', detail: { custom: true } });
  });

  it('a custom sanitize can compose the default sanitizer rather than reimplementing it', () => {
    const report = vi.fn();
    renderHook(() =>
      useInteractionAnalytics(report, {
        sanitize: (type, payload) => ({
          ...defaultInteractionAnalyticsSanitizer(type, payload),
          eventCategory: type.split(':')[0],
        }),
      })
    );

    act(() => {
      aiBus.emit('drawer:shown', { id: 'compose-test', position: 'right' });
    });

    expect(report).toHaveBeenCalledWith({
      type: 'drawer:shown',
      detail: { id: 'compose-test', eventCategory: 'drawer' },
    });
  });

  it('unsubscribes on unmount -- no further reports after the hook is torn down', () => {
    const report = vi.fn();
    const { unmount } = renderHook(() => useInteractionAnalytics(report));

    unmount();

    act(() => {
      aiBus.emit('modal:shown', { id: 'after-unmount' });
    });

    expect(report).not.toHaveBeenCalled();
  });

  it('defaultInteractionAnalyticsSanitizer tolerates a non-object payload', () => {
    expect(defaultInteractionAnalyticsSanitizer('route:navigate', null)).toEqual({});
  });
});
