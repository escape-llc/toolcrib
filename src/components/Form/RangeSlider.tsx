'use client';

import React, { useContext, useId, useState } from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { getSparseVariables } from '../../theme/slice';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { FieldContext } from './FieldContext';
import { SliderThemeSlice, type SliderSliceState } from './SliderSlice';
import { sliderRootStyle, SLIDER_TRACK_STYLE, SLIDER_RANGE_STYLE, sliderThumbStyle } from './sliderStyles';
import { useLocaleStrings } from '../Locale/LocaleContext';

/**
 * Props for the `<RangeSlider>` two-thumb range control.
 *
 * Emits `rangeslider:changed` events on the event bus. A separate component
 * (and channel) from `<Slider>` rather than a `number | [number, number]`
 * overload, so neither component's value type, nor `slider:changed`'s
 * payload, has to be narrowed by every consumer.
 */
export interface RangeSliderProps {
  /** Element id, applied to the lower thumb. Auto-derived from `name` (or the inherited `<FormField>` name) if omitted — so `<FormField>`'s `<label htmlFor>` click focuses the lower thumb. */
  id?: string;
  /** Field name. Auto-inherited from parent `<FormField>` if omitted. Used in event bus payloads. */
  name?: string;
  /** Controlled `[lower, upper]` value. */
  value?: [number, number];
  /** Initial `[lower, upper]` value (uncontrolled). @default [min, max] */
  defaultValue?: [number, number];
  /** Minimum value. @default 0 */
  min?: number;
  /** Maximum value. @default 100 */
  max?: number;
  /** Step increment. @default 1 */
  step?: number;
  /** Minimum number of `step`s the two thumbs must stay apart. `0` lets them meet. @default 0 */
  minStepsBetweenThumbs?: number;
  /** Change handler. Receives the new `[lower, upper]` value. */
  onChange?: (value: [number, number]) => void;
  /** If true, the slider is non-interactive. @default false */
  disabled?: boolean;
  /** Same as `<Slider>`'s `commitOnRelease`: notify only when a drag ends (or on a discrete keyboard step), while the thumbs still track the pointer. @default false */
  commitOnRelease?: boolean;
  /**
   * Accessible name for the control as a whole. Only needed outside a
   * `<FormField label="...">`. Each thumb's name combines this (or the
   * FormField's label) with its own suffix — "Price, Minimum" / "Price,
   * Maximum" — since two thumbs can't share one `<label htmlFor>`.
   */
  ariaLabel?: string;
  /** Per-thumb name suffixes. @default the locale's `rangeSlider.minimum` / `rangeSlider.maximum` */
  thumbLabels?: [string, string];
  /** Per-instance overrides for track height and thumb size. Shared with `<Slider>`. */
  overrides?: Partial<SliderSliceState>;
}

const sameRange = (a: [number, number] | undefined, b: [number, number] | undefined) =>
  a === b || (!!a && !!b && a[0] === b[0] && a[1] === b[1]);

/**
 * @manifest Two-thumb range control (lower/upper bound) built on Radix Slider, styled identically to Slider
 * @manifestCategory Form Controls
 */
export const RangeSlider: React.FC<RangeSliderProps> = ({
  id,
  name: propName,
  value,
  min = 0,
  max = 100,
  defaultValue,
  step = 1,
  minStepsBetweenThumbs = 0,
  onChange,
  disabled = false,
  commitOnRelease = false,
  ariaLabel,
  thumbLabels,
  overrides,
}) => {
  const fieldCtx = useContext(FieldContext);
  const name = propName || fieldCtx.name || '';
  const effectiveId = id ?? (name || undefined);
  const strings = useLocaleStrings().rangeSlider;
  const [lowerLabel, upperLabel] = thumbLabels ?? [strings.minimum, strings.maximum];
  const baseId = useId();

  // Same local-buffer + render-time prop sync as Slider (see its comments):
  // the buffer keeps the thumbs tracking the pointer in commitOnRelease
  // mode. Compared by content, not identity -- a consumer passing a fresh
  // `[a, b]` literal every render must not re-trigger the sync forever.
  const [localValue, setLocalValue] = useState<[number, number]>(value ?? defaultValue ?? [min, max]);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== undefined && !sameRange(value, prevValue)) {
    setPrevValue(value);
    setLocalValue(value);
  }
  const currentVal = commitOnRelease ? localValue : (value ?? localValue);
  const sliderVars = getSparseVariables(SliderThemeSlice, overrides ?? {});
  useInjectInteractionStyles();

  const commitValue = (newVal: [number, number]) => {
    if (onChange) onChange(newVal);
    aiBus.emit('rangeslider:changed', { name, value: newVal });
  };

  // aria-labelledby = [control name source] + [this thumb's suffix]. The
  // name source is the FormField's real label when there is one, else a
  // hidden span carrying `ariaLabel`, else nothing (suffix alone).
  // `hidden` elements are still valid aria-labelledby targets.
  const nameSourceId = fieldCtx.labelId ?? (ariaLabel ? `${baseId}-name` : undefined);
  const labelledBy = (suffixId: string) => [nameSourceId, suffixId].filter(Boolean).join(' ');

  return (
    <>
      {!fieldCtx.labelId && ariaLabel && <span id={`${baseId}-name`} hidden>{ariaLabel}</span>}
      <span id={`${baseId}-lower`} hidden>{lowerLabel}</span>
      <span id={`${baseId}-upper`} hidden>{upperLabel}</span>
      <SliderPrimitive.Root
        value={currentVal}
        onValueChange={(vals) => {
          const next: [number, number] = [vals[0], vals[1]];
          setLocalValue(next);
          if (!commitOnRelease) commitValue(next);
        }}
        onValueCommit={commitOnRelease ? (vals) => commitValue([vals[0], vals[1]]) : undefined}
        min={min}
        max={max}
        step={step}
        minStepsBetweenThumbs={minStepsBetweenThumbs}
        disabled={disabled}
        style={sliderRootStyle(disabled, sliderVars)}
      >
        <SliderPrimitive.Track style={SLIDER_TRACK_STYLE}>
          <SliderPrimitive.Range style={SLIDER_RANGE_STYLE} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          id={effectiveId}
          aria-labelledby={labelledBy(`${baseId}-lower`)}
          className="ai-focus-ring"
          style={sliderThumbStyle(disabled)}
        />
        <SliderPrimitive.Thumb
          aria-labelledby={labelledBy(`${baseId}-upper`)}
          className="ai-focus-ring"
          style={sliderThumbStyle(disabled)}
        />
      </SliderPrimitive.Root>
    </>
  );
};
