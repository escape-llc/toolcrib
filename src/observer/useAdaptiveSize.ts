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
