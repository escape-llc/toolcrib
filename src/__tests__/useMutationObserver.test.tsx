import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMutationObserver } from '../observer/useMutationObserver';

const flushMicrotasks = () => act(() => new Promise(resolve => queueMicrotask(() => resolve(undefined))));

function renderWithRealElement(mutationOptions: MutationObserverInit, onMutation: (e: any) => void, config?: { id?: string; enabled?: boolean }) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const ref = { current: el as HTMLElement | null };
  const hook = renderHook(() => useMutationObserver(ref, mutationOptions, onMutation, config));
  return { ...hook, ref, el };
}

describe('useMutationObserver', () => {
  // Caught in review (Gemini, PR #516): every test in this file appends
  // real elements to document.body (renderWithRealElement, plus several
  // tests' own extra elements for the "unrelated"/"subtree descendant"
  // cases) with no cleanup, unlike observer.test.ts's own established
  // per-test removeChild convention -- real DOM pollution across tests
  // in this file, confirmed true, not a false positive. A single
  // afterEach clearing document.body is more robust than tracking each
  // element individually (can't miss one), and applies uniformly
  // regardless of how many elements any given test happens to create.
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('calls onMutation for a matching attribute change on its own ref', async () => {
    const onMutation = vi.fn();
    const { el } = renderWithRealElement({ attributes: true, attributeFilter: ['data-side'] }, onMutation);

    act(() => {
      el.setAttribute('data-side', 'top');
    });
    await flushMicrotasks();

    expect(onMutation).toHaveBeenCalledWith(
      expect.objectContaining({ target: el, attributeName: 'data-side', type: 'attributes' })
    );
  });

  it('calls onMutation for a subtree descendant mutation when subtree: true', async () => {
    const onMutation = vi.fn();
    const { el, ref } = renderWithRealElement({ attributes: true, attributeFilter: ['data-side'], subtree: true }, onMutation);
    const child = document.createElement('span');
    el.appendChild(child);

    act(() => {
      child.setAttribute('data-side', 'bottom');
    });
    await flushMicrotasks();

    expect(onMutation).toHaveBeenCalledWith(expect.objectContaining({ target: child }));
    // Sanity: the callback really did receive the DESCENDANT as target,
    // not the ref'd root -- confirms the containment check (`el.contains`)
    // in this hook's own event filter, not just a coincidental match.
    expect(ref.current).toBe(el);
    expect(onMutation.mock.calls[0][0].target).not.toBe(el);
  });

  it('ignores a mutation on an unrelated element outside its own ref subtree', async () => {
    const onMutation = vi.fn();
    renderWithRealElement({ attributes: true, attributeFilter: ['data-side'] }, onMutation);
    const other = document.createElement('div');
    document.body.appendChild(other);

    act(() => {
      other.setAttribute('data-side', 'left');
    });
    await flushMicrotasks();

    expect(onMutation).not.toHaveBeenCalled();
  });

  it('does not subscribe at all while enabled is false', async () => {
    const onMutation = vi.fn();
    const { el } = renderWithRealElement({ attributes: true, attributeFilter: ['data-side'] }, onMutation, { enabled: false });

    act(() => {
      el.setAttribute('data-side', 'top');
    });
    await flushMicrotasks();

    expect(onMutation).not.toHaveBeenCalled();
  });

  it('does nothing when the ref has no current element yet', () => {
    const ref = { current: null };
    expect(() => renderHook(() => useMutationObserver(ref, { attributes: true }, vi.fn()))).not.toThrow();
  });

  // Same shape as useAdaptiveSize's own identical regression test --
  // Radix Presence-mounted content (a Popover Content, e.g.) can land
  // one render tick after this hook's own mount effect already ran and
  // found the ref null.
  it('retries via requestAnimationFrame if the ref is not attached on the first effect run, then observes once it is', async () => {
    const onMutation = vi.fn();
    const ref: { current: HTMLElement | null } = { current: null };
    renderHook(() => useMutationObserver(ref, { attributes: true, attributeFilter: ['data-side'] }, onMutation));

    const el = document.createElement('div');
    document.body.appendChild(el);
    ref.current = el;

    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });

    act(() => {
      el.setAttribute('data-side', 'right');
    });
    await flushMicrotasks();

    expect(onMutation).toHaveBeenCalledWith(expect.objectContaining({ target: el, attributeName: 'data-side' }));
  });
});
