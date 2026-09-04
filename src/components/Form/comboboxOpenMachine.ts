/**
 * SPIKE — for issue #125. Not a real toolkit primitive.
 *
 * Models only the historically-fragile kernel of Combobox's own interaction
 * state: open/closed, and keyboard-driven activeIndex navigation. This is
 * deliberately narrow -- query text, async search, multi-select value, and
 * chips all stay ordinary React state in the component, exactly like the
 * real Combobox.tsx today. The point of this spike is standardizing the
 * specific piece that has real documented past bugs (the isUserTypingRef
 * workaround, manual activeIndex clamping, the anchorRef/onInteractOutside
 * Popover-Anchor hack) onto an explicit statechart, not modeling the whole
 * component as one giant machine.
 *
 * `count` is read fresh via `prop('count')` inside actions rather than
 * threaded through event payloads -- it's the current filtered option
 * count, which the component already recomputes as ordinary React state
 * (staticFilterText/asyncOptions), so the machine just reads the latest
 * value each time an action needs it, matching how the real Combobox reads
 * `filteredOptions.length` directly rather than caching it.
 */
import { createMachine, type MachineSchema } from '@zag-js/core';

export interface ComboboxKernelSchema extends MachineSchema {
  props: { id?: string; count: number };
  context: { activeIndex: number };
  state: 'closed' | 'open';
  event:
    | { type: 'OPEN' }
    | { type: 'CLOSE' }
    | { type: 'ARROW_DOWN' }
    | { type: 'ARROW_UP' }
    | { type: 'HOME' }
    | { type: 'END' }
    | { type: 'CLAMP' };
  action: 'resetIndex' | 'incrementIndex' | 'decrementIndex' | 'indexFirst' | 'indexLast' | 'clampIndex';
}

export const comboboxOpenMachine = createMachine<ComboboxKernelSchema>({
  props: ({ props }) => ({ count: 0, ...props }),
  context: ({ bindable }) => ({
    activeIndex: bindable(() => ({ defaultValue: 0 })),
  }),
  initialState: () => 'closed',
  states: {
    closed: {
      on: {
        OPEN: { target: 'open', actions: ['resetIndex'] },
        ARROW_DOWN: { target: 'open', actions: ['resetIndex'] },
        ARROW_UP: { target: 'open', actions: ['resetIndex'] },
      },
    },
    open: {
      on: {
        CLOSE: { target: 'closed' },
        ARROW_DOWN: { actions: ['incrementIndex'] },
        ARROW_UP: { actions: ['decrementIndex'] },
        HOME: { actions: ['indexFirst'] },
        END: { actions: ['indexLast'] },
        CLAMP: { actions: ['clampIndex'] },
      },
    },
  },
  implementations: {
    actions: {
      resetIndex: ({ context }) => context.set('activeIndex', 0),
      incrementIndex: ({ context, prop }) =>
        context.set('activeIndex', i => Math.min(i + 1, Math.max(prop('count') - 1, 0))),
      decrementIndex: ({ context }) => context.set('activeIndex', i => Math.max(i - 1, 0)),
      indexFirst: ({ context }) => context.set('activeIndex', 0),
      indexLast: ({ context, prop }) => context.set('activeIndex', Math.max(prop('count') - 1, 0)),
      clampIndex: ({ context, prop }) =>
        context.set('activeIndex', i => Math.max(0, Math.min(i, Math.max(prop('count') - 1, 0)))),
    },
  },
});
