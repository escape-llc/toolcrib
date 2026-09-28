import { act } from '@testing-library/react';

/**
 * Lets a Base UI overlay finish what it defers past the event that opened or
 * closed it (#696), inside act(). Base UI moves focus into an opened popup
 * and unmounts a closed one on a later animation frame, not synchronously, so
 * a test that asserts right after a click reads the DOM before that happens
 * and React reports the late state updates (focus-within tracking in
 * react-aria's Group, for one) as not wrapped in act(). This is AGENTS.md's
 * act() case 2: the library schedules the follow-up, so there's no single
 * call to wrap; flush it instead.
 *
 * Two frames: one for Base UI's own deferred step, one for the effects and
 * state updates it triggers.
 */
export async function settleOverlay(): Promise<void> {
  for (let i = 0; i < 2; i++) {
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
    });
  }
}

/** Runs `interaction` (a click, a key press) inside act(), then settles the overlay. */
export async function actAndSettle(interaction: () => void): Promise<void> {
  act(interaction);
  await settleOverlay();
}
