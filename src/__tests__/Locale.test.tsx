import { describe, it, expect, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { LocaleProvider, useLocaleStrings, defaultLocaleStrings } from '../components/Locale/LocaleContext';
import { aiBus } from '../eventBus/eventBus';

describe('useLocaleStrings', () => {
  it('returns defaultLocaleStrings verbatim with no LocaleProvider mounted', () => {
    const { result } = renderHook(() => useLocaleStrings());
    expect(result.current).toBe(defaultLocaleStrings);
  });

  it('merges a partial override, leaving a sibling field on the same block at its default', () => {
    const { result } = renderHook(() => useLocaleStrings(), {
      wrapper: ({ children }) => (
        <LocaleProvider strings={{ pagination: { nextPage: 'Volgende' } }}>{children}</LocaleProvider>
      ),
    });

    expect(result.current.pagination.nextPage).toBe('Volgende');
    expect(result.current.pagination.previousPage).toBe(defaultLocaleStrings.pagination.previousPage);
  });

  it('leaves an unrelated component block completely untouched', () => {
    const { result } = renderHook(() => useLocaleStrings(), {
      wrapper: ({ children }) => (
        <LocaleProvider strings={{ pagination: { nextPage: 'Volgende' } }}>{children}</LocaleProvider>
      ),
    });

    expect(result.current.tree.treeLabel).toBe(defaultLocaleStrings.tree.treeLabel);
  });

  it('overriding a templated-string field replaces the function, not just a static value', () => {
    const { result } = renderHook(() => useLocaleStrings(), {
      wrapper: ({ children }) => (
        <LocaleProvider strings={{ combobox: { removeItem: (label: string) => `Verwijder ${label}` } }}>
          {children}
        </LocaleProvider>
      ),
    });

    expect(result.current.combobox.removeItem('Foo')).toBe('Verwijder Foo');
    expect(result.current.combobox.clearSelection).toBe(defaultLocaleStrings.combobox.clearSelection);
  });
});

describe('LocaleProvider locale:changed broadcast', () => {
  it('emits locale:changed with the merged strings on mount', () => {
    const callback = vi.fn();
    const unsubscribe = aiBus.on('locale:changed', callback);

    render(
      <LocaleProvider strings={{ tree: { treeLabel: 'Boom' } }}>
        <div>content</div>
      </LocaleProvider>
    );

    expect(callback).toHaveBeenCalledWith({
      strings: expect.objectContaining({ tree: expect.objectContaining({ treeLabel: 'Boom' }) }),
    });
    unsubscribe();
  });

  it('emits again when the strings prop changes', () => {
    const callback = vi.fn();
    const unsubscribe = aiBus.on('locale:changed', callback);

    const { rerender } = render(
      <LocaleProvider strings={{ tree: { treeLabel: 'Boom' } }}>
        <div>content</div>
      </LocaleProvider>
    );
    const callsAfterMount = callback.mock.calls.length;

    rerender(
      <LocaleProvider strings={{ tree: { treeLabel: 'Arbre' } }}>
        <div>content</div>
      </LocaleProvider>
    );

    expect(callback.mock.calls.length).toBeGreaterThan(callsAfterMount);
    expect(callback).toHaveBeenLastCalledWith({
      strings: expect.objectContaining({ tree: expect.objectContaining({ treeLabel: 'Arbre' }) }),
    });
    unsubscribe();
  });
});
