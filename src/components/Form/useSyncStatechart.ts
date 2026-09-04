/**
 * SPIKE — for issue #125, not a real toolkit primitive yet. Not exported,
 * not manifest-tagged.
 *
 * A minimal, synchronous React binding for a @zag-js/core machine, built
 * from the same public exports @zag-js/react's own useMachine uses
 * (findTransition/resolveStateValue/getExitEnterStates/matchesState/hasTag/
 * createScope -- see @zag-js/core's index.d.ts). The one deliberate
 * difference: @zag-js/react's `send` defers every transition through
 * `queueMicrotask` before applying it (confirmed by reading
 * @zag-js/react/dist/machine.mjs directly during the #124 spike) -- that
 * makes every interaction test async-and-flush, incompatible with this
 * codebase's synchronous fireEvent-then-assert convention used everywhere
 * else. This hook applies a transition immediately, synchronously, inside
 * the triggering event handler, via flushSync.
 *
 * `bindable` is @zag-js/core machines' own hook for a context/state field
 * that supports controlled/uncontrolled + onChange -- @zag-js/react ships
 * one (bindable.mjs) but doesn't export it publicly, and its real
 * implementation is ~20 lines of plain React hooks, not zag-specific
 * machinery, so it's reproduced here rather than reached into a private
 * module path. `machine.context?.(...)` calling `bindable` (a hook)
 * unconditionally, once per render, in a stable field order -- rather than
 * inside a useMemo/useEffect -- is exactly how @zag-js/react's own
 * machine.mjs does it too; it satisfies React's Rules of Hooks as long as
 * the machine's own field set never changes across renders, which a
 * module-level machine definition guarantees by construction.
 *
 * Deliberately scoped to what a small, purely-internal kernel machine
 * needs: state + context, synchronous send, matches/hasTag. No refs,
 * computed, effects, or watch -- add them if a future machine actually
 * needs one, rather than porting @zag-js/react's full surface area
 * speculatively.
 */
import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  createScope,
  findTransition,
  getExitEnterStates,
  hasTag,
  matchesState,
  resolveStateValue,
  type Machine,
  type MachineSchema,
  type Params,
} from '@zag-js/core';

interface BindableParams<T> {
  defaultValue?: T;
  value?: T;
  onChange?: (next: T, prev: T) => void;
}

interface BindableField<T> {
  ref: { current: T };
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  initial: T | undefined;
}

function useBindable<T>(getProps: () => BindableParams<T>): BindableField<T> {
  const props = getProps();
  const [initialValue] = useState(props.value ?? (props.defaultValue as T));
  const [value, setValue] = useState(initialValue);
  const controlled = props.value !== undefined;
  const valueRef = useRef(controlled ? props.value! : value);
  // eslint-disable-next-line react-hooks/refs -- valueRef exists specifically so send()'s synchronous action chain (context.get/context.set, called outside render, from event handlers) always reads the latest value; this mutation itself never affects this render's own output, only later synchronous reads. Same "keep a live ref for callbacks" pattern @zag-js/react's own bindable.mjs uses (not linted by this repo's rules since it's an external package).
  valueRef.current = controlled ? props.value! : value;

  return {
    ref: valueRef,
    initial: initialValue,
    get: () => (controlled ? props.value! : value),
    set(next) {
      const prev = valueRef.current;
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      // No flushSync here -- send() is always invoked from inside a normal
      // React event handler (already auto-batched) or from a top-level
      // synchronous call in a test, and RTL's fireEvent already wraps in
      // act(), which flushes this before the next assertion runs. The
      // state's own onChange callback below receives `resolved`/`prev` as
      // direct parameters, so it never needs state.get() to already reflect
      // the change mid-call -- there was no correctness reason for the
      // unconditional flushSync this file used to have here, only a
      // (wrong) instinct to mirror @zag-js/react's own conditional `sync`
      // flag. Discovered via a real "flushSync called from inside a
      // lifecycle method" warning once a transition's action chain nested
      // two of these calls -- React disallows nesting flushSync.
      if (!controlled) setValue(resolved);
      if (!Object.is(resolved, prev)) props.onChange?.(resolved, prev);
    },
  };
}

function useLiveRef<T>(value: T) {
  const ref = useRef(value);
  // eslint-disable-next-line react-hooks/refs -- same live-ref-for-later-callbacks pattern as valueRef above; only ever read from send()/action() outside render.
  ref.current = value;
  return ref;
}

function useConst<T>(init: () => T): T {
  const ref = useRef<{ v: T }>(undefined as any);
  // eslint-disable-next-line react-hooks/refs -- standard lazy-ref-init guard (React's own docs pattern for "compute this once"); ref.current is never read for this render's own output, only to decide whether initialization already ran.
  if (!ref.current) ref.current = { v: init() };
  // eslint-disable-next-line react-hooks/refs -- reads the just-established (or prior) stable value; ctx below is itself a stable object never affecting render output directly.
  return ref.current.v;
}

