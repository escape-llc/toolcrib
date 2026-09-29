'use client';

import { useRef } from 'react';

/**
 * For a component that both emits a bus event and listens for it (a Modal
 * emits `modal:shown` on open and also opens on `modal:shown`, so a bus
 * command can drive it). The bus dispatches synchronously, so the
 * component's own listener runs in the middle of its own `emit()` -- before
 * React has applied the state change -- and a render-time `isOpen` guard
 * can't tell that echo from a real command. It re-applied the change and
 * called the consumer's `onOpenChange` a second time (#705).
 *
 * `emitOwn(() => aiBus.emit(...))` marks the emission; the listener returns
 * early while `isOwnEcho()` is true. Other listeners, and commands from
 * anywhere else, are unaffected. Not exported from the barrel: internal
 * plumbing for the toolkit's own components.
 */
export function useOwnEmit(): { emitOwn: (emit: () => void) => void; isOwnEcho: () => boolean } {
  const emitting = useRef(false);
  return {
    emitOwn: emit => {
      emitting.current = true;
      try {
        emit();
      } finally {
        emitting.current = false;
      }
    },
    isOwnEcho: () => emitting.current,
  };
}
