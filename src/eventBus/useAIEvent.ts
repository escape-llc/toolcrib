'use client';

import { useEffect, useRef } from 'react';
import { aiBus, type AIEventMap, type EventKey, type EventCallback, type WildcardCallback } from './eventBus';

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

/**
 * Same shape as `useAIEvent`, but for `aiBus.onAny` -- subscribes to every
 * channel the bus ever emits instead of one. Used for cross-cutting
 * concerns spanning the whole event vocabulary (event monitoring,
 * `useInteractionAnalytics`) rather than reacting to a single event.
 *
 * @example
 * useAnyAIEvent(({ type, detail }) => console.log('bus event:', type, detail));
 */
/** @barrelExport */
export function useAnyAIEvent(callback: WildcardCallback): void {
  const savedCallback = useRef<WildcardCallback>(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler: WildcardCallback = (event) => {
      if (savedCallback.current) {
        savedCallback.current(event);
      }
    };

    const unsubscribe = aiBus.onAny(handler);
    return () => {
      unsubscribe();
    };
  }, []);
}