export function useSyncStatechart<T extends MachineSchema>(machine: Machine<T>, userProps: Partial<T['props']> = {}) {
  const scope = useMemo(
    () => createScope({ id: (userProps as any).id, getRootNode: () => document }),
    [userProps]
  );
  const props = (machine.props?.({ props: userProps, scope }) ?? userProps) as T['props'];
  const propsRef = useLiveRef(props);
  const prop = <K extends keyof T['props']>(key: K): T['props'][K] => (propsRef.current as any)[key];

  const eventRef = useRef<any>({ type: '' });
  const previousEventRef = useRef<any>(null);
  const getEvent = () => ({
    ...eventRef.current,
    current: () => eventRef.current,
    previous: () => previousEventRef.current,
  });

  // Called directly in the render body, unconditionally, every render --
  // NOT inside useMemo/useEffect. `bindable` (== useBindable, a hook) gets
  // invoked once per context field, in the same order every render, which
  // is exactly what makes this a valid Rules-of-Hooks call site: the set of
  // fields a module-level `machine.context` closure iterates over can never
  // change between renders. Matches @zag-js/react's own machine.mjs.
  // eslint-disable-next-line react-hooks/refs -- flagged because `bindable` (useBindable) touches refs internally; each field's returned `.ref` is only ever read later, from send()/action() outside render, never used to compute this render's own JSX.
  const context = (machine.context?.({
    prop: prop as any,
    bindable: useBindable as any,
    scope,
    getContext: () => ctx as any,
    getComputed: () => (() => undefined) as any,
    getRefs: () => ({ get: () => undefined, set: () => {} }) as any,
    getEvent,
    flush: fn => fn(),
  }) ?? {}) as Record<string, BindableField<any>>;
  const contextRef = useLiveRef(context);

  const ctx = useConst(() => ({
    get(key: any) {
      return contextRef.current[key].ref.current;
    },
    set(key: any, value: any) {
      contextRef.current[key].set(value);
    },
    initial(key: any) {
      return contextRef.current[key].initial;
    },
    hash(key: any) {
      return String(contextRef.current[key].ref.current);
    },
  }));

  const transitionActionsRef = useRef<T['action'][] | undefined>(undefined);

  const action = (keys: T['action'][] | undefined | ((p: Params<T>) => T['action'][] | undefined)) => {
    const strs = typeof keys === 'function' ? (keys as any)(getParams()) : keys;
    if (!strs) return;
    for (const s of strs) {
      const fn = (machine.implementations?.actions as any)?.[s];
      fn?.(getParams());
    }
  };

  const guard = (g: T['guard'] | ((p: Params<T>) => boolean)): boolean => {
    if (typeof g === 'function') return (g as any)(getParams());
    const fn = (machine.implementations?.guards as any)?.[g];
    return !!fn?.(getParams());
  };

  const choose = (transitions: any) => {
    const arr = Array.isArray(transitions) ? transitions : transitions ? [transitions] : [];
    return arr.find((t: any) => !t.guard || guard(t.guard));
  };

  const getCurrentState = () => state.get();
  const getState = () => ({
    ...state,
    matches: (...values: T['state'][]) => values.some(v => matchesState(getCurrentState(), v as string)),
    hasTag: (tag: T['tag']) => hasTag(machine, getCurrentState(), tag),
  });

  const getParams = (): Params<T> => ({
    state: getState() as any,
    context: ctx as any,
    event: getEvent(),
    prop: prop as any,
    send,
    action: action as any,
    guard: guard as any,
    computed: (() => undefined) as any,
    refs: { get: () => undefined, set: () => {} } as any,
    scope,
    choose: choose as any,
    track: () => {},
    flush: fn => fn(),
  });

  function send(event: any) {
    previousEventRef.current = eventRef.current;
    eventRef.current = event;
    const currentState = getCurrentState();
    const { transitions } = findTransition(machine, currentState, event.type);
    const transition = choose(transitions);
    if (!transition) return;
    transitionActionsRef.current = transition.actions;
    const target = resolveStateValue(machine, transition.target ?? currentState);
    if (target !== currentState) {
      flushSync(() => state.set(target));
    } else {
      action(transition.actions);
    }
  }

  const state = useBindable<T['state']>(() => ({
    defaultValue: resolveStateValue(machine, machine.initialState({ prop: prop as any })),
    onChange(nextState, prevState) {
      const { exiting, entering } = getExitEnterStates(machine, prevState, nextState);
      exiting.forEach(item => action(item.state?.exit));
      action(transitionActionsRef.current);
      entering.forEach(item => action(item.state?.entry));
    },
  }));

  return { state: getState(), send, context: ctx, prop };
}
