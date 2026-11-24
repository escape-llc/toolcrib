'use client';

import { useState, useEffect, type RefObject } from 'react';
import { observerManager, type ObservedElementConfig } from './observerManager';
import { useAIEvent } from '../eventBus/useAIEvent';

/** @barrelExport */
export interface AdaptiveSizeResult {
  width: number;
  height: number;
  contentHeight: number;
  isIntersecting: boolean;
}

/** `el`'s content-box size, matching ResizeObserver's `contentRect`. */
function contentBoxSize(el: HTMLElement): { width: number; height: number } {
  const style = (el.ownerDocument.defaultView ?? window).getComputedStyle(el);
  const px = (v: string) => parseFloat(v) || 0;
  return {
    width: Math.max(0, el.clientWidth - px(style.paddingLeft) - px(style.paddingRight)),
    height: Math.max(0, el.clientHeight - px(style.paddingTop) - px(style.paddingBottom)),
  };
}

/**
 * Tracks `ref`'s content-box size (the box ResizeObserver's `contentRect`
 * reports: no padding, border or scrollbar), its `scrollHeight`, and whether
 * it is intersecting the viewport.
 */
export function useAdaptiveSize(
  ref: RefObject<HTMLElement | null>,
  config: ObservedElementConfig = {}
): AdaptiveSizeResult {
  const [size, setSize] = useState<AdaptiveSizeResult>({
    width: 0,
    height: 0,
    contentHeight: 0,
    isIntersecting: true,
  });

  useEffect(() => {
    let cancelled = false;
    let rafId: number | null = null;
    let attempts = 0;
    // The remover for the registration observerManager.observe() made, kept
    // here rather than re-reading ref.current at cleanup time: if the ref
    // pointed at a different node by then, cleanup would leave the real
    // observed element tracked forever.
    let stopObserving: (() => void) | null = null;
    // A handful of frames is plenty for a portal target to finish
    // attaching (see this loop's own comment below) without risking a
    // real infinite retry loop for a ref that's genuinely never assigned.
    const MAX_ATTACH_RETRY_FRAMES = 10;

    const trySetup = () => {
      if (cancelled) return;
      const el = ref.current;
      if (!el) {
        // ref.current can still be null on this effect's very first run --
        // confirmed for real (not theoretical) building <Toast>'s own
        // stacking positions: an overlay primitive's root renders through
        // an internal portal, and on the FIRST toast ever mounted, the
        // portal's own target container can still be getting set up in
        // the same commit, so this component's ref hasn't attached to the
        // real DOM node yet by the time this effect body runs. Nothing
        // else would ever re-run this effect once the ref DOES attach --
        // mutating a ref's .current never triggers a re-render or a
        // dependency change -- so without this retry, that element's size
        // silently never gets measured at all, for the rest of its
        // lifetime. A bounded requestAnimationFrame retry is the fix:
        // the ref reliably attaches within the next frame or two once its
        // portal target exists, well inside the retry budget below.
        if (attempts++ < MAX_ATTACH_RETRY_FRAMES) {
          rafId = requestAnimationFrame(trySetup);
        }
        return;
      }

      // Initial measurement, in the same box every later element:resized
      // reports (ResizeObserver's contentRect: the content box, without
      // padding, border or scrollbar, and untransformed).
      // getBoundingClientRect() measured the border box, so a padded or
      // bordered element's size jumped once the first resize event
      // arrived, with no layout change (#981).
      const { width, height } = contentBoxSize(el);
      setSize(prev => ({
        ...prev,
        width,
        height,
        contentHeight: el.scrollHeight,
      }));

      stopObserving = observerManager.observe(el, config);
    };

    trySetup();

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      // Removes only this hook's registration; another hook on the same element keeps its own (#982).
      stopObserving?.();
    };
    // Deliberately destructured, not the whole `config` object -- `config`
    // has a default parameter value (`= {}`), so a caller who omits it
    // gets a brand-new object every render; depending on the object
    // itself would re-run this effect (and re-subscribe to the observer)
    // on every render for that common case. Every field ObservedElementConfig
    // actually declares (id/debounceMs/enableIntersection) is already listed
    // individually below, so nothing is silently going stale -- confirmed
    // against that interface's own shape, not assumed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, config.id, config.debounceMs, config.enableIntersection]);

  useAIEvent('element:resized', event => {
    if (ref.current && event.target === ref.current) {
      setSize(prev => ({
        ...prev,
        width: event.width,
        height: event.height,
        contentHeight: event.contentHeight,
      }));
    }
  });

  useAIEvent('element:intersected', event => {
    if (ref.current && event.target === ref.current) {
      setSize(prev => ({
        ...prev,
        isIntersecting: event.isIntersecting,
      }));
    }
  });

  return size;
}
