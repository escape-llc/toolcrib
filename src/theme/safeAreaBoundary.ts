'use client';

// The shared "safe area" element behind the viewport insets (#978). It is a
// hidden, fixed-position box that fills the window inside
// `--ai-viewport-inset-*`, one per target document. Anchored popups pass it
// to Base UI as `collisionBoundary`, so they flip or shift inside the safe
// area instead of under an app's own title bar; `useViewportInsets` measures
// it. Its size is pure CSS, so `env()` and theme changes need no JS.
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { aiBus } from '../eventBus/eventBus';
import { useTargetDocument } from './targetDocumentContext';
import { VIEWPORT_INSET } from './viewport';

interface Entry {
  el: HTMLElement;
  count: number;
  listeners: Set<() => void>;
}

/** Marks the element, for tests and for anything that needs to find it. */
export const SAFE_AREA_ATTRIBUTE = 'data-toolcrib-safe-area';

const entries = new WeakMap<Document, Entry>();

function acquire(doc: Document): void {
  let entry = entries.get(doc);
  if (!entry) {
    const el = doc.createElement('div');
    // CSSOM, not a <style> tag or style attribute text, so a strict CSP allows it.
    el.setAttribute(SAFE_AREA_ATTRIBUTE, '');
    // No aria-hidden: it's empty and visibility: hidden, so it's already out
    // of the accessibility tree, and a body-level aria-hidden sibling is what
    // a hide-others check (combobox-popover.spec.ts) rightly flags.
    el.style.position = 'fixed';
    el.style.top = VIEWPORT_INSET.top;
    el.style.right = VIEWPORT_INSET.right;
    el.style.bottom = VIEWPORT_INSET.bottom;
    el.style.left = VIEWPORT_INSET.left;
    el.style.pointerEvents = 'none';
    el.style.visibility = 'hidden';
    doc.body.appendChild(el);
    entry = { el, count: 0, listeners: new Set() };
    entries.set(doc, entry);
  }
  entry.count += 1;
  entry.listeners.forEach(l => l());
}

function release(doc: Document): void {
  const entry = entries.get(doc);
  if (!entry) return;
  entry.count -= 1;
  if (entry.count <= 0) {
    entry.el.remove();
    entries.delete(doc);
  }
  entry.listeners.forEach(l => l());
}

/**
 * The safe-area element of the target document, once it exists. It is
 * created on the client after mount (never during render or SSR) and shared
 * by every consumer in that document; the last one to unmount removes it.
 * Returns `undefined` until then.
 * @barrelExport
 */
export function useSafeAreaBoundary(): HTMLElement | undefined {
  const target = useTargetDocument();
  const subscribe = useCallback(
    (onChange: () => void) => {
      const doc = target ?? document;
      acquire(doc);
      // acquire() has run before this listener exists, so the first snapshot read sees the element.
      const entry = entries.get(doc);
      entry?.listeners.add(onChange);
      return () => {
        entry?.listeners.delete(onChange);
        release(doc);
      };
    },
    [target]
  );
  const getSnapshot = useCallback(() => {
    const doc = target ?? (typeof document === 'undefined' ? undefined : document);
    return (doc && entries.get(doc)?.el) || null;
  }, [target]);
  return useSyncExternalStore(subscribe, getSnapshot, () => null) ?? undefined;
}

/**
 * Props to spread onto a Base UI `*.Positioner`: its `collisionBoundary` set
 * to the safe-area element once it exists. An empty object before that, so
 * Base UI's own default applies rather than an explicit `undefined`.
 */
export function safeAreaPositionerProps(boundary: HTMLElement | undefined): { collisionBoundary?: Element } {
  return boundary ? { collisionBoundary: boundary } : {};
}

/** The viewport's insets in px. @barrelExport */
export interface ViewportInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ZERO = '0,0,0,0';

/**
 * The current viewport insets in px: how far the app shell must stay from
 * each window edge (an app's own title bar, a device safe area), from the
 * Viewport theme setting. Measured from the safe-area element against the
 * target window, and updated on window resize, on the element's own size
 * change, and on `theme:changed`. All zeros on the server and before mount.
 * @barrelExport
 */
export function useViewportInsets(): ViewportInsets {
  const target = useTargetDocument();
  const boundary = useSafeAreaBoundary();
  const subscribe = useCallback(
    (onChange: () => void) => {
      const win = (target ?? document).defaultView;
      win?.addEventListener('resize', onChange);
      const off = aiBus.on('theme:changed', onChange);
      const Observer = win && (win as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
      const observer = boundary && Observer ? new Observer(onChange) : undefined;
      if (boundary) observer?.observe(boundary);
      return () => {
        win?.removeEventListener('resize', onChange);
        off();
        observer?.disconnect();
      };
    },
    [target, boundary]
  );
  const getSnapshot = useCallback(() => {
    const win = (target ?? document).defaultView;
    if (!boundary || !win) return ZERO;
    const r = boundary.getBoundingClientRect();
    // An unlaid-out element (display: none ancestor, no layout engine) measures as an empty box at the origin: no information, not "inset everywhere".
    if (r.width === 0 && r.height === 0) return ZERO;
    const round = (n: number) => Math.max(0, Math.round(n * 100) / 100);
    return [round(r.top), round(win.innerWidth - r.right), round(win.innerHeight - r.bottom), round(r.left)].join(',');
  }, [target, boundary]);
  const key = useSyncExternalStore(subscribe, getSnapshot, () => ZERO);
  return useMemo(() => {
    const [top, right, bottom, left] = key.split(',').map(Number);
    return { top, right, bottom, left };
  }, [key]);
}
