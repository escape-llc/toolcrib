'use client';

import { useEffect, useRef } from 'react';
import { aiBus, type AIEventMap, type EventKey, type EventCallback } from './eventBus';

/**
 * Custom React hook for AI consumption.
 * Automatically subscribes to the AIEventBus on mount and cleans up on unmount.
 *
 * @example
 * useAIEvent('modal:shown', (event) => {
 *   if (event.id === 'delete-confirm') setTargetId(event.data);
 * });
 */
/** @barrelExport */
export function useAIEvent<K extends EventKey>(
  event: K,
  callback: EventCallback<K>
): void {
  const savedCallback = useRef<EventCallback<K>>(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = (payload: AIEventMap[K]) => {
      if (savedCallback.current) {
        savedCallback.current(payload);
      }
    };

    const unsubscribe = aiBus.on(event, handler);
    return () => {
      unsubscribe();
    };
  }, [event]);
}
