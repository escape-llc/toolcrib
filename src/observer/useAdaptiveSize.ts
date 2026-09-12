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
    // The specific element actually passed to observerManager.observe(),
    // captured here rather than re-reading ref.current at cleanup time --
    // if the ref's own .current somehow pointed to a DIFFERENT node by
    // then, unobserving THAT one instead would leave the real observed
    // element tracked forever and unobserve a node that was never
    // observed in the first place.
    let observedEl: HTMLElement | null = null;
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
        // stacking positions: Radix's ToastPrimitive.Root renders through
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

      // Initial measurement
      const rect = el.getBoundingClientRect();
      setSize(prev => ({
        ...prev,
        width: rect.width,
        height: rect.height,
        contentHeight: el.scrollHeight,
      }));

      observerManager.observe(el, config);
      observedEl = el;
    };

    trySetup();

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (observedEl) observerManager.unobserve(observedEl);
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
