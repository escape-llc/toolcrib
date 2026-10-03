'use client';

import React, { useContext, useState } from 'react';
import { useFieldsetDisabled } from '../Fieldset/FieldsetContext';
import { Slider as BaseSlider } from '@base-ui/react/slider';
import { aiBus } from '../../eventBus/eventBus';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { FieldContext } from './FieldContext';
import { SliderThemeSlice, type SliderSliceState } from './SliderSlice';
import { sliderRootStyle, sliderControlStyle, SLIDER_TRACK_STYLE, SLIDER_RANGE_STYLE, sliderThumbStyle } from './sliderStyles';

/**
 * Props for the `<Slider>` range input control.
 *
 * Emits `slider:changed` events on the event bus.
 */
export interface SliderProps {
  /** Element id for the thumb. Auto-derived from `name` (or the inherited `<FormField>` name) if omitted. Inside a `<FormField label>`, the thumb's accessible name comes from that label via `aria-labelledby`. */
  id?: string;
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. Used in event bus payloads. */
  name?: string;
  /** Controlled current value. */
  value?: number;
  /** Initial value (uncontrolled). @default 50 */
  defaultValue?: number;
  /** Minimum value. @default 0 */
  min?: number;
  /** Maximum value. @default 100 */
  max?: number;
  /** Step increment. @default 1 */
  step?: number;
  /** Change handler. Receives the new numeric value. */
  onChange?: (value: number) => void;
  /** If true, the slider is non-interactive. @default false */
  disabled?: boolean;
  /**
   * If true, `onChange`/`slider:changed` only fire once, when the drag
   * ends (or on a discrete keyboard step) — not continuously on every
   * tick while dragging. The thumb still tracks the pointer smoothly
   * either way (an internal buffer drives its visual position); this only
   * changes when the *consumer* is notified. Opt-in, not the default —
   * live per-tick updates are the right choice for most sliders (e.g. a
   * real-time value preview), including most of the Theme Designer's own
   * (color/timing values, which don't feed back into layout). It matters
   * for a specific narrower case: a slider whose value feeds back into
   * the page's own layout — the Theme Designer's Master Font Size above
   * all, since every `rem` value in the whole UI derives from it —  where
   * recalculating on every tick can resize or reposition the very slider
   * being dragged out from under the pointer mid-gesture, not just waste
   * a render. Deferring to release keeps the drag itself trackable
   * regardless of what the eventual committed value ends up changing.
   * @default false
   */
  commitOnRelease?: boolean;
  /**
   * Accessible name announced by screen readers. Only needed when this
   * `Slider` isn't inside a `<FormField label="...">` — the `<label
   * htmlFor>` that renders provides the accessible name already in that
   * case, the same way it does for `Input`/`Select`/`Combobox`.
   */
  ariaLabel?: string;
  /** Per-instance overrides for track height and thumb size. */
  overrides?: Partial<SliderSliceState>;
}

/**
 * @manifest Range input control built on Base UI Slider
 * @manifestCategory Form Controls
 */
export const Slider: React.FC<SliderProps> = ({
  id,
  name: propName,
  value,
  defaultValue = 50,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled: disabledProp = false,
  commitOnRelease = false,
  ariaLabel,
  overrides,
}) => {
  const disabled = useFieldsetDisabled(disabledProp);
  const fieldCtx = useContext(FieldContext);
  const name = propName || fieldCtx.name || '';
  const effectiveId = id ?? (name || undefined);
  // A local buffer, not just `value ?? defaultValue` read directly, is
  // what lets the thumb keep tracking the pointer smoothly during a drag
  // in commitOnRelease mode: the *external* `value` prop only advances
  // once the consumer's onChange fires (i.e. on release), so rendering
  // straight from it would freeze the thumb at the pre-drag position for
  // the whole gesture. Synced back to the external value below whenever
  // it changes from outside (e.g. a programmatic reset), just not on
  // every internal drag tick.
  const [localValue, setLocalValue] = useState(value !== undefined ? value : defaultValue);
  // Adjusted during render, not via a useEffect -- React's own documented
  // pattern for "sync state when a prop changes" (react.dev/learn/you-
  // might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  // Calling setState here (not inside an effect) lets React apply it
  // before committing this render, avoiding the extra
  // render-then-effect-then-rerender cascade a useEffect version would
  // cause -- same external behavior (localValue tracks value), one fewer
  // render pass.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== undefined && value !== prevValue) {
    setPrevValue(value);
    setLocalValue(value);
  }

  // Uncontrolled (no `value` prop) always renders from `localValue` --
  // controlled reads the external `value` directly UNLESS commitOnRelease
  // is deferring it (see that prop's own doc comment: the external value
  // only advances on release, so rendering straight from it mid-drag would
  // freeze the thumb, which is exactly what `localValue` exists to avoid).
  // Previously this read `defaultValue` (a fixed prop, never updated by a
  // drag) instead of `localValue` for the uncontrolled + !commitOnRelease
  // case -- the common case for a bare `<Slider defaultValue={...} />` --
  // so the thumb never visually moved even though onChange/aiBus fired
  // correctly on every tick (reported directly: "messages indicate the
  // value is changing" but nothing on screen does).
  const currentVal = commitOnRelease ? localValue : (value !== undefined ? value : localValue);
  const sliderVars = getSparseVariables(SliderThemeSlice, overrides ?? {});
  useInjectInteractionStyles();

  const commitValue = (newVal: number) => {
    if (onChange) onChange(newVal);
    aiBus.emit('slider:changed', { name, value: newVal });
  };

  return (
    <BaseSlider.Root
      value={currentVal}
      onValueChange={(val) => {
        // Always kept in sync, live, regardless of commitOnRelease -- it's
        // what the thumb's own position (currentVal, above) renders from
        // in every uncontrolled/deferred-commit case.
        setLocalValue(val);
        if (!commitOnRelease) {
          commitValue(val);
        }
      }}
      onValueCommitted={commitOnRelease ? (val) => commitValue(val) : undefined}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      style={sliderRootStyle(disabled, sliderVars)}
    >
      <BaseSlider.Control style={sliderControlStyle(disabled)}>
        <BaseSlider.Track style={SLIDER_TRACK_STYLE}>
          <BaseSlider.Indicator style={SLIDER_RANGE_STYLE} />
          {/* The thumb wraps a real <input type="range">, which carries the
              name. Base UI generates that input's id, so a FormField's
              <label htmlFor> can't target it; the label names it through
              aria-labelledby instead (#701). */}
          <BaseSlider.Thumb
            id={effectiveId}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabel ? undefined : fieldCtx.labelId}
            className="ai-focus-ring"
            style={sliderThumbStyle(disabled)}
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
};
