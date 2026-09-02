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
    const el = ref.current;
    if (!el) return;

    // Initial measurement
    const rect = el.getBoundingClientRect();
    setSize(prev => ({
      ...prev,
      width: rect.width,
      height: rect.height,
      contentHeight: el.scrollHeight,
    }));

    observerManager.observe(el, config);

    return () => {
      observerManager.unobserve(el);
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
